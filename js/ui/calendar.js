import { supabase } from '../cloud/client.js';
import { exerciseDisplayName } from '../domain/exercises.js';
import { attachmentLabel, gripLabel } from '../domain/attachments.js';
// Calendar: every month from the first log to six months ahead, with streak.
import { isSecondsTarget } from '../domain/measurement.js';
import { $, html, render, on, toast } from '../core/dom.js';
import { ymd, parseYmd, fmtLong, mondayIndex, MONTHS, DOW_LETTER, fmtDuration, fmtClock } from '../core/dates.js';
import { state, setBypass, deleteSession, restoreSession } from '../state.js';
import { account } from '../cloud/sync.js';
import { sessionKey, canonicalLogDate, usesSideRows } from '../domain/logs.js';
import { activityYears, yearActivity } from '../domain/calendar.js';
import { categoryLabel } from '../domain/catalog.js';
import { displaySets, workoutBadge } from '../domain/plan.js';
import { openSession } from './session.js';
import { openSheet, confirmDialog, promptDialog } from './sheet.js';
import { icons } from './icons.js';
import { chooseOption } from './choice.js';

const MONTHS_AHEAD = 6;

const chosenDay = {}; // month (YYYY-MM) -> the day last visited there
const chosenYearDay = {};
let shownYears = 10, calendarOwner;

function monthGrid(y, m, today, chosen) {
  const days = new Date(y, m + 1, 0).getDate(), first = mondayIndex(new Date(y, m, 1).getDay());
  let count = 0, seconds = 0;
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(html`<span class="cal-cell empty" aria-hidden="true"></span>`);
  for (let d = 1; d <= days; d++) {
    const ds = ymd(new Date(y, m, d)), planned = state.schedule[mondayIndex(new Date(y, m, d).getDay())];
    const logs = state.logs[ds] || [];
    logs.forEach((s) => { count++; seconds += s.duration || 0; });
    const logged = logs.length > 0, bypass = !logged && !!state.bypass[ds];
    const secs = logs.reduce((n, s) => n + (s.duration || 0), 0);
    const tag = logged ? (logs.length > 1 ? logs.length + '× ' : '') + (secs ? shortTime(secs) : short(logs[0].day)) : bypass ? 'Bypass' : planned ? short(planned) : '';
    const cls = ['cal-cell', planned ? 'planned' : 'rest', logged ? 'logged' : '', bypass ? 'bypass' : '', ds === today ? 'today' : '', ds > today ? 'future' : ''].filter(Boolean).join(' ');
    const label = fmtLong(ds) + ': ' + (logged ? 'trained ' + logs.map((s) => s.day).join(', ') : bypass ? 'bypass day' : planned || 'rest day');
    // One tab stop per month (today, else the 1st); arrow keys move between days.
    // A day the user moved to keeps the month's tab stop across re-renders.
    const month = ds.slice(0, 7);
    const stop = chosen[month] ? ds === chosen[month] : ds === today || (d === 1 && !today.startsWith(month));
    cells.push(html`<button type="button" class="${cls}" data-day="${ds}" data-key="day-${ds}" tabindex="${stop ? '0' : '-1'}"><span class="sr-only">${label}</span><span class="cal-num" aria-hidden="true">${d}</span><span class="cal-tag" aria-hidden="true">${tag}</span></button>`);
  }
  return html`<section class="cal-month" data-month="${y}-${m}" data-key="month-${y}-${m}">
    <header class="cal-month-head"><h2>${MONTHS[m]} ${y}</h2><small>${count ? count + (count === 1 ? ' workout · ' : ' workouts · ') + fmtDuration(seconds) : ''}</small></header>
    <div class="cal-dow" aria-hidden="true">${DOW_LETTER.map((l) => html`<span>${l}</span>`)}</div>
    <div class="cal-grid" data-grid role="group" aria-label="${MONTHS[m]} ${y}, use the arrow keys to move between days">${cells}</div></section>`;
}

function shortTime(sec) {
  const m = Math.round(sec / 60);
  return m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? String(m % 60).padStart(2, '0') : '') : m + 'm';
}

