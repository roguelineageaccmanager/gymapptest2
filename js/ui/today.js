import { streakBadge } from './streak.js';
// Today: this week, today's workout and what is coming up.
import { $, html, render, on, busyAttr } from '../core/dom.js';
import { ymd, fmtLong, fmtShort, mondayIndex, addDays, startOfWeek, DOW, MONTHS, fmtClock } from '../core/dates.js';
import { go, refresh } from '../core/router.js';
import { state, restImage } from '../state.js';
import { workoutSummary, workoutBadge, scheduleOn } from '../domain/plan.js';
import { openSession, getActive } from './session.js';
import { pickWorkout, openDay } from './calendar.js';
import { icons } from './icons.js';
import { sessionKey, workingSetProgress } from '../domain/logs.js';
import { todayWorkoutSaveStatus, refreshCalendarData } from '../cloud/sync.js';
import { listen } from '../core/store.js';

let upcomingDays = 14;

function loggedOn(date, day) {
  return (state.logs[date] || []).some((s) => !day || s.day === day);
}

// Restored from the pre-module weekStripHTML design (e863676).
function weekStrip() {
  const start = startOfWeek(), today = ymd();
  if (state.settings.weekStyle === 'boxes') return boxWeek(start, today);
  return html`<ol class="week" aria-label="This week" data-key="week">${DOW.map((day, i) => {
    const date = ymd(addDays(start, i)), planned = scheduleOn(state.schedule, state.scheduleHistory, date)[i], done = loggedOn(date);
    const name = (state.logs[date] || []).at(-1)?.day || planned;
    const cls = ['week-day', planned ? 'planned' : 'rest', done ? 'done' : '', state.bypass[date] ? 'bypass' : '', date === today ? 'today' : ''].filter(Boolean).join(' ');
    const label = day + ': ' + (done ? 'completed' : planned || 'rest day');
    return html`<li><button type="button" class="${cls}" data-week-day="${date}" aria-label="${label}"${date === today ? html` aria-current="date"` : ''}><span class="wd-letter" aria-hidden="true">${day.slice(0, 1)}</span><span class="wd-dot" aria-hidden="true">${done ? icons.check : planned ? '' : icons.minus}</span><span class="wd-initial" aria-hidden="true">${name ? workoutBadge(name, state.settings) : ''}</span></button></li>`;
  })}</ol>`;
}

function boxWeek(start, today) {
  const end = addDays(start, 6);
  const range = start.getMonth() === end.getMonth() ? `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)}` : `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)}`;
  return html`<section class="week-box-card" data-key="week"><div class="week-box-heading"><h2>This week</h2><span>${range}</span></div><ol class="week week-boxes" aria-label="This week">${DOW.map((day, i) => {
    const d = addDays(start, i), date = ymd(d), planned = scheduleOn(state.schedule, state.scheduleHistory, date)[i], done = loggedOn(date);
    const name = (state.logs[date] || []).at(-1)?.day || planned;
    const cls = ['week-day', planned ? 'planned' : 'rest', done ? 'done' : '', state.bypass[date] ? 'bypass' : '', date === today ? 'today' : ''].filter(Boolean).join(' ');
    const label = day + ': ' + (done ? 'completed' : planned || 'rest day');
    return html`<li><button type="button" class="${cls}" data-week-day="${date}" aria-label="${label}"${date === today ? html` aria-current="date"` : ''}><span class="wd-letter" aria-hidden="true">${day.slice(0, 3)}</span><span class="wd-num" aria-hidden="true">${d.getDate()}</span><span class="wd-workout${name ? '' : ' wd-rest'}" aria-hidden="true">${name ? workoutBadge(name, state.settings) : '–'}</span></button></li>`;
  })}</ol></section>`;
}

