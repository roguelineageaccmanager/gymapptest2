import { exerciseBest } from '../domain/exercises.js';
// Friends tab: chat, friends and the leaderboard. All server traffic runs in
// the background; results patch the page in place (render() keeps focus).
import { $, html, render, on, toast, toastLater, busyAttr } from '../core/dom.js';
import { listen, emit } from '../core/store.js';
import { ymd, relativeDay, parseYmd } from '../core/dates.js';
import { refresh, currentPage, go } from '../core/router.js';
import { state, streaks } from '../state.js';
import { supabase, cloudConfigured } from '../cloud/client.js';
import { account } from '../cloud/sync.js';
import { loadProfilePictures } from '../cloud/profile-pictures.js';
import { loadProfileBanners } from '../cloud/profile-banners.js';
import { bannerMarkup, paintProfileBanners, profileAvatar } from './profile-banner.js';
import { openMemberProfile } from './profile.js';
import { chatPanel, initChat, loadChat, scrollChatToLatest, bindChatScroll } from './chat.js';
import * as social from '../cloud/social.js';
import { openSheet } from './sheet.js';
import { icons } from './icons.js';

const REFRESH_MS = 60000;

const crew = {
  tab: 'dates',
  leaderboardBoard: 'gym-time',
  friendships: null,
  nextWorkouts: [],
  leaderboard: null,
  shared: null,
  sharedThemes: null,
  error: '',
  loadedFor: null,
};

const me = () => account.user && account.user.id;
const pending = new Set(); // keys of actions in flight, to block double taps

// ---------- data ----------
let loading = null;
let queued = null; // { promise, resolve } of the load that runs after the current one
let retrying = false; // a "Try again" the user pressed is running
/**
 * Reloads friends and next-workout summaries. A call while a load runs queues one more, so
 * writes are never shown stale; it resolves when that newer load is done.
 */
function refreshCrew() {
  if (!account.user || !account.ready) return Promise.resolve();
  if (loading) {
    if (!queued) { let resolve; const promise = new Promise((r) => { resolve = r; }); queued = { promise, resolve }; }
    return queued.promise;
  }
  const forUser = me();
  loading = (async () => {
    const [f, next] = await Promise.all([social.loadFriendships(), Promise.resolve(supabase.rpc('friend_next_workouts', { from_day: ymd() })).catch(() => ({ data: [] }))]);
    if (me() !== forUser) return; // signed out or switched account meanwhile
    crew.error = f.error && !f.missing ? f.error : '';
    if (!f.error) crew.friendships = f.data;
    crew.nextWorkouts = next.error ? [] : next.data || [];
    loadProfilePictures((crew.friendships?.friends || []).map(f=>f.userId));
    loadProfileBanners((crew.friendships?.friends || []).map(f => f.userId));
    crew.loadedFor = forUser;
    updateBadge();
    emit('gym:crew-updated');
    if (currentPage() === 'crew') renderCrew();
  })().finally(() => {
    loading = null;
    if (queued) { const q = queued; queued = null; refreshCrew().then(q.resolve, q.resolve); }
  });
  return loading;
}

async function loadTabData() {
  const forUser = me();
  if (!forUser) return;
  if (crew.tab === 'ranking') {
    const r = await social.loadLeaderboard(crew.friendships?.friends || []);
    if (me() !== forUser) return;
    crew.leaderboard = r.error ? { error: r.error } : r.data;
    if (!r.error) { loadProfilePictures((r.data || []).map(row => row.user_id)); loadProfileBanners((r.data || []).map(row => row.user_id)); }
  }
  if (crew.tab === 'dates') { scrollChatToLatest(); loadChat({ bottom: true }); }
  if (currentPage() === 'crew') renderCrew();
}

function clearCrew() {
  Object.assign(crew, { tab: 'dates', friendships: null, nextWorkouts: [], leaderboard: null, shared: null, sharedThemes: null, error: '', loadedFor: null });
  updateBadge();
}

function updateBadge() {
  const n=crew.friendships?.incoming.length||0,badge=document.querySelector('.nav-btn[data-page="crew"] .badge');
  if(badge){badge.textContent=n?String(n):'';badge.hidden=!n;}
  document.querySelector('.nav-btn[data-page="crew"]')?.setAttribute('aria-label',n?`Friends, ${n} new friend request${n===1?'':'s'}`:'Friends');
}

