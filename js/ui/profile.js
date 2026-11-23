import {attachmentLabel} from '../domain/attachments.js';
import {exerciseDisplayName} from '../domain/exercises.js';
import {rankSetupKey} from '../domain/ranks.js';
import {announcementAdmin,loadAnnouncementRole} from '../cloud/announcements.js';
import {sharedRankSnapshot,sharedRankStats} from '../domain/shared-ranks.js';
import {bodygraphPanel,openStrengthLift,liftRankHeading,rankBadge,paintStrength} from './strength.js';
import { strengthStats, rankText } from '../domain/ranks.js';
import { html, render } from '../core/dom.js';
import { listen } from '../core/store.js';
import { fmtShort, ymd } from '../core/dates.js';
import { account } from '../cloud/sync.js';
import { loadMemberProfile, loadProfileBanners } from '../cloud/profile-banners.js';
import { loadProfilePictures } from '../cloud/profile-pictures.js';
import { state, streaks } from '../state.js';
import { leaderboardStats } from '../domain/logs.js';
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
  const strength=strengthStats(state.logs,state.weights,state.workouts,ymd(),state.schedule,state.settings.hiddenStatsExercises||[]);
  return { user_id: id, username: account.profile?.username || 'you', ...leaderboardStats(state.logs),rank_score:strength.overall?.score??null,rank_details:sharedRankSnapshot(strength),
    current_streak: st.current, best_streak: st.best, weight_kg: weight?.weight, weight_date: weight?.date,
    admin:announcementAdmin(),routines: Object.keys(state.workouts).length, exercises: Object.values(state.workouts).reduce((n, list) => n + list.length, 0) };
}
function profileBody(row, ranks) {
  const strengthScore = ranks ? ranks.overall?.score : row.rank_score;
  const cells = [
    ['Workouts', number(row.workouts_count)], ['Training time', duration(row.total_seconds)],
    ['Strength rank', strengthScore == null ? 'Unranked' : rankText(strengthScore)], ['Current streak', number(row.current_streak, ' days')],
    ['Best streak', number(row.best_streak, ' days')], ['Latest weight', number(row.weight_kg, ' kg')],
    ['Routines', number(row.routines)], ['Exercises', number(row.exercises)],
  ];
  return html`<div class="member-profile">
    ${bannerMarkup(row.user_id, 'profile-hero-banner')}
    <div class="profile-identity">${profileAvatar(row.username, 'lg', row.user_id)}<h3>@${row.username}${row.admin?html`<span class="role-badge">Admin</span>`:''}</h3></div>
    ${row.workouts_count == null && !ranks && !row.rank_details_failed ? html`<p class="muted small profile-sharing-note">Scores not shared.</p>` : ''}
    ${ranks ? html`<section class="profile-shared-ranks" aria-label="Shared strength ranks">
      ${ranks.overall ? html`<div class="profile-overall-rank" data-rank-color="${ranks.overall.color}">${rankBadge(ranks.overall)}<b>${rankText(ranks.overall.score)}</b></div>` : html`<p class="muted small">No qualifying ranked sets yet.</p>`}
      <details class="profile-rank-graph" open><summary>Body graph</summary>${bodygraphPanel(ranks,{heading:false})}</details>
    </section>` : row.rank_details_failed ? html`<p class="muted small">Could not load the body graph. <button type="button" class="link-btn inline" data-retry-profile>Try again</button></p>`
      : row.workouts_count != null ? html`<p class="muted small">No shared body graph yet. It appears after your friend syncs from an updated app.</p>` : ''}
    <dl class="profile-stats">${cells.map(([label, value]) => html`<div><dt>${label}</dt><dd>${value}</dd>${label === 'Latest weight' && /^\d{4}-\d{2}-\d{2}$/.test(row.weight_date || '') ? html`<small class="muted">${fmtShort(row.weight_date)}</small>` : ''}</div>`)}</dl>
  </div>`;
}

export async function openMemberProfile(userId, { removeFriend } = {}) {
  const viewer = account.user?.id;
  if (!viewer || !account.ready || !/^[0-9a-f-]{36}$/i.test(userId)) return;
  const removers = [];
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
            render(body, row ? profileBody(row, displayedRanks) : html`<p class="muted">This profile is no longer available.</p>`);
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
