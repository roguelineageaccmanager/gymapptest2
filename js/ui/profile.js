import { deepPlain, displaySets, emptySchedule, sanitizeWorkout, sanitizeWorkoutName, workoutBadge } from '../domain/plan.js';
import { CATALOG } from '../domain/catalog.js';
import { icons } from './icons.js';
import { supabase } from '../cloud/client.js';
import { activityLabel } from '../cloud/activity.js';
import {attachmentLabel} from '../domain/attachments.js';
import {exerciseDisplayName} from '../domain/exercises.js';
import {rankSetupKey} from '../domain/ranks.js';
import {announcementAdmin,loadAnnouncementRole} from '../cloud/announcements.js';
import {sharedRankSnapshot,sharedRankStats} from '../domain/shared-ranks.js';
import {bodygraphPanel,openStrengthLift,liftRankHeading,rankBadge,paintStrength} from './strength.js';
import { strengthStats, rankText } from '../domain/ranks.js';
import { toast, html, render } from '../core/dom.js';
import { listen } from '../core/store.js';
import { fmtShort, ymd } from '../core/dates.js';
import { account } from '../cloud/sync.js';
import { loadMemberProfile, loadProfileBanners } from '../cloud/profile-banners.js';
import { loadProfilePictures } from '../cloud/profile-pictures.js';
import { addPlanRoutines, state, streaks } from '../state.js';
import { leaderboardStats } from '../domain/logs.js';
import { openSheet } from './sheet.js';
import { bannerMarkup, paintProfileBanners, presenceAvatar } from './profile-banner.js';

const number = (value, unit = '') => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString() + unit;
function duration(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const minutes = Math.floor(Number(value) / 60), hours = Math.floor(minutes / 60);
  return hours ? hours + ' h ' + minutes % 60 + ' min' : minutes + ' min';
}
function ownSummary(id) {
  const st = streaks(), weight = state.weights.at(-1);
  const strength=strengthStats(state.logs,state.weights,state.workouts,ymd(),state.schedule,state.settings.hiddenStatsExercises||[]);
  return { user_id: id, username: account.profile?.username || 'you', ...leaderboardStats(state.logs),rank_score:strength.overall?.score??null,rank_details:sharedRankSnapshot(strength),
    current_streak: st.current, best_streak: st.best, weight_kg: weight?.weight, weight_date: weight?.date,
    admin:announcementAdmin(),routines: Object.keys(state.workouts).length, exercises: Object.values(state.workouts).reduce((n, list) => n + list.length, 0) };
}
function profileBody(row, ranks, activity, split) {
  const strengthScore = ranks ? ranks.overall?.score : row.rank_score;
  const status = activityLabel(activity);
  const cells = [
    ['Workouts', number(row.workouts_count)], ['Training time', duration(row.total_seconds)],
    ['Strength rank', strengthScore == null ? 'Unranked' : rankText(strengthScore)], ['Current streak', number(row.current_streak, ' days')],
    ['Best streak', number(row.best_streak, ' days')], ['Latest weight', number(row.weight_kg, ' kg')],
    ['Routines', number(row.routines)], ['Exercises', number(row.exercises)],
  ];
  return html`<div class="member-profile">
    ${bannerMarkup(row.user_id, 'profile-hero-banner')}
    <div class="profile-identity">${presenceAvatar(row.username, 'lg', row.user_id, status)}<h3>${row.username}${row.admin?html`<span class="role-badge">Admin</span>`:''}</h3></div>
    ${row.workouts_count == null && !ranks && !row.rank_details_failed ? html`<p class="muted small profile-sharing-note">Scores not shared.</p>` : ''}
    ${ranks ? html`<section class="profile-shared-ranks" aria-label="Shared strength ranks">
      ${ranks.overall ? html`<div class="profile-overall-rank" data-rank-color="${ranks.overall.color}">${rankBadge(ranks.overall)}<b>${rankText(ranks.overall.score)}</b></div>` : html`<p class="muted small">No qualifying ranked sets yet.</p>`}
      <details class="profile-rank-graph" open><summary>Body graph</summary>${bodygraphPanel(ranks,{heading:false})}</details>
    </section>` : row.rank_details_failed ? html`<p class="muted small">Could not load the body graph. <button type="button" class="link-btn inline" data-retry-profile>Try again</button></p>`
      : row.workouts_count != null ? html`<p class="muted small">No shared body graph yet. It appears after your friend syncs from an updated app.</p>` : ''}
    ${status && status !== 'Online' ? html`<p class="member-presence">${status}</p>` : ''}
    <dl class="profile-stats">${cells.map(([label, value]) => html`<div><dt>${label}</dt><dd>${value}</dd>${label === 'Latest weight' && /^\d{4}-\d{2}-\d{2}$/.test(row.weight_date || '') ? html`<small class="muted">${fmtShort(row.weight_date)}</small>` : ''}</div>`)}</dl>
    ${split?.length ? splitPanel(split, row.user_id !== account.user?.id) : ''}
  </div>`;
}

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function sharedRoutines(rows) {
  return (Array.isArray(rows) ? deepPlain(rows) : []).map(row => ({
    name: sanitizeWorkoutName(row.workout_name),
    days: (row.weekdays || []).filter(i => Number.isInteger(i) && i >= 0 && i < 7),
    exercises: sanitizeWorkout((row.exercises || []).map(e => ({
      ...e, cat: e.cat || CATALOG.find(entry => entry.name === e.name)?.cat
    })))
  })).filter(r => r.name);
}