function short(name) {
  return name === 'Full Body' ? 'Full' : String(name).slice(0, 6);
}

function monthlyCalendar(now, today) {
  const chosen = chosenDay;
  const firstLog = Object.keys(state.logs).sort()[0];
  let y = firstLog ? +firstLog.slice(0, 4) : now.getFullYear();
  let m = firstLog ? +firstLog.slice(5, 7) - 1 : now.getMonth();
  if (y * 12 + m > now.getFullYear() * 12 + now.getMonth()) { y = now.getFullYear(); m = now.getMonth(); }
  const end = now.getFullYear() * 12 + now.getMonth() + MONTHS_AHEAD;
  const months = [];
  while (y * 12 + m <= end) { months.push(monthGrid(y, m, today, chosen)); m++; if (m > 11) { m = 0; y++; } }
  return html`<div class="legend" aria-hidden="true"><span class="lg logged"></span>Trained <span class="lg planned"></span>Planned <span class="lg bypass"></span>Bypass</div>${months}`;
}

function compactYear(year, today) {
  const model = yearActivity(year, state.logs, state.bypass, today);
  const available = model.cells.filter(cell => cell && !cell.future);
  const chosen = available.find(cell => cell.date === chosenYearDay[year]) || available.find(cell => cell.date === today) || available.filter(cell => cell.trained).at(-1) || available[0];
  return html`<section class="card activity-year" data-key="activity-${year}" data-year-weeks="${model.columns}">
    <header class="activity-head"><div><h2>${year}</h2><span>${model.trainedDays} gym ${model.trainedDays === 1 ? 'day' : 'days'}</span></div><button type="button" class="link-btn" data-calendar-date="${year}" aria-label="Choose a date in ${year}">Choose date</button></header>
    <div class="activity-grid" data-grid="year" role="group" aria-label="${year} gym activity. Up and down move by day; left and right move by week.">
      ${model.cells.map(cell => cell ? html`<button type="button" class="activity-day${cell.trained ? ' trained' : ''}${cell.bypass ? ' bypass' : ''}${cell.date === today ? ' today' : ''}${cell.future ? ' future' : ''}" data-day="${cell.date}" data-key="day-${cell.date}" aria-label="${fmtLong(cell.date)}, ${year}: ${cell.future ? 'future day' : cell.trained ? 'trained' : cell.bypass ? 'bypass day' : 'no workout'}" title="${cell.date}${cell.trained ? ' · trained' : ''}" tabindex="${chosen?.date === cell.date ? '0' : '-1'}"${cell.future ? html` disabled` : ''}></button>` : html`<span class="activity-empty" aria-hidden="true"></span>`)}
    </div>
    <div class="activity-months" aria-hidden="true">${model.months.map(month => html`<span data-month-column="${month.column}">${MONTHS[month.month].slice(0, 3)}</span>`)}</div>
  </section>`;
}

export function calendarPanel() {
  const now = new Date(), today = ymd(now), compact = state.settings.calendarView === 'years';
  const owner = account.user?.id || null;
  if (calendarOwner !== owner && !(account.user && !account.ready)) {
    calendarOwner = owner; shownYears = 10;
    for (const key of Object.keys(chosenDay)) delete chosenDay[key];
    for (const key of Object.keys(chosenYearDay)) delete chosenYearDay[key];
  }
  const years = compact ? activityYears(state.logs, state.bypass, today) : [];
  return html`<div data-calendar-panel>
    ${compact ? html`<p class="activity-intro">Gym activity</p><div class="activity-legend"><span><i class="activity-key trained" aria-hidden="true"></i> Gym day</span><span><i class="activity-key" aria-hidden="true"></i> No workout</span></div>${years.slice(0, shownYears).map(year => compactYear(year, today))}${years.length > shownYears ? html`<button type="button" class="btn btn-soft btn-block" data-older-years data-key="older-years">Show older years</button>` : ''}` : monthlyCalendar(now, today)}</div>`;
}