// ---------- rendering ----------
const SECTIONS = [['dates', 'Chat'], ['ranking', 'Leaderboard'], ['friends', 'Friends']];

export function renderCrew() {
  const page = $('page-crew');
  page.classList.toggle('chat-view', !!account.user && crew.tab === 'dates');
  const st = streaks().current;
  const head = (view) => html`<header class="top" data-view="${view}"><h1>Friends</h1>
    <div class="top-actions"><span class="streak" aria-label="Training streak: ${st} days">${icons.flame} ${st}</span><button type="button" class="icon-btn" data-open-settings aria-label="Settings">${icons.settings}</button></div></header>`;
  if (!cloudConfigured()) {
    render(page, html`${head('none')}<div class="card empty"><h2>Accounts are not available</h2><p>This version of the app was built without accounts, so friends and chat are off.</p></div>`);
    return;
  }
  if (!account.user) {
    render(page, html`${head('signed-out')}
      <div class="card hero-card crew-intro">
        <span class="big-icon">${icons.users}</span>
        <h2>Better with friends</h2>
        <p>Chat, compare lifts and share your progress.</p>
        <button type="button" class="btn btn-primary" data-open-settings>Get started</button>
      </div>`);
    return;
  }
  if (crew.loadedFor !== me() && !loading) refreshCrew();
  const incoming = crew.friendships?.incoming.length || 0;
  render(page, html`${head('crew')}
    <div class="segmented app-section-tabs" role="tablist" aria-label="Friends sections">
      ${SECTIONS.map(([id, label]) => html`<button type="button" role="tab" id="crew-tab-${id}" aria-controls="crew-panel" aria-selected="${crew.tab === id ? 'true' : 'false'}" tabindex="${crew.tab === id ? '0' : '-1'}" data-crew-tab="${id}">${label}${id === 'friends' && incoming ? html`<span class="dot-badge" aria-hidden="true">${incoming}</span><span class="sr-only">, ${incoming} new</span>` : ''}</button>`)}
    </div>
    ${crew.error || retrying ? html`<div class="notice error" data-key="crew-error"><span>${crew.error || 'Loading…'}</span> <button type="button" class="link-btn inline" data-retry${busyAttr(retrying)}>${retrying ? 'Trying…' : 'Try again'}</button></div>` : ''}
    <div id="crew-panel" role="tabpanel" aria-labelledby="crew-tab-${crew.tab}">
      <div data-key="panel-${crew.tab}">${crew.tab === 'dates' ? datesPanel() : crew.tab === 'friends' ? friendsPanel() : rankingPanel()}</div>
    </div>`);
  paintProfileBanners(page);
  bindChatScroll();
}

function loadingCard(text) {
  return crew.error ? '' : html`<div class="card skeleton" aria-busy="true"><p>${text}</p></div>`;
}

function datesPanel() { return chatPanel(); }

function friendsPanel() {
  const f = crew.friendships;
  if (!f) return loadingCard('Loading friends…');
  return html`
    <form class="card add-friend" id="addFriendForm" data-key="add-friend">
      <h2>Find friends</h2>
      <label class="field-label" for="friendName">Add a friend by username</label>
      <div class="input-row"><span class="input-prefix" aria-hidden="true">@</span><input class="input" id="friendName" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="21" placeholder="username" enterkeyhint="send"><button class="btn btn-primary" type="submit"${busyAttr(pending.has('add'))}>Add</button></div>
    </form>
    ${f.incoming.length ? html`<h2 class="section-title" data-key="req-title">Requests</h2><div class="card list" data-key="req-list">${f.incoming.map((x) => html`
      <div class="row row-request" data-key="req-${x.id}">${profileAvatar(x.username, 'md', x.userId)}<div class="row-main"><b>@${x.username}</b><small>wants to be friends</small></div>
        <button type="button" class="btn btn-primary btn-sm" data-accept="${x.id}"${busyAttr(pending.has(x.id))} aria-label="Accept request from ${x.username}">Accept</button>
        <button type="button" class="btn btn-ghost btn-sm" data-decline="${x.id}" data-user="${x.userId}" data-name="${x.username}"${busyAttr(pending.has(x.id))} aria-label="Decline request from ${x.username}">Decline</button></div>`)}</div>` : ''}
    <h2 class="section-title" data-key="friends-title">Friends ${f.friends.length ? html`<span class="muted">${f.friends.length}</span>` : ''}</h2>
    ${f.friends.length ? html`<div class="card list" data-key="friends-list">${f.friends.map((x) => {
      const next = crew.nextWorkouts.find(w => w.user_id === x.userId);
      return html`
      <div class="row" data-key="friend-${x.id}"><button type="button" class="friend-profile-link" data-view-profile="${x.userId}" aria-label="View @${x.username} profile">${profileAvatar(x.username, 'md', x.userId)}<span class="row-main"><b>@${x.username}</b></span></button>
        <span class="friend-next-workout">${next ? html`<b>${next.workout_name}</b><time datetime="${next.workout_date}">${relativeDay(parseYmd(next.workout_date))}</time>` : html`<small>No workout scheduled</small>`}</span></div>`;
    })}</div>`
      : html`<div class="empty-inline" data-key="no-friends"><p>No friends yet.</p></div>`}
    ${f.outgoing.length ? html`<h2 class="section-title" data-key="sent-title">Sent</h2><div class="card list" data-key="sent-list">${f.outgoing.map((x) => html`
      <div class="row" data-key="out-${x.id}">${profileAvatar(x.username, 'md', x.userId)}<div class="row-main"><b>@${x.username}</b><small>waiting for an answer</small></div>
        <button type="button" class="btn btn-ghost btn-sm" data-cancel-request="${x.id}"${busyAttr(pending.has(x.id))} aria-label="Cancel request to ${x.username}">Cancel</button></div>`)}</div>` : ''}
    `;
}

