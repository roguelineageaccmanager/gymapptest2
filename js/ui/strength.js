import {attachmentLabel} from '../domain/attachments.js';
import { bodyRegions } from '../domain/body-regions.js';
import { html, render, toast } from '../core/dom.js';
import { ymd, fmtShort } from '../core/dates.js';
import { refresh } from '../core/router.js';
import { listen } from '../core/store.js';
import { cleanHiddenStatsExercises } from '../domain/settings.js';
import { exerciseId } from '../domain/exercises.js';
import { state, saveSettings } from '../state.js';
import { account } from '../cloud/sync.js';
import { RANKS, MUSCLES, movement, rankSet, strengthStats } from '../domain/ranks.js';
import { isTimedCardioExercise } from '../domain/measurement.js';
import { searchMovements, movementFor, hasExplicitEquipment } from '../domain/movement-groups.js';
import { chooseMovementVersion } from './exercise-picker.js';
import { rankModelEntry } from '../domain/rank-models.js';
import { BODY_GEOMETRY, BACK_ANCHORS } from './body-geometry.js';
import { openSheet } from './sheet.js';
import { lineChart } from './graph.js';
import { icons } from './icons.js';

let rankObserver;
const observedRanks = new Set();
export function paintStrength(root) {
  if (typeof IntersectionObserver !== 'undefined') {
    rankObserver ||= new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('rank-in-view',entry.isIntersecting)));
    for (const node of observedRanks) if (!node.isConnected) { rankObserver.unobserve(node); observedRanks.delete(node); }
    root?.querySelectorAll('.strength-hero, .muscle-rank-card summary, .rank-ladder > div').forEach(node=>{ if (!observedRanks.has(node)) { observedRanks.add(node); rankObserver.observe(node); } });
  } else root?.querySelectorAll('.strength-hero, .muscle-rank-card summary, .rank-ladder > div').forEach(node=>node.classList.add('rank-in-view'));
  root?.querySelectorAll('[data-rank-color]').forEach(node => node.style.setProperty('--rank-color', node.dataset.rankColor));
  root?.querySelectorAll('[data-muscle-color]').forEach(node => node.style.setProperty('--muscle-color', node.dataset.muscleColor));
  root?.querySelectorAll('[data-rank-width]').forEach(node => { node.style.width = Math.max(0, Math.min(100, Number(node.dataset.rankWidth) || 0)) + '%'; });
}

const ladderName = rank => rank.index < 7 ? rank.name + ' 4 → 1' : rank.name;
const ladderPoints = rank => rank.index < 7 ? '100 LP / division' : rank.index === 7 ? '0–99 LP' : rank.index === 8 ? '100–199 LP' : '200+ LP';

const color = rank => rank?.color || 'var(--muted)';
// Original emblems: metal bars, chevrons, gems and crowns.
const RANK_MARKS = [
  'M24 19h16v6h-5v20h5v6H24v-6h5V25h-5Z',
  'm17 25 15 10 15-10v9L32 45 17 34Zm0-12 15 10 15-10v7L32 30 17 20Z',
  'm15 17 17 9 17-9v8L32 35l-17-10Zm0 18 17 10 17-10v8L32 53 15 43Z',
  'm15 24 10 7 7-15 7 15 10-7-4 23H19Zm7 27h20v5H22Z',
  'm32 13 13 20-13 23-13-23Zm0 10-6 10 6 12 6-12ZM9 26l9 5-3 14-6-6Zm46 0-9 5 3 14 6-6Z',
  'm23 15 18 0 12 18-12 21H23L11 33Zm3 7-7 11 7 14h12l7-14-7-11Zm6 3 6 9-6 10-6-10Z',
  'm20 17 24 0 11 15-23 25L9 32Zm3 6-6 7h10l5-7Zm14 0 5 7h7l-6-7ZM18 35l10 11-4-11Zm12 0 2 13 2-13Zm10 0-4 11 10-11Z',
  'm11 25 13 6 8-17 8 17 13-6-7 25H18Zm12 30h18v5H23Zm9-24 6 9-6 9-6-9Z',
  'm11 19 11 11 10-18 10 18 11-11-6 32H17Zm11 37h20v5H22Zm10-25 6 9-6 9-6-9Z',
  'm12 26 10 8 10-20 10 20 10-8-6 26H18Zm10 31h20v5H22Zm10-21 5 8-5 8-5-8Z',
];