export function paintCalendar(root) {
  root.querySelectorAll('[data-year-weeks]').forEach(row => {
    const columns = Number(row.dataset.yearWeeks);
    row.style.setProperty('--year-weeks', columns);
    row.querySelectorAll('[data-month-column]').forEach(label => {
      const col = Number(label.dataset.monthColumn);
      label.style.gridColumn = `${col} / span ${Math.min(4, columns - col + 1)}`;
    });
  });
}

/** Lets the user choose any routine to log on a date. Resolves with its name or null. */
export async function pickWorkout(date, trigger = document.activeElement) {
  const names = Object.keys(state.workouts).filter(name => state.workouts[name].length);
  if (!names.length) { toast('Add an exercise to a workout in Plan first.'); return null; }
  const owner = account.user?.id;
  const name = await chooseOption({
    trigger,
    title: 'Which workout?',
    subtitle: fmtLong(date),
    options: names.map(name => ({ value: name, label: name, badge: workoutBadge(name, state.settings) })),
  });
  return name && owner === account.user?.id && state.workouts[name]?.length ? name : null;
}

function historySets(exercise, sets) {
  const timed = isSecondsTarget(exercise.target);
  const perSide = usesSideRows(exercise);
  return html`<ol class="log-sets">${sets.map((set, index) => {
    const side = perSide ? (index % 2 ? 'R' : 'L') + (Math.floor(index / 2) + 1) + ' · ' : '';
    let result = timed
      ? (set.r || '–') + ' s' + (Number(set.w) > 0 ? ' · ' + set.w + ' kg added' : '')
      : (set.w || '–') + ' kg × ' + (set.r || '–') + ' reps';
    if (perSide && set.w === '' && set.r === '' && !set.done) result = 'No entry';
    return html`<li><span>${side}${result}</span>${set.done ? html`<i aria-label="done">${icons.check}</i>` : ''}</li>`;
  })}</ol>`;
}

export async function openDay(ds) {
  const planned = state.schedule[mondayIndex(parseYmd(ds).getDay())];
  const logs = state.logs[ds] || [];
  const today = ymd();
  if (logs.length) {
    const action = await openSheet({
      title: fmtLong(ds),
      subtitle: logs.length === 1 ? '1 workout logged' : logs.length + ' workouts logged',
      body: html`${logs.map((s) => html`
        <section class="log-session">
          <header class="log-head"><h3>${s.day}</h3><small>${s.duration ? fmtClock(s.duration) : ''}</small></header>

          ${s.exercises.map((e) => html`<div class="log-ex"><b>${exerciseDisplayName(e.name)}${e.attachment && e.attachment!=='none' ? ' · '+attachmentLabel(e) : ''}${gripLabel(e) ? ' · '+gripLabel(e) : ''}</b>
            ${e.warmups?.length ? html`<section class="log-warmups" aria-label="Warm-ups"><small class="muted">Warm-ups</small>${historySets(e, e.warmups)}</section>` : ''}
            ${e.sets.length ? html`${e.warmups?.length ? html`<small class="muted">Working sets</small>` : ''}${historySets(e, e.sets)}` : ''}</div>`)}
          <div class="btn-row">
            <button type="button" class="btn btn-soft btn-sm" data-edit="${sessionKey(ds, s)}" data-name="${s.day}">${icons.edit} Edit</button>
            <button type="button" class="btn btn-ghost btn-sm danger" data-del="${sessionKey(ds, s)}" data-name="${s.day}">${icons.trash} Delete</button>
          </div>
        </section>`)}`,
      actions: ds <= today ? [{ label: 'Log another workout', tone: 'secondary', value: { add: true } }] : [],
      onMount: (sheet, close) => {
        sheet.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => close({ edit: b.dataset.edit, name: b.dataset.name }); });
        sheet.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => close({ del: b.dataset.del, name: b.dataset.name }); });

      },
    });
    if (!action) return;
    if (action.edit) openSession(action.name, ds, { key: action.edit });
    if (action.add) { const n = await pickWorkout(ds); if (n) openSession(n, ds, { fresh: true }); }
    if (action.del && await confirmDialog(`The ${action.name} workout on ${fmtLong(ds)} will be deleted${account.user ? ' from all your devices' : ''}.`, { title: 'Delete this workout?', ok: 'Delete', danger: true })) {
      const removed = deleteSession(ds, action.del);
      toast('Workout deleted.', { action: removed ? { label: 'Undo', onClick: () => restoreSession(ds, removed) } : null });
    }
    return;
  }
  if (!planned) {
    if (ds > today) { toast('Rest day'); return; }
    const n = await pickWorkout(ds);
    if (n) openSession(n, ds);
    return;
  }
  const list = state.workouts[planned] || [];
  const isBypass = !!state.bypass[ds];
  const action = await openSheet({
    title: fmtLong(ds),
    subtitle: planned + (isBypass ? ' · bypass day' : ''),
    body: html`<div class="list">${list.map((e) => html`<div class="row"><div class="row-main"><b>${exerciseDisplayName(e.name)}${e.attachment && e.attachment!=='none' ? ' · '+attachmentLabel(e) : ''}${gripLabel(e) ? ' · '+gripLabel(e) : ''}</b><small>${categoryLabel(e.cat)}</small></div><span class="row-end muted">${displaySets(e)} sets${e.unilateral ? ' · L/R' : ''}</span></div>`)}</div>`,
    actions: [
      ...(ds <= today ? [{ label: 'Log ' + planned, tone: 'primary', value: 'start' }] : []),
      { label: isBypass ? 'Remove bypass' : 'Mark as bypass day', tone: 'ghost', value: 'bypass' },
    ],
  });
  if (action === 'start') openSession(planned, ds);
  if (action === 'bypass') {
    setBypass(ds, !isBypass);
    toast(isBypass ? 'Bypass removed.' : 'Marked as bypass day.');
  }
}

