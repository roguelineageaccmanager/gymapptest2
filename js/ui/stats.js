import { progressPanel, initProgress, loadProgress } from './progress.js';
import { account } from '../cloud/sync.js';
import { listen } from '../core/store.js';
// Stats: totals, body weight and per-exercise progress.
import { $, html, render, on, toast } from '../core/dom.js';
import { ymd, fmtShort, fmtDuration } from '../core/dates.js';
import { state, setWeight, deleteWeight, streaks } from '../state.js';
import { totals } from '../domain/logs.js';
import { strengthStats } from '../domain/ranks.js';
import { paintStrength, bodygraphPanel, yourRankPanel, calculatorPanel, calculateRank, pickRankExercise, exerciseRankingList, openStrengthLift, showRankInfo } from './strength.js';
import { weightTrend } from '../domain/weights.js';
import { lineChart } from './graph.js';
import { icons } from './icons.js';

const MIN_KG = 20, MAX_KG = 350;
let statsTab = 'rank', statsOwner;
let showEntries = false;
let analyticsRange = 'all', analyticsMetric = 'volume';
let liftQuery = '';
const statsData = () => strengthStats(state.logs, state.weights, state.workouts, ymd());

function tiles() {
  const t = totals(state.logs, ymd().slice(0, 7));
  const { current: st, best } = streaks();
  const tile = (value, label) => html`<div class="tile"><b>${value}</b><span>${label}</span></div>`;
  return html`<div class="tiles">${tile(t.workouts, 'Workouts')}${tile(t.month, 'This month')}${tile(t.seconds ? fmtDuration(t.seconds) : '–', 'Total time')}${tile(st + (best > st ? ' / ' + best : ''), best > st ? 'Streak / best' : 'Streak')}</div>`;
}

function weightCard() {
  const list = state.weights;
  const trend = weightTrend(list);
  const points = list.slice(-60).map((x) => ({ date: x.date, w: x.weight }));
  return html`<section class="card" id="weightCard">
    <header class="card-head"><h2>Body weight</h2>
      ${trend ? html`<div class="big-num"><span data-chart-value>${trend.latest.weight}</span><small> kg</small><span class="chart-current-date" data-chart-date>${fmtShort(trend.latest.date)}</span>${trend.change ? html`<span class="delta">${trend.change > 0 ? '+' : ''}${trend.change} kg / 30 d</span>` : ''}</div>` : ''}</header>
    ${points.length > 1 ? lineChart(points, { label: 'Body weight over time', summaryInHeader: true }) : ''}
    <form class="input-row" id="weightForm">
      <label class="sr-only" for="weightInput">Body weight in kg</label>
      <input class="input" id="weightInput" type="number" inputmode="decimal" step="0.1" min="${MIN_KG}" max="${MAX_KG}" placeholder="Today’s weight in kg">
      <button class="btn btn-primary" type="submit">Log</button>
    </form>
    ${list.length ? html`
      <button type="button" class="link-btn" data-toggle-entries aria-expanded="${showEntries ? 'true' : 'false'}">${showEntries ? 'Hide entries' : 'Show all ' + list.length + ' entries'}</button>
      ${showEntries ? html`<ol class="entries">${[...list].reverse().map((x) => html`<li data-key="w-${x.date}"><span>${fmtShort(x.date)}</span><b>${x.weight} kg</b><button type="button" class="icon-btn sm" data-del-weight="${x.date}" aria-label="Delete weigh-in from ${fmtShort(x.date)}">${icons.x}</button></li>`)}</ol>` : ''}`
      : html`<p class="muted small">Log your weight now and then to see the trend.</p>`}
  </section>`;
}