export function rankBadge(rank, size = '') {
  const stage = rank?.division ? 5 - rank.division : 0;
  const evolution = ['', '', 'M12 48l8 6v5l-8-6Zm40 0-8 6v5l8-6Z', 'M7 43l12 9v6L7 49Zm50 0-12 9v6l12-9ZM17 57l9 5v4l-9-5Zm30 0-9 5v4l9-5Z', 'M2 38l16 12v7L2 45Zm60 0L46 50v7l16-12ZM12 55l13 8v5l-13-8Zm40 0-13 8v5l13-8ZM24 4l8-4 8 4-8 7Z'][stage];
  return html`<span class="rank-emblem ${size}" data-rank-division="${rank?.division || 'none'}" data-rank-color="${color(rank)}" data-rank-mark="${rank?.index ?? 'unranked'}" aria-hidden="true"><svg viewBox="0 0 64 72"><path class="emblem-wing" d="M2 19 17 23 17 45 6 38ZM62 19 47 23 47 45 58 38Z"/><path class="emblem-edge" d="m32 2 24 14v32L32 68 8 48V16Z"/><path class="emblem-face" d="m32 10 17 10v24L32 59 15 44V20Z"/><path class="emblem-shine" d="m32 10 17 10-17 39Z"/><path class="emblem-mark" fill-rule="evenodd" d="${RANK_MARKS[rank?.index] || 'M25 23q7-8 14 0 5 7-4 12v5h-6v-8q9-5 4-8-4-2-5 3ZM29 45h6v6h-6Z'}"/>${evolution ? html`<path class="emblem-evolution" d="${evolution}"/>` : ''}${stage ? html`<g class="emblem-division">${Array.from({length:stage},(_,i)=>html`<path d="M${32 - (stage-1)*4 + i*8} 59l3 3-3 3-3-3Z"/>`)}</g>` : ''}</svg></span>`;
}
export function rankMeter(rank) {
  return html`<div class="rank-progress" role="progressbar" aria-label="Progress to ${rank.next?.name || 'maximum rank'}" aria-valuenow="${rank.progress}" aria-valuemin="0" aria-valuemax="100"><span data-rank-width="${rank.progress}" data-rank-color="${color(rank)}"></span></div>`;
}
export function rankHero(stats) {
  const rank = stats.overall;
  return html`<section class="strength-hero " data-rank-color="${color(rank)}">
    ${rankBadge(rank, 'large')}<div class="strength-hero-main"><span class="eyebrow">YOUR STRENGTH RANK</span><h2>${rank?.name || 'Unranked'}${rank ? html`<small>${rank.lp} LP</small>` : ''}</h2>${rank ? rankMeter(rank) : html`<p>Complete a set after logging your body weight.</p>`}<small>${rank ? rank.next ? `${rank.lpToNext} LP to ${rank.next.name}` : 'Highest tier reached' : 'Your completed lifts build your rank.'}</small></div>
    </section>`;
}
const bodyGroups = { chest: 'chest', biceps: 'biceps', brachialis: 'biceps', triceps: 'triceps', forearm: 'forearms', brachioradialis: 'forearms', 'front-deltoids': 'shoulders', 'back-deltoids': 'shoulders', trapezius: 'traps', 'mid-back': 'midback', 'upper-back': 'lats', lats: 'lats', 'lower-back': 'lowerback', abs: 'abs', obliques: 'obliques', adductor: 'adductors', abductors: 'hips', gluteal: 'hips', hamstring: 'hamstrings', quadriceps: 'quads', calves: 'calves', 'left-soleus': 'calves', 'right-soleus': 'calves' };
// Original neutral silhouette joins the licensed muscle regions into one complete body.
const halfBody = 'M500 0C445 0 401 26 400 96L415 184Q425 223 449 241L421 301Q398 329 360 345L275 358Q215 364 196 410L187 485Q176 534 155 568L130 664 100 720Q58 766 43 838L0 995Q-7 1018-20 1035L-49 1087Q-54 1096-47 1100Q-40 1104-35 1095L-16 1064-35 1114Q-39 1125-31 1128Q-23 1131-19 1121L3 1076-12 1134Q-14 1144-6 1146Q2 1148 5 1138L22 1085 16 1130Q15 1140 23 1141Q31 1141 33 1132L44 1083Q48 1069 54 1061L69 1085Q75 1093 82 1088Q88 1083 82 1075L69 1045Q72 1037 77 1030L126 949Q177 886 211 803L237 708 293 585 314 683 336 783 333 886 299 950Q272 1001 257 1109L247 1275 257 1410 266 1506Q241 1571 211 1668L217 1851 204 1946 165 2004Q140 2031 167 2043L241 2048Q290 2046 293 2018L282 1954 316 1842Q362 1758 369 1660L369 1570 410 1410 455 1264 482 1130Q492 1100 500 1100Z';
function roundedMuscle(points) {
  const numbers = points.trim().split(/\s+/).map(Number), vertices = [];
  for (let i = 0; i < numbers.length; i += 2) vertices.push([numbers[i], numbers[i + 1]]);
  const near = (a, b) => { const distance = Math.hypot(b[0] - a[0], b[1] - a[1]); const t = Math.min(.18, 13 / (distance || 1)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t].map(x => x.toFixed(1)).join(' '); };
  return vertices.map((point, i) => `${i ? 'L' : 'M'}${near(point, vertices[(i + vertices.length - 1) % vertices.length])}Q${point.join(' ')} ${near(point, vertices[(i + 1) % vertices.length])}`).join(' ') + 'Z';
}
// Fit the posterior mesh to the same head, joints and feet as the original front.
function alignedBack(points) {
  return points.trim().split(/\s+/).map(Number).map((value,i)=>{
    if (!(i%2)) return value;
    const end=BACK_ANCHORS.findIndex(anchor=>anchor[0]>=value), hi=BACK_ANCHORS[Math.max(1,end)],lo=BACK_ANCHORS[Math.max(1,end)-1];
    return lo[1]+(value-lo[0])*(hi[1]-lo[1])/(hi[0]-lo[0]);
  }).join(' ');
}
function bodyFigure(side, stats, scope = 'original-body') {
  return html`<figure><svg class="rank-body" viewBox="-65 -15 1130 2090" role="group" aria-label="${side === 'front' ? 'Front' : 'Back'} muscle ranks"><defs><clipPath id="${scope}-${side}"><path d="${halfBody}"/><path d="${halfBody}" transform="translate(1000 0) scale(-1 1)"/></clipPath></defs><g class="body-outline"><path d="${halfBody}"/><path d="${halfBody}" transform="translate(1000 0) scale(-1 1)"/></g><g clip-path="url(#${scope}-${side})">${BODY_GEOMETRY[side].filter(part => part.muscle !== 'head').map(part => {
    const id = bodyGroups[part.muscle], muscle = stats.muscles.find(muscle => muscle.id === id);
    const label = ({'back-deltoids':'Rear delt',brachialis:'Brachialis (Biceps)',adductor:'Adductors',brachioradialis:'Brachioradialis (Forearms)'})[part.muscle] || muscle?.name || part.muscle;
    return html`<g class="body-muscle ${id ? 'interactive' : 'body-neutral'} ${muscle?.rank ? '' : 'unranked'}" data-region="${part.muscle}" data-muscle-color="${color(muscle?.rank)}"${id ? html` data-muscle="${id}" role="button" tabindex="0" aria-label="${label}: ${muscle.rank?.name || 'Unranked'}"` : ''}><title>${label}${muscle ? ': ' + (muscle.rank?.name || 'Unranked') : ''}</title>${part.points.map(points => html`<path d="${roundedMuscle(side === 'back' ? alignedBack(points) : points)}"/>`)}</g>`;
  })}</g></svg><figcaption>${side === 'front' ? 'FRONT' : 'BACK'}</figcaption></figure>`;
}
function exerciseRow(lift) {
  return html`<button type="button" class="rank-exercise" data-key="${lift.attachment?'setup-'+JSON.stringify([lift.name,lift.attachment]):'lift-'+lift.name}" data-strength-lift="${lift.name}" data-strength-setup="${lift.attachment||''}" data-rank-color="${color(lift.rank)}">${rankBadge(lift.rank, 'mini')}<span><b>${lift.name}${lift.attachment?' · '+attachmentLabel(lift):''}</b><small>${lift.bestSet ? `${lift.bestSet.w} kg × ${lift.bestSet.r} · ${fmtShort(lift.bestSet.date)}` : lift.timedSets ? `${lift.bestSeconds} s best hold · ${lift.sets} completed sets` : `${lift.sets} completed sets`}</small></span><span class="rank-exercise-result"><b>${lift.rank?.name || 'Unranked'}</b><small>${lift.rank ? lift.rank.lp + ' LP' : 'View history'}</small></span>${icons.chevron}</button>`;
}
export function bodygraphPanel(stats,{heading=true}={}) {
  stats = { ...stats, muscles: bodyRegions(stats) };
  return html`<section class="bodygraph-panel">${heading?html`<header class="strength-section-head"><h2>Ranked bodygraph</h2></header>`:''}<div class="bodygraph-figures">${bodyFigure('front', stats)}${bodyFigure('back', stats)}</div></section>
    <header class="strength-section-head"><h2>Muscle rankings</h2><small>${stats.muscles.filter(m => m.rank).length} / ${stats.muscles.length}</small></header>
    <div class="muscle-rankings">${stats.muscles.map(muscle => html`<details class="muscle-rank-card " data-rank-muscle="${muscle.id}" data-rank-color="${color(muscle.rank)}"><summary>${rankBadge(muscle.rank)}<span class="muscle-rank-name"><b>${muscle.name}</b><strong>${muscle.rank?.name || 'Unranked'}</strong></span><span class="muscle-rank-score">${muscle.rank ? muscle.rank.lp + ' LP' : '—'}</span>${icons.chevron}</summary><div class="muscle-rank-body">${muscle.rank ? html`${rankMeter(muscle.rank)}<div class="rank-next"><span>${muscle.rank.lp} LP</span><span>${muscle.rank.next?.name || 'Maximum rank'}</span></div>` : ''}${muscle.exercises.length ? muscle.exercises.map(exerciseRow) : html`<p class="muted small">No completed ${muscle.name.toLowerCase()} sets yet.</p>`}</div></details>`)}</div>`;
}
export function yourRankPanel(stats, calculatorOpen = false) {
  const ranked = stats.muscles.filter(muscle => muscle.rank), best = [...ranked].sort((a, b) => b.rank.score - a.rank.score)[0];
  return html`<div class="rank-overview">${rankHero(stats)}</div><details class="rank-calculator-drawer card"${calculatorOpen ? html` open` : ''}><summary data-open-calculator>Rank calculator<span>Preview a lift ${icons.chevron}</span></summary>${calculatorPanel()}</details><div class="strength-metrics rank-coverage"><div><b>${ranked.length}<small> / ${MUSCLES.length}</small></b><span>Ranked muscles</span></div><div><b>${stats.ranked}</b><span>Ranked exercises</span></div><div><b>${best?.name || '—'}</b><span>Strongest muscle</span></div></div><section class="card"><header class="strength-section-head"><h2>Strength score over time</h2></header>${stats.history.length ? lineChart(stats.history.slice(-60), { unit: 'score', label: 'Overall strength score over time' }) : html`<p class="muted small">Complete ranked sets to start your strength history.</p>`}</section><header class="strength-section-head"><h2>The rank ladder</h2></header><div class="rank-ladder">${RANKS.map(rank => html`<div class="${stats.overall?.id === rank.id ? 'current' : ''}" data-rank-color="${color(rank)}">${rankBadge(stats.overall?.id === rank.id ? stats.overall : rank)}<b>${stats.overall?.id === rank.id ? stats.overall.name : ladderName(rank)}</b><span>${ladderPoints(rank)}</span>${stats.overall?.id === rank.id ? html`<small>YOU</small>` : ''}</div>`)}</div>`;
}
export function exerciseRankingList(stats, query = '') {
  const lifts = stats.exercises.filter(lift => (lift.name+' '+attachmentLabel(lift)).toLowerCase().includes(query.toLowerCase()));
  return html`<div class="strength-lift-list">${lifts.length ? lifts.map(exerciseRow) : html`<p class="empty-inline">${query ? 'No matching exercises.' : 'Your completed exercises appear here.'}</p>`}</div>`;
}
function setStatsExerciseHidden(name, hidden) {
  const list=cleanHiddenStatsExercises(state.settings.hiddenStatsExercises).filter(item=>exerciseId(item)!==exerciseId(name));
  if(hidden&&list.length>=200){toast('You can hide up to 200 exercises.');return false;}
  state.settings.hiddenStatsExercises=hidden?cleanHiddenStatsExercises([...list,name]):list;
  saveSettings();refresh('stats');return true;
}
export function showHiddenStatsExercises() {
  const owner=account.user?.id,list=cleanHiddenStatsExercises(state.settings.hiddenStatsExercises);let off;
  return openSheet({title:'Hidden exercises',body:html`<div class="hidden-stats-exercises">${list.map((name,index)=>html`<div class="row"><b class="grow">${name}</b><button type="button" class="btn btn-soft btn-sm" data-restore-stats="${index}" aria-label="Restore ${name}">Restore</button></div>`)}</div>`,actions:[{label:'Done',value:true}],onMount(sheet,close){
    off=listen('gym:account',()=>{if(owner!==account.user?.id)close();});
    sheet.addEventListener('click',event=>{const button=event.target.closest('[data-restore-stats]');if(!button||owner!==account.user?.id)return;setStatsExerciseHidden(list[Number(button.dataset.restoreStats)],false);close();toast('Restored to Stats.');});
  }}).finally(()=>off?.());
}