export function initCalendar() {
  const page = $('page-stats');
  on(page, 'click', '[data-calendar-panel] [data-day]', (e, b) => openDay(b.dataset.day));
  on(page, 'click', '[data-older-years]', () => {
    const first = activityYears(state.logs, state.bypass)[shownYears];
    shownYears += 10;
    const calendar = page.querySelector('[data-calendar-panel]');
    if (!calendar) return;
    render(calendar.parentElement, calendarPanel());
    paintCalendar(calendar.parentElement);
    const next = page.querySelector(`[data-calendar-date="${first}"]`);
    next?.focus({ preventScroll: true }); next?.scrollIntoView({ block: 'center' });
  });
  // The last day the user was on keeps its month's tab stop, also while a
  // sheet is open or focus is elsewhere when a refresh lands.
  page.addEventListener('focusin', (e) => { const d = e.target.closest?.('[data-calendar-panel] [data-day]'); if (d) { chosenDay[d.dataset.day.slice(0, 7)] = d.dataset.day; chosenYearDay[d.dataset.day.slice(0, 4)] = d.dataset.day; } });
  on(page, 'click', '[data-calendar-date]', async (event, button) => {
    const year = button.dataset.calendarDate, min = year + '-01-01', max = year === ymd().slice(0, 4) ? ymd() : year + '-12-31';
    const owner = account.user?.id || null;
    const previous = chosenYearDay[year];
    const date = await promptDialog({ title: 'Choose a date', label: 'Date', type: 'date', value: previous >= min && previous <= max ? previous : max, input: { min, max }, ok: 'Open day',
      hint: 'Open a day to view or log a workout.', validate: value => canonicalLogDate(value) === value && value >= min && value <= max ? '' : 'Choose a valid date in ' + year + ' up to today.' });
    if (date && (account.user?.id || null) === owner) { chosenYearDay[year] = date; openDay(date); }
  });
}