function splitPanel(split, canCopy) {
  return html`<section class="profile-workouts"><div class="shared-routines-heading"><h3>Workout split</h3>
    ${canCopy ? html`<button type="button" class="btn btn-soft btn-sm" data-copy-split>${icons.copy} Copy split</button>` : ''}</div>
    <div class="routine-list">${split.map(r => html`<details><summary class="routine">
      <span class="routine-mark" aria-hidden="true">${workoutBadge(r.name)}</span>
      <span class="row-main"><b>${r.name}</b><small>${r.days.map(i => weekdays[i]).join(', ') || 'Unscheduled'} · ${r.exercises.length} ${r.exercises.length === 1 ? 'exercise' : 'exercises'}</small></span>
      <span class="chev">${icons.chevron}</span></summary>
      ${r.exercises.length ? html`<ol>${r.exercises.map(e => html`<li><b>${exerciseDisplayName(e.name)}</b><small>${displaySets(e)} ${Number(displaySets(e)) === 1 ? 'set' : 'sets'}${e.unilateral ? ' per side' : ''} · ${e.target}</small></li>`)}</ol>` : html`<p class="muted">No exercises yet.</p>`}</details>`)}</div></section>`;
}

async function copySplit(split, viewer, profile) {
  const choice = await openSheet({
    title: 'Copy split to Plan',
    body: html`<p>Your existing routines stay in Plan. Copies with the same name get a number.</p>
      <label class="toggle"><input type="checkbox" data-copy-schedule>Replace my weekly schedule with this split</label>`,
    actions: [{label: 'Copy to Plan', tone: 'primary', onClick: (finish, sheet) => finish({schedule: sheet.querySelector('[data-copy-schedule]').checked})},
      {label: 'Cancel', tone: 'ghost'}]
  });
  if (!choice || viewer !== account.user?.id || !profile.isConnected) return;
  const names = new Set(Object.keys(state.workouts));
  const schedule = choice.schedule ? emptySchedule() : null;
  const routines = split.map(r => {
    let name = r.name;
    for (let n = 2; names.has(name); n++) {
      const suffix = ' (' + n + ')';
      name = Array.from(r.name).slice(0, 200 - suffix.length).join('') + suffix;
    }
    names.add(name);
    if (schedule) for (const day of r.days) schedule[day] = name;
    return {name, exercises: structuredClone(r.exercises)};
  });
  addPlanRoutines(routines, schedule);
  toast('Split copied to Plan.');
}

