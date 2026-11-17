import {sharedRankSnapshot,sharedRankStats} from '../domain/shared-ranks.js';
import {bodygraphPanel,exerciseRankingList,rankBadge,paintStrength,rankMeter} from './strength.js';
import { strengthStats, rankText } from '../domain/ranks.js';
import { html, render } from '../core/dom.js';
import { listen } from '../core/store.js';
import { fmtShort, ymd } from '../core/dates.js';
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
  const strength=strengthStats(state.logs,state.weights,state.workouts,ymd(),state.schedule,state.settings.hiddenStatsExercises||[]);
  return { user_id: id, username: account.profile?.username || 'you', ...leaderboardStats(state.logs),rank_score:strength.overall?.score??null,rank_details:sharedRankSnapshot(strength,true),
    current_streak: st.current, best_streak: st.best, weight_kg: weight?.weight, weight_date: weight?.date,
    routines: Object.keys(state.workouts).length, exercises: Object.values(state.workouts).reduce((n, list) => n + list.length, 0),
    exercise_bests: Object.fromEntries(exerciseNames(state.logs).map(name => [name, bestWeight(state.logs, name)])) };
}
function profileBody(row) {
  const ranks=sharedRankStats(row.rank_details),strengthScore=ranks?ranks.overall?.score:row.rank_score;
  const cells = [
    ['Workouts', number(row.workouts_count)], ['Training time', duration(row.total_seconds)],
    ['Strength rank', strengthScore == null ? 'Unranked' : rankText(strengthScore)], ['Current streak', number(row.current_streak, ' days')],
    ['Best streak', number(row.best_streak, ' days')], ['Latest weight', number(row.weight_kg, ' kg')],
    ['Routines', number(row.routines)], ['Exercises', number(row.exercises)],
  ];
  const bests = Object.entries(row.exercise_bests || {}).filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0).sort(([a], [b]) => a.localeCompare(b));
  return html`<div class="member-profile">
    ${bannerMarkup(row.user_id, 'profile-hero-banner')}
    <div class="profile-identity">${profileAvatar(row.username, 'lg', row.user_id)}<h3>@${row.username}</h3></div>
    ${row.workouts_count == null ? html`<p class="muted small profile-sharing-note">Workout stats aren’t shared yet.</p>` : ''}
    <dl class="profile-stats">${cells.map(([label, value]) => html`<div><dt>${label}</dt><dd>${value}</dd>${label === 'Latest weight' && /^\d{4}-\d{2}-\d{2}$/.test(row.weight_date || '') ? html`<small class="muted">${fmtShort(row.weight_date)}</small>` : ''}</div>`)}</dl>
    ${ranks ? html`<section class="profile-shared-ranks" aria-label="Shared strength ranks">
      <h3 class="profile-section-title">Shared ranks</h3>
      ${/^\d{4}-\d{2}-\d{2}T/.test(row.rank_details?.calculated_at||'') ? html`<p class="muted small">Shared ${fmtShort(row.rank_details.calculated_at.slice(0,10))}</p>` : ''}
      ${ranks.overall ? html`<div class="profile-overall-rank" data-rank-color="${ranks.overall.color}">${rankBadge(ranks.overall)}<b>${rankText(ranks.overall.score)}</b></div>` : html`<p class="muted small">No qualifying ranked sets yet.</p>`}
      <details class="profile-rank-graph" open><summary>Body graph &amp; muscle ranks</summary>${bodygraphPanel(ranks)}</details>
      <h3 class="profile-section-title">Exercise ranks</h3>${exerciseRankingList(ranks)}
    </section>` : html`<p class="muted small">${row.rank_schema_missing?'Detailed ranks aren’t available in this preview yet.':row.workouts_count==null?'Ranks and body graph are available when your friend shares scores.':'Detailed ranks and body graph will appear after this member updates their scores with the latest app.'}</p>`}
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
            let row = userId === viewer ? ownSummary(viewer) : await loadMemberProfile(userId);
            await Promise.all([loadProfilePictures([userId]), loadProfileBanners([userId])]);
            if (!row) {
              const members = await loadChatProfiles([userId]);
              const member = members.find(m => m.user_id === userId);
              if (member) row = { user_id: userId, username: member.username };
            }
            if (dismissed || !sheet.isConnected || account.user?.id !== viewer) return;
            render(body, row ? profileBody(row) : html`<p class="muted">This profile is no longer available.</p>`);
            displayedRanks=sharedRankStats(row?.rank_details);
            if(!displayedRanks?.exercises.some(e=>e.name===openLiftName))closeCalculation?.();
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
          if(button&&account.user?.id===viewer){const lift=displayedRanks?.exercises.find(e=>e.name===button.dataset.strengthLift);if(lift)openSharedCalculation(lift,viewer,close=>{closeCalculation=close;openLiftName=lift.name;});}
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
 const {rank,bestSet:s}=lift;
 let off;
 return openSheet({title:lift.name,className:'shared-rank-calculation',body:html`
  <div class="profile-overall-rank" data-rank-color="${rank.color}">${rankBadge(rank,'large')}<b>${rankText(rank.score)}</b></div>${rankMeter(rank)}
  <dl class="profile-stats"><div><dt>Qualifying set</dt><dd>${s.w} ${rank.unit} × ${s.r}${s.paired?' · weaker side':''}</dd></div><div><dt>Completed</dt><dd>${fmtShort(s.date)}</dd></div>
  <div><dt>Equivalent 1RM</dt><dd>${rank.max==null?'Not shared':number(rank.max,' kg')}</dd></div><div><dt>Reference target</dt><dd>${rank.reference} × body weight</dd></div></dl>
  <p class="muted small">${rank.mode==='load'?`${s.w} × ${rank.multiplier} = ${s.w*rank.multiplier} kg normalized load.`:s.bodyweight?`Added load plus ${s.bodyweight} kg body weight, adjusted for the movement.`:'Set body weight isn’t included in shared ranks; the calculation uses the member’s logged body weight.'}</p>
  <p class="muted small">${s.r===1?'One rep uses the actual normalized load.':`Estimated 1RM = normalized load × (1 + ${s.r}/30).`} Score = estimated 1RM ÷ body weight ÷ reference target × 300, capped at 999.</p>
  ${s.bodyweight?html`<p class="muted small">Body weight for this set: ${s.bodyweight} kg.</p>`:''}
  <p class="muted small">Working sets only. Paired arms use the weaker side. Overall rank averages trained muscle groups. Game benchmarks; machines vary.</p>`,actions:[{label:'Done',value:true}],onMount:(sheet,close)=>{onOpen?.(close);paintStrength(sheet);off=listen('gym:account',()=>{if(account.user?.id!==viewer)sheet.querySelector('[data-sheet-close]')?.click();});}}).finally(()=>off?.());
}