function unrankedReason(lift, onlyTimed) {
  if (onlyTimed) return isTimedCardioExercise(lift.name) ? 'Cardio tracks duration and does not earn strength LP.' : 'Timed holds track duration and do not earn strength LP.';
  if (!lift.active) return 'Add this exact setup to a routine assigned to your weekly plan to earn LP.';
  const model = movement(lift.name, state.workouts);
  if (!model.reference) return 'This exercise does not have a strength benchmark yet.';
  if (!lift.hasRankReps) return 'Complete a working set with 1–12 reps.';
  if (!lift.hasRankWeight) return 'Log your body weight on or before a qualifying set.';
  if (model.unilateral) return 'Complete both sides in the same set pair with 1–12 reps and a qualifying load.';
  return 'Complete a set with a qualifying load and 1–12 reps.';
}

export async function openStrengthLift(name,attachment='') {
  const owner=account.user?.id;let off;
  const lift = strengthStats(state.logs, state.weights, state.workouts, ymd(), state.schedule, state.settings.hiddenStatsExercises || []).exercises.find(lift => lift.name === name&&(lift.attachment||'')===attachment);
  if (!lift) return;
  const onlyTimed = lift.timedSets > 0 && lift.timedSets === lift.sets;
  const cardio = isTimedCardioExercise(lift.name);
  const result=await openSheet({ title: lift.name+(lift.attachment?' · '+attachmentLabel(lift):''), className: 'strength-detail', onMount(sheet,close){paintStrength(sheet);off=listen('gym:account',()=>{if(owner!==account.user?.id)close();});}, body: html`
    <div class="lift-rank-heading" data-rank-color="${color(lift.rank)}">${rankBadge(lift.rank, 'large')}<div><span class="eyebrow">EXERCISE RANK</span><h3>${lift.rank?.name || 'Unranked'}</h3><b>${lift.rank ? lift.rank.lp + ' LP' : 'Completed sets only'}</b></div></div>
    ${lift.rank ? html`${rankMeter(lift.rank)}<p class="rank-next">${lift.rank.next ? lift.rank.lpToNext + ' LP to ' + lift.rank.next.name : 'Highest tier reached'}</p>` : html`<p class="muted small">${unrankedReason(lift, onlyTimed)}</p>`}
    <div class="strength-metrics"><div><b>${onlyTimed ? lift.bestSeconds : Math.round(lift.max * 10) / 10 || '—'}<small>${onlyTimed ? ' s' : ' kg'}</small></b><span>${onlyTimed ? cardio ? 'Longest interval' : 'Longest hold' : 'Equivalent 1RM'}</span></div>${!(onlyTimed && cardio) ? html`<div><b>${onlyTimed ? lift.timedBestWeight : lift.best}<small> kg</small></b><span>${onlyTimed ? 'Added weight' : 'Heaviest weight'}</span></div>` : ''}<div><b>${lift.sets}</b><span>Completed sets</span></div></div>
    ${lift.timedSets ? html`<h3 class="section-title">${cardio ? 'Cardio duration' : 'Hold duration'}</h3>${lineChart(lift.timedPoints.slice(-60), {unit:'s',label:lift.name+' duration'})}<ol class="strength-history">${lift.timedPoints.slice(-12).reverse().map(point=>html`<li><time datetime="${point.date}">${fmtShort(point.date)}</time><b>${point.w} s</b></li>`)}</ol>` : ''}
    ${lift.points.length ? lineChart(lift.points.slice(-60), { label: lift.name + ' equivalent 1RM' }) : ''}
    ${onlyTimed ? '' : html`<h3 class="section-title">Recent rep sessions</h3><ol class="strength-history">${lift.points.slice(-12).reverse().map(point => html`<li><time datetime="${point.date}">${fmtShort(point.date)}</time><b>${point.w} kg <small>e1RM</small></b></li>`)}</ol>`}
    ${lift.rank ? html`<p class="muted small">Reference: ${lift.rank.reference} × body weight. ${lift.rank.source?html`<a href="${lift.rank.source}" target="_blank" rel="noopener noreferrer">Lifting-data reference</a>`:'Estimated movement target; machine resistance varies.'}</p>`:''}
    ${lift.bestSet ? html`<p class="muted small">${lift.bestSet.w} ${lift.rank.unit} × ${lift.bestSet.r}${lift.bestSet.paired ? ' · weaker side' : ''}</p>` : ''}`,
    actions: [{label:'Remove from Stats',value:'hide',tone:'ghost'},{ label: 'Done', value: true }],
  }).finally(()=>off?.());
  if(result==='hide' && owner===account.user?.id&&setStatsExerciseHidden(lift.name,true)){toast('Removed from Stats.',{action:{label:'Undo',onClick:()=>{if(owner===account.user?.id)setStatsExerciseHidden(lift.name,false);}}});}
}
export function showRankInfo() {
  return openSheet({title:'Rank order',onMount:paintStrength,body:html`<div class="rank-guide">${RANKS.map(rank=>html`<div data-rank-color="${color(rank)}">${rankBadge(rank,'mini')}<b>${ladderName(rank)}</b><span>${ladderPoints(rank)}</span></div>`)}</div><p class="muted small">100 LP per division. Working sets only; paired sides use the weaker side. Overall rank averages trained muscle groups. Game benchmarks; machines vary.</p>`,actions:[{label:'Done',value:true}]});
}
export function calculatorPanel() {
  const bodyweight = [...state.weights].filter(w => w.date <= ymd()).at(-1)?.weight || '';
  return html`<section class="rank-calculator card"><header class="strength-section-head"><h2>Rank calculator</h2><button type="button" class="rank-help" data-rank-info aria-label="How ranks work">?</button></header><form id="rankCalculator"><label for="rankMovementName">Exercise</label><input type="hidden" name="exercise" value="Barbell Bench Press"><button type="button" id="rankMovementName" class="rank-movement-picker input" data-pick-rank-exercise><span>Barbell Bench Press</span>${icons.chevron}</button><div class="rank-calculator-fields"><label>Body weight <span>kg</span><input class="input" type="number" name="bodyweight" inputmode="decimal" min="20" max="350" step="0.1" value="${bodyweight}" required></label><label>Weight <span data-rank-unit>kg total</span><input class="input" type="number" name="weight" inputmode="decimal" min="0" max="2000" step="0.1" placeholder="0" required></label><label>Reps<input class="input" type="number" name="reps" inputmode="numeric" min="1" max="12" step="1" value="1" required></label></div><button type="submit" class="btn btn-primary btn-block">Calculate rank</button><div id="rankCalculatorResult" aria-live="polite"></div></form></section>`;
}
export async function pickRankExercise(form) {
  const owner = account.user?.id;
  const customs = [...new Set(Object.values(state.workouts).flatMap(list=>list.map(e=>e.name)))].filter(name=>!rankModelEntry(name) && movement(name,state.workouts).reference);
  let query='';
  const options = query => html`${searchMovements(query).filter(item => item.movement.variants.some(v => movement(v.name).reference)).slice(0,60).map(item => html`<button type="button" data-rank-choice="${item.name}">${item.displayName}${icons.chevron}</button>`)}${customs.filter(name=>name.toLowerCase().includes(query.toLowerCase())).slice(0,20).map(name=>html`<button type="button" data-rank-choice="${name}">${name}${icons.chevron}</button>`)}`;
  let name = await openSheet({ title: 'Choose exercise', className: 'rank-exercise-picker', body: html`<label class="sr-only" for="rankExerciseSearch">Search exercises</label><input id="rankExerciseSearch" class="input" type="search" placeholder="Search exercises" autocomplete="off"><div class="rank-pick-list">${options('')}</div>`, onMount: (sheet, finish) => {
    sheet.querySelector('input').addEventListener('input', event => render(sheet.querySelector('.rank-pick-list'), options(query=event.target.value)));
    sheet.addEventListener('click', event => { const button = event.target.closest('[data-rank-choice]'); if (button) finish(button.dataset.rankChoice); });
  } });
  if (!name || account.user?.id !== owner || !form.isConnected) return;
  const group=movementFor(name);
  if(group){
    const preferred=group.variants.find(e=>e.name===name)||group.variants[0];
    const exact=group.variants.some(e=>exerciseId(e.name)===exerciseId(query));
    const picked=await chooseMovementVersion(form.querySelector('[data-pick-rank-exercise]'),group,preferred,!exact&&!hasExplicitEquipment(query,preferred),'All equipment',e=>!!movement(e.name).reference);
    if(!picked||account.user?.id!==owner||!form.isConnected)return;
    name=picked.name;
  }
  form.querySelector('[name=exercise]').value = name;
  form.querySelector('[data-rank-unit]').textContent = movement(name,state.workouts).unit;
  form.querySelector('[data-pick-rank-exercise] span').textContent = name;
  render(document.getElementById('rankCalculatorResult'), '');
}
export function calculateRank(form) {
  const values = new FormData(form), name = String(values.get('exercise'));
  const rank = rankSet(name, Number(values.get('weight')), Number(values.get('reps')), Number(values.get('bodyweight')), state.workouts);
  const result = document.getElementById('rankCalculatorResult');
  render(result, rank ? html`<div class="calculator-result" data-rank-color="${color(rank)}">${rankBadge(rank, 'large')}<h3>${rank.name}</h3><b>${rank.lp} LP</b>${rankMeter(rank)}<p>${rank.max} kg equivalent 1RM · ${rank.ratio.toFixed(2)}× body weight</p></div>` : html`<p class="form-error">Use a supported exercise, body weight of 20–350 kg and 1–12 reps.</p>`);
  paintStrength(result);
}