function hero() {
  const today = ymd(), name = state.schedule[mondayIndex(new Date().getDay())];
  const logs = state.logs[today] || [];
  const active = getActive();
  const running = active?.date === today;
  if (running) {
    return html`<section class="card hero-card" data-key="hero">
      <p class="eyebrow">Workout running</p><h2 class="hero-title">${active.day}</h2>
      <button type="button" class="btn btn-primary" id="startToday" data-start="${active.day}" data-session-key="${active.key || ''}" data-key="hero-action">Resume workout</button></section>`;
  }
  const session = logs.filter(workout => workout.day === name).at(-1) || logs.at(-1);
  if (session) {
    const progress = session.exercises.map(workingSetProgress);
    const sets = progress.reduce((n, e) => n + e.done, 0);
    const partial = progress.reduce((n, e) => n + e.partial, 0);
    const exercises = session.exercises.length;
    return html`<section class="card hero-card done" data-key="hero">
      <p class="eyebrow">${icons.check} Workout saved</p>
      <h2 class="hero-title">${session.day}</h2>
      <p class="hero-meta">${[session.duration ? fmtClock(session.duration) : '', exercises + (exercises === 1 ? ' exercise' : ' exercises'), sets + (sets === 1 ? ' completed set' : ' completed sets'), partial ? partial + ' one-sided' : ''].filter(Boolean).join(' · ')}</p>
      <p class="hero-meta" role="status">${todayWorkoutSaveStatus(today, session)}</p>
      <div class="btn-row"><button type="button" class="btn btn-soft" data-start="${session.day}" data-session-key="${sessionKey(today, session)}" data-key="hero-action">View or edit</button>
        ${name && name !== session.day && state.workouts[name]?.length ? html`<button type="button" class="btn btn-primary" id="startToday" data-start="${name}">View ${name}</button>` : ''}</div></section>`;
  }
  if (!Object.keys(state.workouts).length) {
    return html`<section class="card hero-card onboarding" data-key="hero">
      <span class="setup-symbol" aria-hidden="true">${icons.dumbbell}</span>
      <h2>Ready to train?</h2><p>Set up a routine for your week.</p>
      <button type="button" class="btn btn-primary btn-block" data-go="plan">Set up my plan ${icons.chevron}</button></section>`;
  }
  if (!name) {
    return html`<section class="card hero-card rest" data-key="hero">
      <img class="rest-img" src="${restImage()}" alt="Rest day">
      <div class="rest-footer"><h2>Rest day</h2>
      <div class="btn-row"><button type="button" class="btn train-anyway" aria-haspopup="dialog" data-log-any>Train anyway</button></div></div></section>`;
  }
  const list = state.workouts[name] || [];
  return html`<section class="card hero-card" data-key="hero">
    <p class="eyebrow">Today’s workout</p>
    <h2 class="hero-title">${name}</h2>
    <button type="button" class="btn btn-primary" data-start="${name}" data-key="hero-action" id="startToday"${busyAttr(!list.length)}>View workout</button></section>`;
}