function analyticsPanel(stats) {
  const today = ymd(), start = new Date(today + 'T12:00:00');
  if (analyticsRange !== 'all') start.setDate(start.getDate() - Number(analyticsRange) + 1);
  const from = analyticsRange === 'all' ? '' : ymd(start);
  const dates = Object.keys(state.logs).filter(date => date >= from && date <= today).sort();
  const period = Object.fromEntries(dates.map(date => [date, state.logs[date]]));
  const summary = strengthStats(period, state.weights, state.workouts, today);
  const points = analyticsMetric === 'rank' ? stats.history.filter(point => point.date >= from) : dates.map(date => {
    const day = strengthStats({ [date]: period[date] }, [], state.workouts, today);
    return { date, w: analyticsMetric === 'sets' ? day.sets : day.volume };
  });
  const unit = analyticsMetric === 'rank' ? 'RP' : analyticsMetric === 'sets' ? 'sets' : 'kg';
  return html`<section class="analytics-overview card"><header class="strength-section-head"><h2>Training analytics</h2><div class="stats-periods" role="group" aria-label="Analytics period">${[['30', '1M'], ['90', '3M'], ['all', 'All']].map(([id, label]) => html`<button type="button" data-stats-range="${id}" aria-pressed="${analyticsRange === id ? 'true' : 'false'}">${label}</button>`)}</div></header>
    <div class="analytics-metric-tabs" role="group" aria-label="Chart metric">${[['volume', 'Volume'], ['sets', 'Sets'], ['rank', 'Strength']].map(([id, label]) => html`<button type="button" data-stats-metric="${id}" aria-pressed="${analyticsMetric === id ? 'true' : 'false'}">${label}</button>`)}</div>
    ${points.length ? lineChart(points, { unit, label: 'Training ' + analyticsMetric }) : html`<p class="empty-inline">No completed sets in this period.</p>`}
    <div class="strength-metrics"><div><b>${totals(period, '').workouts}</b><span>Workouts</span></div><div><b>${summary.sets}</b><span>Sets</span></div><div><b>${summary.reps.toLocaleString()}</b><span>Reps</span></div></div></section>
    ${tiles()}${weightCard()}
    <section class="strength-exercises"><header class="strength-section-head"><h2>Your exercises</h2><small>${stats.exercises.length}</small></header><label class="sr-only" for="strengthSearch">Search your exercises</label><input class="input" id="strengthSearch" type="search" placeholder="Search exercises" value="${liftQuery}" autocomplete="off"><div id="strengthExerciseResults">${exerciseRankingList(stats, liftQuery)}</div></section>`;
}

export function renderStats() {
  // An ownership question in another window must not remove a focused field.
  // Reset account-specific views only once that sign-in is confirmed (or on logout).
  if (statsOwner !== account.user?.id && !(account.user && !account.ready)) { statsOwner = account.user?.id; statsTab = 'rank'; liftQuery = ''; analyticsRange = 'all'; }
  const st = streaks().current, stats = statsData();
  const tabs = [['rank', 'Your rank'], ['stats', 'Bodygraph'], ['analytics', 'Analytics'], ['progress', 'Progress'], ['calculator', 'Calculator']];
  render($('page-stats'), html`<header class="top"><h1>Stats</h1><div class="top-actions"><span class="streak" aria-label="Training streak: ${st} days">${icons.flame} ${st}</span><button type="button" class="icon-btn" data-open-settings aria-label="Settings">${icons.settings}</button></div></header>
    <div class="section-tabs app-section-tabs stats-tabs" role="tablist" aria-label="Stats sections">${tabs.map(([id, label]) => html`<button type="button" role="tab" data-stats-tab="${id}" id="stats-tab-${id}" aria-controls="stats-panel" aria-selected="${statsTab === id ? 'true' : 'false'}" tabindex="${statsTab === id ? '0' : '-1'}">${label}</button>`)}</div>
    <div id="stats-panel" role="tabpanel" aria-labelledby="stats-tab-${statsTab}">${statsTab === 'rank' ? yourRankPanel(stats) : statsTab === 'progress' ? progressPanel() : statsTab === 'calculator' ? calculatorPanel() : statsTab === 'analytics' ? analyticsPanel(stats) : bodygraphPanel(stats)}</div>`);
  paintStrength($('page-stats'));
}