function timeText(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60);
  return hours ? (minutes ? `${hours} h ${minutes} min` : `${hours} h`) : `${minutes} min`;
}

function scoreFor(row, board) {
  let value;
  if (board === 'gym-time') value = row.total_seconds;
  else if (board === 'volume') value = row.volume_kg_reps;
  else if (board === 'streak') value = row.best_streak;
  else if (board === 'body-weight') value = row.weight_kg;
  else if (board.startsWith('exercise:')) value = exerciseBest(row.exercise_bests, board.slice(9)) || null;
  if (value == null || value === '' || !Number.isFinite(Number(value))) return null;
  return Math.max(0, Number(value));
}

function scoreText(value, board) {
  if (board === 'gym-time') return timeText(value);
  if (board === 'volume') return Number(value).toLocaleString() + ' kg·reps';
  if (board === 'streak') return value + (value === 1 ? ' day' : ' days');
  return Number(value).toLocaleString() + ' kg';
}

function leaderboardBoards() {
  const customBoards = (Array.isArray(state.settings.leaderboardExercises) ? state.settings.leaderboardExercises : [])
    .filter((name) => typeof name === 'string' && name.trim()).slice(0, 8);
  return [['gym-time', 'Gym time'], ['volume', 'Weight lifted'], ['streak', 'Best streak'], ['body-weight', 'Body weight'],
    ...customBoards.map((name) => ['exercise:' + name, name])];
}

function rankingPanel() {
  const lb = crew.leaderboard;
  if (!lb) return loadingCard('Loading leaderboard…');
  if (lb.error) return html`<p class="notice error">${lb.error} <button type="button" class="link-btn inline" data-retry${busyAttr(retrying)}>${retrying ? 'Trying…' : 'Try again'}</button></p>`;
  const boards = leaderboardBoards();
  if (!boards.some(([id]) => id === crew.leaderboardBoard)) crew.leaderboardBoard = 'gym-time';
  const ranked = lb.map((r) => ({ row: r, score: scoreFor(r, crew.leaderboardBoard) }))
    .filter((x) => x.score != null).sort((a, b) => b.score - a.score || String(a.row.username).localeCompare(String(b.row.username)));
  const unranked = lb.filter((r) => scoreFor(r, crew.leaderboardBoard) == null);
  const row = (r, rank, score) => {
    const medal = rank === 1 ? ' gold' : rank === 2 ? ' silver' : rank === 3 ? ' bronze' : '';
    const person = r.user_id === me();
    return html`
      <button type="button" class="row leaderboard-row${medal}${person ? ' me' : ''}" data-key="rank-${r.user_id}" data-view-profile="${r.user_id}" aria-label="View @${r.username} profile">
        ${bannerMarkup(r.user_id, 'leaderboard-banner')}
        <span class="rank${medal}" aria-label="${rank ? 'Rank ' + rank : 'Unranked'}" title="${rank ? 'Rank ' + rank : 'Unranked'}">${rank || '–'}</span>${profileAvatar(r.username, 'md', r.user_id)}
        <div class="row-main"><b>@${r.username}${person ? ' (you)' : ''}</b>
          <small>${score == null ? (crew.leaderboardBoard === 'body-weight' ? 'No shared weigh-in yet' : person ? 'Share your scores to appear here' : 'No shared score') : scoreText(score, crew.leaderboardBoard)}</small></div>
      </button>`;
  };
  return html`
    <section class="card leaderboard-controls" data-key="leaderboard-controls">
      <h2>Leaderboard</h2>
      <button type="button" class="board-picker" data-leaderboard-picker aria-label="Choose leaderboard" aria-haspopup="dialog"><span><small>Compare by</small><b>${boards.find(([id]) => id === crew.leaderboardBoard)[1]}</b></span>${icons.chevron}</button>

    </section>
    <div class="card list ranking" data-key="ranking-list">
      ${ranked.map((x, i) => row(x.row, i + 1, x.score))}
      ${unranked.map((r) => row(r, 0, null))}
    </div>`;
}