export async function openMemberProfile(userId, { removeFriend } = {}) {
  const viewer = account.user?.id;
  if (!viewer || !account.ready || !/^[0-9a-f-]{36}$/i.test(userId)) return;
  const removers = [];
  let splitToCopy = [];
  let loading = false;
  let dismissed = false;
  let queued = false;
  let displayedRanks=null,closeCalculation=null,openLiftName=null;
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
            if(userId===viewer)await loadAnnouncementRole().catch(()=>false);
            let row = userId === viewer ? ownSummary(viewer) : await loadMemberProfile(userId);
            await Promise.all([loadProfilePictures([userId]), loadProfileBanners([userId])]);
            if (dismissed || !sheet.isConnected || account.user?.id !== viewer) return;
            displayedRanks = sharedRankStats(row?.rank_details);
            const [presence, split] = row ? await Promise.all([
              supabase.rpc('friend_activity'), supabase.rpc('member_workout_split', {member:userId})
            ]) : [{}, {}];
            if (dismissed || account.user?.id !== viewer) return;
            splitToCopy = sharedRoutines(split.data);
            render(body, row ? profileBody(row, displayedRanks, presence.data?.find(x => x.user_id === userId), splitToCopy) : html`<p class="muted">This profile is no longer available.</p>`);
            if(!displayedRanks?.exercises.some(e=>rankSetupKey(e)===openLiftName))closeCalculation?.();
            paintProfileBanners(body);paintStrength(body);
          } catch (error) {
            if (!dismissed && sheet.isConnected && account.user?.id === viewer) render(body, html`<p class="notice error">${error.message}</p><button type="button" class="btn btn-soft" data-retry-profile>Try again</button>`);
          } finally {
            loading = false;
            if (queued && !dismissed) { queued = false; refresh(); }
          }
        }
        body.addEventListener('click',event=>{
          if (event.target.closest('[data-copy-split]') && userId !== viewer && viewer === account.user?.id && splitToCopy.length) copySplit(splitToCopy, viewer, sheet);
          if(event.target.closest('[data-retry-profile]'))refresh();
          const muscle=event.target.closest('[data-muscle]');
          if(muscle){
            const card=[...body.querySelectorAll('[data-rank-muscle]')].find(c=>c.dataset.rankMuscle===muscle.dataset.muscle);
            if(card){card.open=true;card.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});card.querySelector('summary').focus({preventScroll:true});}
          }
          const button=event.target.closest('[data-strength-lift]');
          if(button&&account.user?.id===viewer){const lift=displayedRanks?.exercises.find(e=>e.name===button.dataset.strengthLift&&(e.attachment||'')===(button.dataset.strengthSetup||''));if(lift)openSharedCalculation(lift,viewer,close=>{closeCalculation=close;openLiftName=rankSetupKey(lift);});}
        });
        body.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.closest('[data-muscle]')){event.preventDefault();event.target.closest('[data-muscle]').dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
        removers.push(listen('gym:account', () => { if (account.user?.id !== viewer) close(); }));
        removers.push(listen('gym:crew-updated', refresh));
        refresh();
      },
    });
  } finally { dismissed = true; removers.forEach(remove => remove()); }
}

function openSharedCalculation(lift,viewer,onOpen){
 if (lift.rankSession?.length) return openStrengthLift(lift,{shared:true,onOpen});
 const {rank,bestSet:s}=lift;

 let off;
 return openSheet({title:exerciseDisplayName(lift.name)+(lift.attachment?' · '+attachmentLabel(lift):''),className:'strength-detail shared-rank-calculation',body:html`
  ${liftRankHeading(lift)}
  <p class="rank-next">${rank.next ? rank.lpToNext + ' LP to ' + rank.next.name : 'Highest tier reached'}</p>
  <h3 class="section-title">Workout used for rank · ${fmtShort(s.date)}</h3>
  <ol class="strength-history"><li><span>${s.paired ? 'Both sides' : 'Scoring set'}</span><b>${s.w} ${rank.unit} × ${s.r}</b></li></ol>
`,actions:[{label:'Done',value:true}],onMount:(sheet,close)=>{onOpen?.(close);paintStrength(sheet);off=listen('gym:account',()=>{if(account.user?.id!==viewer)close();});}}).finally(()=>off?.());
}
