import { html, render } from '../core/dom.js';
import { listen } from '../core/store.js';
import { fmtShort } from '../core/dates.js';
import { account } from '../cloud/sync.js';
import { loadMemberProfile, loadProfileBanners, loadChatProfiles } from '../cloud/profile-banners.js';
import { loadProfilePictures } from '../cloud/profile-pictures.js';
import { state, streaks } from '../state.js';
import { leaderboardStats, bestWeight, exerciseNames } from '../domain/logs.js';
import { openSheet } from './sheet.js';
import { bannerMarkup, paintProfileBanners, profileAvatar } from './profile-banner.js';

const number = (value, unit = '') => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString() + unit;
function duration(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const minutes = Math.floor(Number(value) / 60), hours = Math.floor(minutes / 60);
  return hours ? hours + ' h ' + minutes % 60 + ' min' : minutes + ' min';
}
function ownSummary(id) {
  const st = streaks(), weight = state.weights.at(-1);
  return { user_id: id, username: account.profile?.username || 'you', ...leaderboardStats(state.logs),
    current_streak: st.current, best_streak: st.best, weight_kg: weight?.weight, weight_date: weight?.date,
    routines: Object.keys(state.workouts).length, exercises: Object.values(state.workouts).reduce((n, list) => n + list.length, 0),
    exercise_bests: Object.fromEntries(exerciseNames(state.logs).map(name => [name, bestWeight(state.logs, name)])) };
}
function profileBody(row) {
  const cells = [
    ['Workouts', number(row.workouts_count)], ['Training time', duration(row.total_seconds)],
    ['Weight lifted', number(row.volume_kg_reps, ' kg·reps')], ['Current streak', number(row.current_streak, ' days')],
    ['Best streak', number(row.best_streak, ' days')], ['Latest weight', number(row.weight_kg, ' kg')],
    ['Routines', number(row.routines)], ['Exercises', number(row.exercises)],
  ];
  const bests = Object.entries(row.exercise_bests || {}).filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0).sort(([a], [b]) => a.localeCompare(b));
  return html`<div class="member-profile">
    ${bannerMarkup(row.user_id, 'profile-hero-banner')}
    <div class="profile-identity">${profileAvatar(row.username, 'lg', row.user_id)}<h3>@${row.username}</h3></div>
    ${row.workouts_count == null ? html`<p class="muted small profile-sharing-note">Workout stats aren’t shared yet.</p>` : ''}
    <dl class="profile-stats">${cells.map(([label, value]) => html`<div><dt>${label}</dt><dd>${value}</dd>${label === 'Latest weight' && /^\d{4}-\d{2}-\d{2}$/.test(row.weight_date || '') ? html`<small class="muted">${fmtShort(row.weight_date)}</small>` : ''}</div>`)}</dl>
    <h3 class="profile-section-title">Exercise bests</h3>
    ${bests.length ? html`<dl class="profile-bests">${bests.map(([name, value]) => html`<div><dt>${name}</dt><dd>${number(value, ' kg')}</dd></div>`)}</dl>` : html`<p class="muted small">No shared exercise bests yet.</p>`}
  </div>`;
}

export async function openMemberProfile(userId, { removeFriend } = {}) {
  const viewer = account.user?.id;
  if (!viewer || !account.ready || !/^[0-9a-f-]{36}$/i.test(userId)) return;
  const removers = [];
  let loading = false;
  let dismissed = false;
  let queued = false;
  try {
    await openSheet({ title: 'Profile', className: 'member-profile-sheet', body: html`<p class="muted">Loading profile…</p>`,
      actions: removeFriend ? [{ label: 'Remove friend', tone: 'ghost', onClick: close => {
        if (account.user?.id !== viewer) { close(); return; }
        close(); removeFriend();
      } }] : [],
      onMount: (sheet, close) => {
        const body = sheet.querySelector('.sheet-body');
        async function refresh() {
          if (dismissed || !sheet.isConnected) return;
          if (loading) { queued = true; return; }
          if (account.user?.id !== viewer) { close(); return; }
          loading = true;
          try {
            let row = userId === viewer ? ownSummary(viewer) : await loadMemberProfile(userId);
            await Promise.all([loadProfilePictures([userId]), loadProfileBanners([userId])]);
            if (!row) {
              const members = await loadChatProfiles([userId]);
              const member = members.find(m => m.user_id === userId);
              if (member) row = { user_id: userId, username: member.username };
            }
            if (dismissed || !sheet.isConnected || account.user?.id !== viewer) return;
            render(body, row ? profileBody(row) : html`<p class="muted">This profile is no longer available.</p>`);
            paintProfileBanners(body);
          } catch (error) {
            if (!dismissed && sheet.isConnected && account.user?.id === viewer) render(body, html`<p class="notice error">${error.message}</p><button type="button" class="btn btn-soft" data-retry-profile>Try again</button>`);
          } finally {
            loading = false;
            if (queued && !dismissed) { queued = false; refresh(); }
          }
        }
        body.addEventListener('click', event => { if (event.target.closest('[data-retry-profile]')) refresh(); });
        removers.push(listen('gym:account', () => { if (account.user?.id !== viewer) close(); }));
        removers.push(listen('gym:crew-updated', refresh));
        refresh();
      },
    });
  } finally { dismissed = true; removers.forEach(remove => remove()); }
}
