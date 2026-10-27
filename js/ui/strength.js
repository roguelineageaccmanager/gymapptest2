import { html, render } from '../core/dom.js';
import { ymd, fmtShort } from '../core/dates.js';
import { state } from '../state.js';
import { account } from '../cloud/sync.js';
import { RANKS, MUSCLES, movement, rankSet, strengthStats } from '../domain/ranks.js';
import { CATALOG } from '../domain/catalog.js';
import { BODY_GEOMETRY } from './body-geometry.js';
import { openSheet } from './sheet.js';
import { lineChart } from './graph.js';
import { icons } from './icons.js';

export function paintStrength(root) {
  root?.querySelectorAll('[data-rank-color]').forEach(node => node.style.setProperty('--rank-color', node.dataset.rankColor));
  root?.querySelectorAll('[data-muscle-color]').forEach(node => node.style.setProperty('--muscle-color', node.dataset.muscleColor));
  root?.querySelectorAll('[data-rank-width]').forEach(node => { node.style.width = Math.max(0, Math.min(100, Number(node.dataset.rankWidth) || 0)) + '%'; });
}

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
  return html`<span class="rank-emblem ${size}" data-rank-color="${color(rank)}" data-rank-mark="${rank?.index ?? 'unranked'}" aria-hidden="true"><svg viewBox="0 0 64 72"><path class="emblem-wing" d="M2 19 17 23 17 45 6 38ZM62 19 47 23 47 45 58 38Z"/><path class="emblem-edge" d="m32 2 24 14v32L32 68 8 48V16Z"/><path class="emblem-face" d="m32 10 17 10v24L32 59 15 44V20Z"/><path class="emblem-shine" d="m32 10 17 10-17 39Z"/><path class="emblem-mark" fill-rule="evenodd" d="${RANK_MARKS[rank?.index] || 'M25 23q7-8 14 0 5 7-4 12v5h-6v-8q9-5 4-8-4-2-5 3ZM29 45h6v6h-6Z'}"/></svg></span>`;
}
export function rankMeter(rank) {
  return html`<div class="rank-progress" role="progressbar" aria-label="Progress to ${rank.next?.name || 'maximum rank'}" aria-valuenow="${rank.progress}" aria-valuemin="0" aria-valuemax="100"><span data-rank-width="${rank.progress}" data-rank-color="${color(rank)}"></span></div>`;
}
export function rankHero(stats) {
  const rank = stats.overall;
  return html`<section class="strength-hero " data-rank-color="${color(rank)}">
    ${rankBadge(rank, 'large')}<div class="strength-hero-main"><span class="eyebrow">YOUR STRENGTH RANK</span><h2>${rank?.name || 'Unranked'}${rank ? html`<small>${rank.score} RP</small>` : ''}</h2>${rank ? rankMeter(rank) : html`<p>Complete a set after logging your body weight.</p>`}<small>${rank ? rank.next ? `${100 - rank.progress} RP to ${rank.next.name}` : 'Highest tier reached' : 'Your completed lifts build your rank.'}</small></div>
    <button type="button" class="rank-help" data-rank-info aria-label="How ranks work">?</button></section>`;
}
const bodyGroups = { chest: 'chest', biceps: 'biceps', triceps: 'triceps', forearm: 'forearms', 'front-deltoids': 'shoulders', 'back-deltoids': 'shoulders', trapezius: 'back', 'upper-back': 'back', 'lower-back': 'lowerback', abs: 'abs', obliques: 'abs', adductor: 'hips', abductors: 'hips', gluteal: 'hips', hamstring: 'hamstrings', quadriceps: 'quads', calves: 'calves', 'left-soleus': 'calves', 'right-soleus': 'calves' };
// Original neutral silhouette joins the licensed muscle regions into one complete body.
const halfBody = 'M500 0C445 0 401 26 400 96L415 184Q425 223 449 241L421 301Q398 329 360 345L275 358Q215 364 196 410L187 485Q176 534 155 568L130 664 100 720Q58 766 43 838L0 995-34 1039Q-53 1064-33 1074L-8 1056-19 1092Q-12 1110 4 1095L33 1059 20 1106Q30 1120 44 1096L77 1030 126 949Q177 886 211 803L237 708 293 585 314 683 336 783 333 886 299 950Q272 1001 257 1109L247 1275 257 1410 266 1506Q241 1571 211 1668L217 1851 204 1946 165 2004Q140 2031 167 2043L241 2048Q290 2046 293 2018L282 1954 316 1842Q362 1758 369 1660L369 1570 410 1410 455 1264 482 1130Q492 1100 500 1100Z';
function roundedMuscle(points) {
  const numbers = points.trim().split(/\s+/).map(Number), vertices = [];
  for (let i = 0; i < numbers.length; i += 2) vertices.push([numbers[i], numbers[i + 1]]);
  const near = (a, b) => { const distance = Math.hypot(b[0] - a[0], b[1] - a[1]); const t = Math.min(.18, 13 / (distance || 1)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t].map(x => x.toFixed(1)).join(' '); };
  return vertices.map((point, i) => `${i ? 'L' : 'M'}${near(point, vertices[(i + vertices.length - 1) % vertices.length])}Q${point.join(' ')} ${near(point, vertices[(i + 1) % vertices.length])}`).join(' ') + 'Z';
}
function bodyFigure(side, stats) {
  return html`<figure><svg class="rank-body" viewBox="-65 -15 1130 ${side === 'front' ? '2090' : '2310'}" role="group" aria-label="${side === 'front' ? 'Front' : 'Back'} muscle ranks"><g class="body-outline" transform="${side === 'front' ? 'scale(1)' : 'scale(1 1.1)'}"><path d="${halfBody}"/><path d="${halfBody}" transform="translate(1000 0) scale(-1 1)"/></g>${BODY_GEOMETRY[side].filter(part => part.muscle !== 'head').map(part => {
    const id = bodyGroups[part.muscle], muscle = stats.muscles.find(muscle => muscle.id === id);
    return html`<g class="body-muscle ${id ? 'interactive' : 'body-neutral'}" data-muscle-color="${color(muscle?.rank)}"${id ? html` data-muscle="${id}" role="button" tabindex="0" aria-label="${muscle.name}: ${muscle.rank?.name || 'Unranked'}"` : ''}><title>${muscle?.name || part.muscle}${muscle ? ': ' + (muscle.rank?.name || 'Unranked') : ''}</title>${part.points.map(points => html`<path d="${roundedMuscle(points)}"/>`)}</g>`;
  })}</svg><figcaption>${side === 'front' ? 'FRONT' : 'BACK'}</figcaption></figure>`;
}
function exerciseRow(lift) {
  return html`<button type="button" class="rank-exercise" data-key="lift-${lift.name}" data-strength-lift="${lift.name}" data-rank-color="${color(lift.rank)}">${rankBadge(lift.rank, 'mini')}<span><b>${lift.name}</b><small>${lift.bestSet ? `${lift.bestSet.w} kg × ${lift.bestSet.r} · ${fmtShort(lift.bestSet.date)}` : `${lift.sets} completed sets`}</small></span><span class="rank-exercise-result"><b>${lift.rank?.name || 'Unranked'}</b><small>${lift.rank ? lift.rank.score + ' RP' : 'View history'}</small></span>${icons.chevron}</button>`;
}
export function bodygraphPanel(stats) {
  return html`<section class="bodygraph-panel"><header class="strength-section-head"><h2>Ranked bodygraph</h2><button type="button" class="link-btn" data-rank-info aria-label="Rank order and information">${icons.info || 'ⓘ'}</button></header><div class="bodygraph-figures">${bodyFigure('front', stats)}${bodyFigure('back', stats)}</div></section>
    <header class="strength-section-head"><h2>Muscle rankings</h2><small>${stats.muscles.filter(m => m.rank).length} / ${MUSCLES.length}</small></header>
    <div class="muscle-rankings">${stats.muscles.map(muscle => html`<details class="muscle-rank-card " data-rank-muscle="${muscle.id}" data-rank-color="${color(muscle.rank)}"><summary>${rankBadge(muscle.rank)}<span class="muscle-rank-name"><b>${muscle.name}</b><strong>${muscle.rank?.name || 'Unranked'}</strong></span><span class="muscle-rank-score">${muscle.rank ? muscle.rank.score + ' RP' : '—'}</span>${icons.chevron}</summary><div class="muscle-rank-body">${muscle.rank ? html`${rankMeter(muscle.rank)}<div class="rank-next"><span>${muscle.rank.progress} / 100 RP</span><span>${muscle.rank.next?.name || 'Maximum rank'}</span></div>` : ''}${muscle.exercises.length ? muscle.exercises.map(exerciseRow) : html`<p class="muted small">No completed ${muscle.name.toLowerCase()} sets yet.</p>`}</div></details>`)}</div>`;
}
export function yourRankPanel(stats) {
  const ranked = stats.muscles.filter(muscle => muscle.rank), best = [...ranked].sort((a, b) => b.rank.score - a.rank.score)[0];
  return html`<div class="rank-overview">${rankHero(stats)}</div><div class="strength-metrics rank-coverage"><div><b>${ranked.length}<small> / ${MUSCLES.length}</small></b><span>Ranked muscles</span></div><div><b>${stats.ranked}</b><span>Ranked exercises</span></div><div><b>${best?.name || '—'}</b><span>Strongest muscle</span></div></div><section class="card"><header class="strength-section-head"><h2>Strength over time</h2></header>${stats.history.length ? lineChart(stats.history.slice(-60), { unit: 'RP', label: 'Overall strength rank over time' }) : html`<p class="muted small">Complete ranked sets to start your strength history.</p>`}</section><header class="strength-section-head"><h2>The rank ladder</h2><button type="button" class="rank-help" data-rank-info aria-label="How ranks work">?</button></header><div class="rank-ladder">${RANKS.map(rank => html`<div class="${stats.overall?.id === rank.id ? 'current' : ''}" data-rank-color="${color(rank)}">${rankBadge(rank)}<b>${rank.name}</b><span>${rank.index * 100}${rank.index === RANKS.length - 1 ? '+' : '–' + (rank.index * 100 + 99)} RP</span>${stats.overall?.id === rank.id ? html`<small>YOU</small>` : ''}</div>`)}</div>`;
}
export function exerciseRankingList(stats, query = '') {
  const lifts = stats.exercises.filter(lift => lift.name.toLowerCase().includes(query.toLowerCase()));
  return html`<div class="strength-lift-list">${lifts.length ? lifts.map(exerciseRow) : html`<p class="empty-inline">${query ? 'No matching exercises.' : 'Your completed exercises appear here.'}</p>`}</div>`;
}
export function openStrengthLift(name) {
  const lift = strengthStats(state.logs, state.weights, state.workouts, ymd()).exercises.find(lift => lift.name === name);
  if (!lift) return;
  return openSheet({ title: lift.name, className: 'strength-detail', onMount: paintStrength, body: html`
    <div class="lift-rank-heading" data-rank-color="${color(lift.rank)}">${rankBadge(lift.rank, 'large')}<div><span class="eyebrow">EXERCISE RANK</span><h3>${lift.rank?.name || 'Unranked'}</h3><b>${lift.rank ? lift.rank.score + ' RP' : 'Completed sets only'}</b></div></div>
    ${lift.rank ? html`${rankMeter(lift.rank)}<p class="rank-next">${lift.rank.next ? 100 - lift.rank.progress + ' RP to ' + lift.rank.next.name : 'Highest tier reached'}</p>` : html`<p class="muted small">Ranks need body weight logged on or before a completed set of 1–12 reps. Assisted, timed and unsupported exercises keep their history without a strength rank.</p>`}
    <div class="strength-metrics"><div><b>${Math.round(lift.max * 10) / 10 || '—'}<small> kg</small></b><span>Best estimated 1RM</span></div><div><b>${lift.best}<small> kg</small></b><span>Heaviest weight</span></div><div><b>${lift.sets}</b><span>Completed sets</span></div></div>
    ${lineChart(lift.points.slice(-60), { label: lift.name + ' estimated 1RM' })}
    <h3 class="section-title">Recent sessions</h3><ol class="strength-history">${lift.points.slice(-12).reverse().map(point => html`<li><time datetime="${point.date}">${fmtShort(point.date)}</time><b>${point.w} kg <small>e1RM</small></b></li>`)}</ol>
    ${lift.bestSet ? html`<p class="muted small">Rank set: ${lift.bestSet.w} kg × ${lift.bestSet.r}, at ${lift.bestSet.bodyweight} kg body weight. Gold reference: ${lift.rank.reference}× body weight.</p>` : ''}`,
    actions: [{ label: 'Done', value: true }],
  });
}
export function showRankInfo() {
  return openSheet({title:'Rank order',onMount:paintStrength,body:html`<p class="sheet-text">Lowest to highest. Ranks use completed working sets and your body weight.</p><div class="rank-guide">${RANKS.map(rank=>html`<div data-rank-color="${color(rank)}">${rankBadge(rank,'mini')}<b>${rank.name}</b><span>${rank.index*100}${rank.index<RANKS.length-1 ? '–'+(rank.index*100+99) : '+'} RP</span></div>`)}</div><p class="muted small">Warm-up sets are excluded. Each muscle uses your best qualifying lift; your overall rank averages ranked muscles.</p>`,actions:[{label:'Done',value:true}]});
}
export function calculatorPanel() {
  const bodyweight = [...state.weights].filter(w => w.date <= ymd()).at(-1)?.weight || '';
  return html`<section class="rank-calculator card"><header class="strength-section-head"><h2>Rank calculator</h2><button type="button" class="rank-help" data-rank-info aria-label="How ranks work">?</button></header><form id="rankCalculator"><label for="rankMovementName">Exercise</label><input type="hidden" name="exercise" value="Barbell Bench Press"><button type="button" id="rankMovementName" class="rank-movement-picker input" data-pick-rank-exercise><span>Barbell Bench Press</span>${icons.chevron}</button><div class="rank-calculator-fields"><label>Body weight <span>kg</span><input class="input" type="number" name="bodyweight" inputmode="decimal" min="20" max="350" step="0.1" value="${bodyweight}" required></label><label>Weight <span>kg</span><input class="input" type="number" name="weight" inputmode="decimal" min="0" max="2000" step="0.1" placeholder="0" required></label><label>Reps<input class="input" type="number" name="reps" inputmode="numeric" min="1" max="12" step="1" value="1" required></label></div><button type="submit" class="btn btn-primary btn-block">Calculate rank</button><div id="rankCalculatorResult" aria-live="polite"></div></form></section>`;
}
export async function pickRankExercise(form) {
  const owner = account.user?.id;
  const choices = [...new Set([...CATALOG.map(item => item.name), ...Object.values(state.workouts).flatMap(list => list.map(item => item.name))])].filter(name => movement(name, state.workouts).reference).sort((a, b) => a.localeCompare(b));
  const options = query => html`${choices.filter(name => name.toLowerCase().includes(query.toLowerCase())).slice(0, 60).map(name => html`<button type="button" data-rank-choice="${name}">${name}${icons.chevron}</button>`)}`;
  const name = await openSheet({ title: 'Choose exercise', className: 'rank-exercise-picker', body: html`<label class="sr-only" for="rankExerciseSearch">Search exercises</label><input id="rankExerciseSearch" class="input" type="search" placeholder="Search exercises" autocomplete="off"><div class="rank-pick-list">${options('')}</div>`, onMount: (sheet, finish) => {
    sheet.querySelector('input').addEventListener('input', event => render(sheet.querySelector('.rank-pick-list'), options(event.target.value)));
    sheet.addEventListener('click', event => { const button = event.target.closest('[data-rank-choice]'); if (button) finish(button.dataset.rankChoice); });
  } });
  if (!name || account.user?.id !== owner || !form.isConnected) return;
  form.querySelector('[name=exercise]').value = name;
  form.querySelector('[data-pick-rank-exercise] span').textContent = name;
  render(document.getElementById('rankCalculatorResult'), '');
}
export function calculateRank(form) {
  const values = new FormData(form), name = String(values.get('exercise'));
  const rank = rankSet(name, Number(values.get('weight')), Number(values.get('reps')), Number(values.get('bodyweight')), state.workouts);
  const result = document.getElementById('rankCalculatorResult');
  render(result, rank ? html`<div class="calculator-result" data-rank-color="${color(rank)}">${rankBadge(rank, 'large')}<h3>${rank.name}</h3><b>${rank.score} RP</b>${rankMeter(rank)}<p>${rank.max} kg estimated 1RM · ${rank.ratio.toFixed(2)}× body weight</p><small>Preview only · your history stays unchanged</small></div>` : html`<p class="form-error">Use a supported exercise, body weight of 20–350 kg and 1–12 reps.</p>`);
  paintStrength(result);
}