export function initStats() {
  const page = $('page-stats');
  initProgress(page);
  on(page, 'click', '[data-rank-info]', showRankInfo);
  on(page, 'click', '[data-pick-rank-exercise]', (event, button) => pickRankExercise(button.closest('form')));
  on(page, 'input', '#rankCalculator input', () => render($('rankCalculatorResult'), ''));
  on(page, 'click', '[data-muscle]', (event, button) => { const card = page.querySelector('[data-rank-muscle="' + button.dataset.muscle + '"]'); if (card) { card.open = true; card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); card.querySelector('summary').focus({ preventScroll: true }); } });
  on(page, 'keydown', '[data-muscle]', (event, button) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); button.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  on(page, 'click', '[data-strength-lift]', (event, button) => openStrengthLift(button.dataset.strengthLift));
  on(page, 'click', '[data-stats-range]', (event, button) => { analyticsRange = button.dataset.statsRange; renderStats(); });
  on(page, 'click', '[data-stats-metric]', (event, button) => { analyticsMetric = button.dataset.statsMetric; renderStats(); });
  on(page, 'input', '#strengthSearch', (event, input) => { liftQuery = input.value; render($('strengthExerciseResults'), exerciseRankingList(statsData(), liftQuery)); paintStrength($('strengthExerciseResults')); });
  on(page, 'submit', '#rankCalculator', (event, form) => { event.preventDefault(); if (form.reportValidity()) calculateRank(form); });
  on(page, 'click', '[data-stats-tab]', (e, button) => { statsTab = button.dataset.statsTab; renderStats(); if (statsTab === 'progress') loadProgress(); });
  listen('gym:account', renderStats);
  const selectPoint = (point) => {
    const svg = point.closest('svg');
    const selection = svg?.querySelector('[data-chart-selection]');
    const circle = selection?.querySelector('.g-selected');
    if (!svg || !circle) return;
    const cx = Number(point.getAttribute('cx')), cy = Number(point.getAttribute('cy'));
    circle.setAttribute('cx', String(cx)); circle.setAttribute('cy', String(cy));
    svg.querySelectorAll('[data-chart-point]').forEach((p) => p.setAttribute('aria-pressed', p === point ? 'true' : 'false'));
    const card = svg.closest('.card');
    const value = card?.querySelector('[data-chart-value]');
    const date = card?.querySelector('[data-chart-date]');
    if (value) value.textContent = Number(point.dataset.value).toLocaleString();
    if (date) date.textContent = fmtShort(point.dataset.date);
    const output = svg.closest('.chart-wrap')?.querySelector('[data-chart-selection-output]');
    if (output) output.textContent = `${fmtShort(point.dataset.date)} · ${Number(point.dataset.value).toLocaleString()} ${point.dataset.unit}`;
  };
  on(document, 'click', '[data-chart-point]', (e, point) => selectPoint(point));
  on(document, 'focusin', '[data-chart-point]', (e, point) => selectPoint(point));
  on(document, 'keydown', '[data-chart-point]', (e, point) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    selectPoint(point);
  });
  on(page, 'submit', '#weightForm', (e) => {
    e.preventDefault();
    const v = parseFloat($('weightInput').value);
    if (!(v >= MIN_KG && v <= MAX_KG)) { toast(`Enter a weight between ${MIN_KG} and ${MAX_KG} kg.`, { tone: 'error' }); return; }
    setWeight(ymd(), Math.round(v * 10) / 10);
    $('weightInput').value = '';
    toast('Weight logged.');
  });
  on(page, 'click', '[data-toggle-entries]', () => { showEntries = !showEntries; renderStats(); });
  on(page, 'click', '[data-del-weight]', (e, b) => {
    const date = b.dataset.delWeight, entry = state.weights.find((x) => x.date === date);
    deleteWeight(date);
    toast('Weigh-in deleted.', { action: entry ? { label: 'Undo', onClick: () => setWeight(date, entry.weight) } : null });
  });
}

export function onStatsShown() { if (statsTab === 'progress') loadProgress(); }