// ---------- events ----------
/** Runs a server action with its buttons disabled, then shows the result. */
async function act(key, run, success) {
  if (pending.has(key)) return false;
  pending.add(key);
  if (currentPage() === 'crew') renderCrew();
  // A step that throws (e.g. no connection) must not leave its buttons busy for good.
  const r = await Promise.resolve().then(run).catch((e) => ({ error: (e && e.message) || 'Something went wrong. Try again.' }));
  pending.delete(key);
  // The answer comes later: it waits behind an Undo the user may have made meanwhile.
  if (r.error) toast(r.error, { tone: 'error', background: true });
  else if (success) toast(success, { background: true });
  if (currentPage() === 'crew') renderCrew();
  return !r.error;
}

async function removeOrBlock(id, _userId, name, kind) {
  const choice = await openSheet({
    title: kind === 'friend' ? `Remove @${name}?` : `Decline @${name}?`,
    body: html`<p class="sheet-text">${kind === 'friend' ? `@${name} will no longer see your shared progress, stats or routines.` : 'They are not told.'}</p>`,
    actions: [
      { label: kind === 'friend' ? 'Remove friend' : 'Decline', value: 'remove', tone: 'secondary' },
      { label: 'Cancel', value: null, tone: 'ghost' },
    ],
  });
  if (!choice) return;
  const ok = await act(id, () => social.removeFriendship(id), kind === 'friend' ? 'Friend removed.' : 'Request declined.');
  if (ok) refreshCrew();
}