function upcoming() {
  const weeks = new Map(), now = new Date();
  for (let i = 1; i <= upcomingDays; i++) {
    const d = addDays(now, i), ds = ymd(d), idx = mondayIndex(d.getDay()), w = state.schedule[idx];
    const monday = ymd(startOfWeek(d));
    if (!weeks.has(monday)) weeks.set(monday, []);
    const rows = weeks.get(monday);
    const done = w && loggedOn(ds, w);
    const inner = html`<span class="up-day"><b>${DOW[idx].slice(0, 3)}</b><small>${fmtShort(ds)}</small></span>
      <span class="up-name">${w || 'Rest'}<small>${w ? (done ? 'Logged' : state.bypass[ds] ? 'Bypass day' : workoutSummary(state.workouts[w])) : ''}</small></span>`;
    // Rows are keyed by date; a rest day has nothing to open, so it is not a button.
    rows.push(w
      ? html`<li data-key="up-${ds}"><button type="button" class="up-row${done ? ' done' : ''}" data-preview="${ds}">${inner}<span class="chev">${icons.chevron}</span></button></li>`
      : html`<li data-key="up-${ds}"><div class="up-row rest">${inner}<img class="up-thumb" src="${restImage()}" alt="" loading="lazy" decoding="async"></div></li>`);
  }
  return html`<div class="up-weeks" data-key="up-weeks">${[...weeks].map(([monday, rows]) => {
      const sunday = ymd(addDays(new Date(monday + 'T12:00:00'), 6));
      return html`<section data-key="week-${monday}" aria-labelledby="up-week-${monday}">
        <h3 class="up-week-title sr-only" id="up-week-${monday}">${fmtShort(monday)} – ${fmtShort(sunday)}</h3>
        <ol class="up-list">${rows}</ol>
      </section>`;
    })}</div>
    ${upcomingDays < 56 ? html`<button type="button" class="btn btn-ghost btn-block" data-more data-key="more">Show more days</button>` : ''}`;
}

export function renderToday() {
  const today = ymd();
  render($('page-today'), html`
    <header class="top" data-key="top"><div><h1>Today</h1><p class="today-date">${fmtLong(today)}</p></div>
      <div class="top-actions">${streakBadge()}
      <button type="button" class="icon-btn" data-open-settings aria-label="Settings">${icons.settings}</button></div></header>
    ${weekStrip()}
    ${hero()}
    ${Object.keys(state.workouts).length ? html`<h2 class="sr-only" data-key="up-title">Coming up</h2>${upcoming()}` : ''}`);
}

export function initToday() {
  const page = $('page-today');
  // The date is read when tapped, so a page left open overnight logs to the right day.
  on(page, 'click', '[data-start]', (e, b) => openSession(b.dataset.start, ymd(), { key: b.dataset.sessionKey || null }));
  listen('gym:workouts-synced', () => { if (page.classList.contains('active')) renderToday(); });
  listen('gym:account', () => { if (page.classList.contains('active')) renderToday(); });
  // Upcoming days can be previewed (and marked as bypass) but not logged in advance.
  on(page, 'click', '[data-preview]', (e, b) => {
    const date = b.dataset.preview;
    const name = state.schedule[mondayIndex(new Date(date + 'T12:00:00').getDay())];
    if (name) openSession(name, date);
  });
  on(page, 'click', '[data-week-day]', (e, b) => {
    const date = b.dataset.weekDay;
    const name = state.schedule[mondayIndex(new Date(date + 'T12:00:00').getDay())];
    if (date >= ymd() && name) openSession(name, date);
    else openDay(date);
  });
  on(page, 'click', '[data-go]', (e, b) => go(b.dataset.go));
  on(page, 'click', '[data-go-crew]', () => go('crew'));
  on(page, 'click', '[data-more]', () => {
    const first = ymd(addDays(new Date(), upcomingDays + 1));
    upcomingDays = Math.min(56, upcomingDays + 14);
    renderToday();
    // The last press removes the button: continue at the first day it added.
    if (page.querySelector('[data-more]')) return;
    const next = [...page.querySelectorAll('.up-weeks [data-preview]')].find(button => button.dataset.preview >= first);
    next?.focus({ preventScroll: true });
  });
  on(page, 'click', '[data-log-any]', async (event, button) => {
    const date = ymd();
    const name = await pickWorkout(date, button);
    if (name) openSession(name, date, { fresh: true });
  });
  // Redraw when the app comes back and at midnight, so "today" is never stale.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    refreshToday();
    if (page.classList.contains('active')) refreshCalendarData();
  });
  scheduleMidnight();
}

let shownDay = ymd();
function refreshToday() {
  if (ymd() !== shownDay) { shownDay = ymd(); renderToday(); refresh(); }
}

function scheduleMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  setTimeout(() => { refreshToday(); scheduleMidnight(); }, next - now);
}