export function friendCalendar(member, viewer) {
  const now = new Date();
  let month = new Date(now.getFullYear(), now.getMonth(), 1);
  let schedule = new Map();
  let panel, rail, idle;
  const loaded = new Map();
  const shift = offset => new Date(month.getFullYear(), month.getMonth() + offset, 1);

  function monthMarkup(date) {
    const year = date.getFullYear(), m = date.getMonth();
    const key = ymd(date), title = MONTHS[m] + ' ' + year;
    const result = loaded.get(key);
    const offset = mondayIndex(date.getDay());
    const length = new Date(year, m + 1, 0).getDate();
    const today = ymd();
    const cells = Array.from({length: offset + length}, (_, index) => {
      if (index < offset) return html`<span class="cal-cell empty" aria-hidden="true"></span>`;
      const day = index - offset + 1;
      const date = new Date(year, m, day), key = ymd(date);
      const count = Number(result?.counts?.get(key)) || 0;
      const planned = schedule.get(mondayIndex(date.getDay()));
      const tag = count ? (count === 1 ? 'Trained' : count + ' workouts') : planned || '';
      return html`<span class="cal-cell ${count ? 'logged' : planned ? 'planned' : 'rest'}${key === today ? ' today' : ''}" title="${fmtLong(key)}${tag ? ' · ' + tag : ''}"><span class="cal-num">${day}</span><span class="cal-tag">${tag}</span></span>`;
    });
    return html`<section class="friend-month" data-key="friend-month-${key}"${key === ymd(month) ? html` data-current-month` : ''} aria-label="${title}">
      <h4>${title}</h4>
      <div class="cal-dow" aria-hidden="true">${DOW_LETTER.map(d => html`<span>${d}</span>`)}</div>
      <div class="cal-grid friend-month-grid">${cells}</div>
      ${result?.error ? html`<button type="button" class="link-btn" data-retry-month="${key}">Could not load workouts. Try again</button>` : ''}
    </section>`;
  }

  const months = () => [-1, 0, 1].map(offset => monthMarkup(shift(offset)));

  async function load() {
    const key = ymd(month);
    if (loaded.has(key)) return;
    loaded.set(key, {});
    try {
      const {data, error} = await supabase.rpc('member_calendar', {member, month_start: key});
      if (error) throw error;
      loaded.set(key, {counts: new Map((data || []).map(row => [row.workout_date, row.workouts]))});
    } catch {
      loaded.set(key, {error: true});
    }
    if (loaded.size > 12) loaded.delete(loaded.keys().next().value);
    if (rail?.isConnected && account.user?.id === viewer) render(rail, html`${months()}`);
  }

  function move(offset) {
    if (!rail?.clientWidth) return;
    month = shift(offset);
    render(rail, html`${months()}`);
    rail.scrollLeft = rail.clientWidth;
    load();
  }

  return {
    markup(split) {
      schedule = new Map(split.flatMap(routine => routine.days.map(day => [day, routine.name])));
      return html`<section class="profile-calendar" data-profile-calendar data-key="profile-calendar">
        <div class="friend-month-nav"><h3>Workout calendar</h3>
          <button type="button" class="icon-btn" data-month-step="-1" aria-label="Previous month">‹</button>
          <button type="button" class="icon-btn" data-month-step="1" aria-label="Next month">›</button></div>
        <div class="friend-month-rail" tabindex="0" aria-label="Swipe or use arrow keys to change months">${months()}</div>
      </section>`;
    },
    connect(root) {
      if (!root || root === panel) return;
      panel = root;
      rail = root.querySelector('.friend-month-rail');
      rail.scrollLeft = rail.clientWidth;
      load();
      rail.addEventListener('scroll', () => {
        clearTimeout(idle);
        idle = setTimeout(() => {
          if (!rail?.isConnected || !rail.clientWidth) return;
          const offset = Math.round(rail.scrollLeft / rail.clientWidth) - 1;
          if (offset) move(offset);
        }, 120);
      }, {passive:true});
      rail.addEventListener('keydown', event => {
        if (event.target !== rail || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      });
      on(root, 'click', '[data-month-step]', (event, button) => move(Number(button.dataset.monthStep)));
      on(root, 'click', '[data-retry-month]', (event, button) => {
        if (button.dataset.retryMonth !== ymd(month)) return;
        loaded.delete(ymd(month));
        load();
      });
    },
    close() { clearTimeout(idle); panel = rail = null; },
  };
}