export function initCrew() {
  listen('gym:open-chat', () => { crew.tab = 'dates'; go('crew'); renderCrew(); loadChat({ bottom: true }); });
  const page = $('page-crew');
  initChat(page);
  on(page, 'click', '[data-view-profile]', (e, button) => {
    const userId = button.dataset.viewProfile;
    const friend = crew.friendships?.friends.find(f => f.userId === userId);
    openMemberProfile(userId, { removeFriend: friend ? () => {
      const current = crew.friendships?.friends.find(f => f.userId === userId);
      if (current) return removeOrBlock(current.id, current.userId, current.username, 'friend');
    } : null });
  });
  on(page, 'click', '[data-crew-tab]', (e, b) => {
    crew.tab = b.dataset.crewTab;
    renderCrew();
    $('crew-tab-' + crew.tab)?.focus({ preventScroll: true });
    loadTabData();
    if (crew.tab !== 'ranking') refreshCrew(); // pick up friend requests sent since the last poll
  });
  // A retry the user asked for keeps its button (busy) and says how it went.
  on(page, 'click', '[data-retry]', async () => {
    const toast = toastLater();
    retrying = true;
    renderCrew();
    await refreshCrew();
    await loadTabData();
    // The notice stayed while retrying; move focus only if the user is still on it.
    const stayed = !!document.activeElement?.closest?.('[data-key="crew-error"]');
    retrying = false;
    renderCrew();
    // Only what this retry loaded counts (other tabs keep their own state).
    const err = crew.error || (crew.tab === 'ranking' && crew.leaderboard?.error);
    toast(err || 'Loaded.', { tone: err ? 'error' : 'default' });
    if (!err && stayed) $('crew-tab-' + crew.tab)?.focus({ preventScroll: true }); // the notice is gone: back to the section
  });
  on(page, 'click', '[data-leaderboard-picker]', async () => {
    const boards = leaderboardBoards();
    const picked = await openSheet({
      title: 'Choose leaderboard', subtitle: 'Pick a score to compare with your friends.', className: 'board-sheet',
      body: html`<div class="board-options" role="listbox" aria-label="Leaderboard category">${boards.map(([id, label]) => html`<button type="button" class="board-option${id === crew.leaderboardBoard ? ' selected' : ''}" role="option" aria-selected="${id === crew.leaderboardBoard ? 'true' : 'false'}" data-board="${id}"><span class="board-symbol" aria-hidden="true">${id === 'gym-time' ? icons.clock : id === 'streak' ? icons.flame : icons.dumbbell}</span><span class="row-main"><b>${label}</b><small>${id === 'gym-time' ? 'Time spent training' : id === 'volume' ? 'Total kilograms × reps' : id === 'streak' ? 'Longest training streak' : id === 'body-weight' ? 'Latest weigh-in · heaviest first' : 'Best weight lifted'}</small></span>${id === crew.leaderboardBoard ? html`<span class="tick">${icons.check}</span>` : ''}</button>`)}</div>`,
      onMount: (sheet, close) => sheet.querySelectorAll('[data-board]').forEach((button) => { button.onclick = () => close(button.dataset.board); }),
    });
    if (!picked || !boards.some(([id]) => id === picked)) return;
    crew.leaderboardBoard = picked;
    renderCrew();
    page.querySelector('[data-leaderboard-picker]')?.focus({ preventScroll: true });
  });
  // Queue requests so a slow send cannot discard the next name being typed.
  let addQueue = Promise.resolve();
  const asked = new Set();
  const sendRequest = async (name, uid, show) => {
    try {
      if (account.user?.id !== uid) return;
      let message = '';
      const ok = await act('add', async () => { const r = await social.sendFriendRequest(name); message = r.data; return r; });
      if (!ok) return;
      show(message);
      const input = $('friendName');
      if (input && input.value === name) input.value = '';
      refreshCrew();
    } finally { asked.delete(name.trim().toLowerCase().replace(/^@/, '')); }
  };
  on(page, 'submit', '#addFriendForm', (e) => {
    e.preventDefault();
    const input = $('friendName');
    const name = input?.value || '';
    if (!name.trim()) { input?.focus(); return; }
    const key = name.trim().toLowerCase().replace(/^@/, '');
    if (asked.has(key)) { toast('The request to @' + key + ' is already on its way.'); return; }
    asked.add(key);
    if (pending.has('add')) toast('@' + key + ' is sent next, after the request on its way.');
    const uid = account.user?.id, later = toastLater();
    addQueue = addQueue.then(() => sendRequest(name, uid, later)).catch(() => {});
  });
  on(page, 'click', '[data-accept]', async (e, b) => { if (await act(b.dataset.accept, () => social.acceptRequest(b.dataset.accept), 'You are now friends.')) refreshCrew(); });
  on(page, 'click', '[data-decline]', (e, b) => removeOrBlock(b.dataset.decline, b.dataset.user, b.dataset.name, 'request'));
  on(page, 'click', '[data-cancel-request]', async (e, b) => { if (await act(b.dataset.cancelRequest, () => social.removeFriendship(b.dataset.cancelRequest), 'Request cancelled.')) refreshCrew(); });
  listen('gym:scores-updated', () => { if (crew.tab === 'ranking' && currentPage() === 'crew') loadTabData(); });

  listen('gym:account', () => {
    if (!account.user || (crew.loadedFor && crew.loadedFor !== me())) clearCrew();
    if (account.user && account.ready && crew.loadedFor !== me()) refreshCrew();
    refresh('crew');
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && account.user) refreshCrew(); });
  // Background refresh while the tab is open, also covering a dropped live connection.
  setInterval(() => {
    if (document.hidden || currentPage() !== 'crew' || !account.user) return;
    refreshCrew();
    loadTabData();
  }, REFRESH_MS);
}

export function onCrewShown() {
  if (account.user) { refreshCrew(); loadTabData(); if (crew.tab === 'dates') scrollChatToLatest(); }
}

listen('gym:pictures', () => { if (currentPage() === 'crew') renderCrew(); });

listen('gym:banners', () => { if (currentPage() === 'crew') renderCrew(); });
