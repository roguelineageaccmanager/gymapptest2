import { attachmentLabel, attachmentFor } from '../domain/attachments.js';
import { measurement, isSecondsTarget, isTimedCardioExercise, defaultTarget, withUnit } from '../domain/measurement.js';
import { exerciseDisplayName, lastExerciseUse, sameExercise } from '../domain/exercises.js';
// The workout screen: log sets, smart rest timer, autosave, start/finish.
// Every opened session has its own draft, so editing an old workout never
// touches the one that is running.
import { $, html, render, replaceContent, appendContent, on, toast, haptic, reducedMotion, dismissUndo } from '../core/dom.js';
import { KEYS, read, write, remove, emit, listen } from '../core/store.js';
import { ymd, parseYmd, fmtLong, fmtClock, fmtShort, relativeDay } from '../core/dates.js';
import { pushLayer } from '../core/router.js';
import { state, saveLogs, saveLastUsed, markSessionsDeleted, createWorkout } from '../state.js';
import { sanitizeWorkout, sanitizeWorkoutName, rowCount, REST_DEFAULTS, DEFAULT_REST, defang } from '../domain/plan.js';
import { bestCompletedWeight, trimSets, loggedWorkingSets, usesSideRows, workingSetProgress, sessionKey, newSessionId } from '../domain/logs.js';
import { restState, muscleGroup } from '../domain/rest-timer.js';
import { categoryLabel, CATALOG } from '../domain/catalog.js';
import { confirmDialog, openSheet, promptDialog } from './sheet.js';
import { defaultExerciseSetup, pickWorkoutExercise } from './exercise-picker.js';
import { ITEMS, TIMES, NOTE_MAX, sanitizeEntry, sanitizeNutrition, entrySummary } from '../domain/nutrition.js';
import { icons } from './icons.js';
import { playRestSound, unlockRestAudio } from './rest-sound-editor.js';
import { initWorkoutStatus, publishWorkoutStatus, nativeRestAlerts } from '../workout-notification.js';
import { account } from '../cloud/sync.js';
import { strengthStats, rankSetupKey, rankText } from '../domain/ranks.js';

const DRAFT_STALE_MS = 4 * 3600 * 1000;
const DRAFT_MAX_AGE_MS = 7 * 86400 * 1000;
const ACTIVE_MAX_MS = 12 * 3600 * 1000;
const NEW = 'new:';
const QUICK = 'Quick workout';

let s = null; // the open session
let closeLayer = null;
let tickTimer = null;
let wakeLock = null;

let returnFocus = null;
let starting = false;

/** The workout whose timer is running: { day, date, key, startedAt }. */
export function getActive() {
  const a = read(KEYS.active, null);
  if (!a || typeof a !== 'object') return null;
  if (Date.now() - a.startedAt > ACTIVE_MAX_MS) { remove(KEYS.active); return null; }
  return a;
}

function setActive(a) {
  if (a) write(KEYS.active, a); else remove(KEYS.active);
  if (!a) publishWorkoutStatus(null);
  emit('gym:active-changed');
}

// Only the running session contributes status; previews/old logs cannot replace it.
function syncWorkoutStatus({ requestPermission = false } = {}) {
  const a = getActive();
  if (!a) { publishWorkoutStatus(null); return; }
  const before = JSON.stringify(a);
  const here = s?.started && s.key === a.key && s.date === a.date && s.day === a.day;
  let status = a.status || { done: 0, total: 0, exercise: '', restUntil: 0 };
  if (here) {
    const e = s.exercises.find(x => x.name === s.selected);
    const restUntil = state.settings.restTimers !== false && e && s.anyAt ? Math.max(
      (s.doneAt[muscleGroup(e.cat)] || 0) + e.rest * 1000,
      s.anyAt + 30000,
    ) : 0;
    status = { done: s.progress.done, total: s.progress.total,
      exercise: e?.name || '', restUntil: restUntil > Date.now() ? restUntil : 0 };
    a.rest = { doneAt: s.doneAt, anyAt: s.anyAt, selected: s.selected };
  }
  if (state.settings.restTimers === false) { status = { ...status, restUntil: 0 }; delete a.rest; }
  let nextWorkout = '';
  const day = new Date(a.date + 'T12:00:00');
  for (let i = 1; i <= 7; i++) { day.setDate(day.getDate() + 1); const name = state.schedule[(day.getDay() + 6) % 7]; if (name) { nextWorkout = name; break; } }
  const nextExercise = here ? s.exercises.find((e, i) => e.name !== status.exercise && [...$('sessionList').querySelectorAll('[data-index="' + i + '"] .work-sets .d')].some(box => !box.checked))?.name || '' : a.status?.nextExercise || '';
  status = { ...status, nextExercise };
  a.status = status;
  if (before !== JSON.stringify(a)) write(KEYS.active, a);
  publishWorkoutStatus({ ...status, restEnabled: state.settings.restTimers !== false, restSound: state.settings.restSound || 'beep', restVibration: state.settings.restVibration !== false, nextWorkout, title: a.day, startedAt: a.startedAt, id: a.date + '|' + a.key }, { requestPermission });
}

const draftId = (day, date, key) => date + '|' + day + '|' + key;

function readDrafts() {
  const drafts = read(KEYS.drafts, {}) || {};
  // The previous app version kept one draft for the open workout.
  const legacy = read(KEYS.draft, null);
  if (legacy && legacy.day && legacy.date && legacy.ex) {
    const active = getActive();
    const key = active && active.day === legacy.day && active.date === legacy.date && active.key ? active.key : NEW + 'legacy';
    const id = draftId(legacy.day, legacy.date, key);
    if (!drafts[id]) drafts[id] = { ...legacy, key };
    write(KEYS.drafts, drafts);
    remove(KEYS.draft);
  }
  return drafts;
}

function writeDraft(id, draft) {
  const drafts = readDrafts();
  if (draft) drafts[id] = draft; else delete drafts[id];
  Object.keys(drafts).forEach((k) => { if (Date.now() - (drafts[k].active || 0) > DRAFT_MAX_AGE_MS) delete drafts[k]; });
  return write(KEYS.drafts, drafts);
}

export function isOpen() { return !!s; }

/** A routine was renamed: the running workout and its drafts follow the new name. */
export function renameRunningWorkout(from, to) {
  // The open workout follows too, so it is saved under the new name and its draft.
  if (s && s.day === from) {
    s.day = to;
    s.draftId = draftId(to, s.date, s.key);
    $('sessionTitle').textContent = to;
  }
  const active = getActive();
  if (active && active.day === from) setActive({ ...active, day: to });
  const drafts = readDrafts();
  let changed = false;
  Object.keys(drafts).forEach((k) => {
    // Keys are date|routine|session and names may contain "|": go by the draft's own routine.
    const prefix = k.slice(0, 11) + from + '|';
    if (drafts[k].day !== from || !k.startsWith(prefix)) return;
    drafts[k.slice(0, 11) + to + '|' + k.slice(prefix.length)] = { ...drafts[k], day: to };
    delete drafts[k];
    changed = true;
  });
  if (changed) write(KEYS.drafts, drafts);
}

/**
 * Opens a workout. Without options it resumes the running session of that
 * workout and date, else edits the latest logged one, else starts a new one.
 * `key` edits a specific logged session; `fresh` starts a new one instead of
 * editing a logged one (an unsaved new one of this workout and day is continued).
 * Future dates can be previewed in the calendar but not logged.
 */
export function openQuickWorkout() {
  openSession(QUICK, ymd(), { fresh: true, quick: true });
}

export function openSession(day, date = ymd(), { key = null, fresh = false, autoStart = false, quick = false } = {}) {
  const today = ymd();
  if (date > today) {
    return openFuturePreview(day, date);
  }
  const sameDay = (state.logs[date] || []).filter((x) => x.day === day);
  const active = getActive();
  const activeHere = active && active.day === day && active.date === date ? active : null;
  // The previous app version's running workout has no key: treat it as new.
  if (activeHere && !activeHere.key) { activeHere.key = NEW + 'legacy'; write(KEYS.active, activeHere); }
  let existing = null, sessionRef;
  if (key) {
    existing = sameDay.find((x) => sessionKey(date, x) === key) || null;
    sessionRef = existing || key.startsWith(NEW) ? key : NEW + newSessionId();
  } else if (!fresh && activeHere) {
    existing = sameDay.find((x) => sessionKey(date, x) === activeHere.key) || null;
    sessionRef = activeHere.key;
  } else if (!fresh && sameDay.length) {
    existing = sameDay[sameDay.length - 1];
    sessionRef = sessionKey(date, existing);
  } else {
    // Continue an unsaved new session of this workout and day if there is one.
    const prefix = date + '|' + day + '|' + NEW;
    const drafts = readDrafts();
    const newest = Object.keys(drafts).filter(k => k.startsWith(prefix) && Boolean(drafts[k].quick) === quick)
      .sort((a, b) => (drafts[b].active || 0) - (drafts[a].active || 0))[0];
    sessionRef = newest ? newest.slice(date.length + day.length + 2) : NEW + newSessionId();
  }
  const id = draftId(day, date, sessionRef);
  const saved = readDrafts()[id];
  const resume = saved && saved.ex ? saved : null;
  quick ||= !existing && !!(resume?.quick || (sessionRef === activeHere?.key && activeHere.quick));

  const routine = state.workouts[day] ? sanitizeWorkout(state.workouts[day]) : null;
  // What the routine says about an exercise, or a sensible guess if it is not in it.
  const meta = (name, target = '') => routine?.find((e) => e.name === name) ||
    { name, cat: CATALOG.find((c) => c.name === name)?.cat || 'other', sets: 1, target, rest: REST_DEFAULTS[name] ?? DEFAULT_REST, note: '' };
  let exercises;
  let addedFromPlan = false;
  if (existing) {
    // Editing: exactly what was logged, in that order (the routine may have changed since).
    exercises = existing.exercises.map((e) => ({ ...meta(e.name, e.target), unilateral:usesSideRows(e), attachment:attachmentFor(e.name,e.attachment), target: e.target || '', sets: Math.max(1, e.sets.length) }));
  } else if (quick) {
    exercises = sanitizeWorkout(resume?.quickExercises || []);
  } else if (Array.isArray(resume?.sessionExercises)) {
    // Keep started rows stable, and append newly planned exercises in plan order.
    exercises = sanitizeWorkout(resume.sessionExercises);
    if (activeHere?.key === sessionRef && routine) {
      const additions = routine.filter(entry => !exercises.some(exercise => sameExercise(exercise.name, entry.name)));
      exercises.push(...additions);
      addedFromPlan = additions.length > 0;
    }
  } else if (routine) {
    exercises = routine;
  } else {
    // The routine was deleted or renamed: rebuild from the draft.
    const names = resume ? Object.keys(resume.ex) : [];
    if (!names.length) {
      if (activeHere) setActive(null);
      toast('This workout no longer exists.');
      return;
    }
    exercises = names.map((name) => ({ ...meta(name), sets: Math.max(1, (resume.ex[name] || []).length) }));
  }
  if (!existing) exercises = exercises.map(e => {
    const legacyDraft = resume?.ex?.[e.name] && !Object.hasOwn(resume.targets || {}, e.name);
    const target = resume?.targets?.[e.name] ?? (legacyDraft ? (isSecondsTarget(e.target) ? withUnit('8–12','reps') : e.target) : measurement(e) === 'seconds' ? (isSecondsTarget(e.target) ? e.target : defaultTarget(e.name)) : e.target);
    return {...e,unilateral:usesSideRows(e),target,...(Object.hasOwn(resume?.attachments || {}, e.name) ? {attachment:attachmentFor(e.name,resume.attachments[e.name])} : {})};
  });
  const started = !!(activeHere && activeHere.key === sessionRef);
  s = {
    day, date, key: sessionRef, draftId: id, exercises, existing, quick, owner: account.user?.id ?? null,
    existingText: existing ? JSON.stringify(existing.exercises) : '', // to see a sync change it meanwhile
    started,
    startedAt: started ? activeHere.startedAt : (resume && Date.now() - (resume.active || 0) < DRAFT_STALE_MS ? resume.startedAt || 0 : 0),
    retro: date < today || !!existing,
    // Decided once: only a new workout started today updates "last used" (also after midnight).
    updatesLastUsed: !existing && date === today,
    doneAt: started ? activeHere.rest?.doneAt || {} : {},
    anyAt: started ? activeHere.rest?.anyAt || 0 : 0,
    selected: started ? activeHere.rest?.selected || null : null, wasWaiting: false, prs: new Map(),
    // Food and drink before and after (kept with the draft and saved with the workout).
    // A draft records food only for the sides changed in it (a removed entry
    // too), so nothing removed comes back and nothing added elsewhere is hidden.
    ...draftFood(resume, existing),
  };
  returnFocus = document.activeElement;
  renderSession(resume);
  $('session').hidden = false;
  document.body.classList.add('session-open');
  setBackgroundInert(true);
  $('sessionList').scrollTop = 0;
  closeLayer = pushLayer(() => closeSession(true));
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, 1000);
  tick();
  if (s.started) lockScreen();
  if (addedFromPlan) saveDraft();
  $('sessionTitle').focus({ preventScroll: true });
  if (autoStart && !s.started && !s.retro) start({ quiet: true });
  emit('gym:active-changed');
}

function openFuturePreview(day, date) {
  const exercises = sanitizeWorkout(state.workouts[day] || []).map(e=>({...e,target:measurement(e)==='seconds' && !isSecondsTarget(e.target)?defaultTarget(e.name):e.target}));
  if (!exercises.length) { toast('This routine has no exercises yet.'); return; }
  s = { day, date, exercises, preview: true, existing: null, started: false, startedAt: 0,
    retro: false, updatesLastUsed: false, doneAt: {}, anyAt: 0, selected: null, wasWaiting: false, prs: {}, nutrition: {}, foodChanged: [] };
  returnFocus = document.activeElement;
  renderSession(null);
  $('session').hidden = false;
  document.body.classList.add('session-open');
  setBackgroundInert(true);
  $('sessionList').scrollTop = 0;
  closeLayer = pushLayer(() => closeSession(true));
  clearInterval(tickTimer);
  $('sessionTitle').focus({ preventScroll: true });
}

const updatesLastUsed = () => !!s && s.updatesLastUsed;

function previousUse(e) {
  const previous = lastExerciseUse(state.lastUsed, e.name);
  if (previous && isSecondsTarget(previous.target) === isSecondsTarget(e.target)) return previous;
  // Older saves could drop the timed marker from the last-used cache.
  for (const date of Object.keys(state.logs).sort().reverse()) {
    for (const workout of [...state.logs[date]].reverse()) {
      const exercise = workout.exercises.find(x => sameExercise(x.name, e.name) &&
        isSecondsTarget(x.target) === isSecondsTarget(e.target) && x.sets.some(set => Number(set.r) > 0));
      if (exercise) return exercise;
    }
  }
}

function rowsFor(e, resume) {
  // Edits never get pre-filled values: only what was logged (or drafted) is shown.
  const lastUsed = s.existing ? [] : previousUse(e)?.sets || [];
  const drafted = resume?.ex[e.name];
  const logged = s.existing?.exercises.find((x) => x.name === e.name)?.sets;
  const source = drafted || logged || null;
  let n = source?.length || rowCount(e);
  if (e.unilateral && n % 2) n++;
  const rows = [];
  for (let r = 0; r < n; r++) {
    const src = source ? source[r] : lastUsed[r];
    rows.push(setRow(e, r, src ? src.w : '', src ? src.r : '', !!(source && source[r] && source[r].done)));
  }
  return rows;
}

function warmupRows(e, resume) {
  const logged=s.existing?.exercises.find(x=>x.name===e.name)?.warmups;
  const source=resume?.warmups?.[e.name] || logged || [];
  let count=Math.max(s.existing ? 0 : e.warmupSets || 0,source.length);
  if(e.unilateral && count%2) count++;
  if(!count) return '';
  return html`<section class="session-warmups"><h4>Warm-up</h4><table class="sets warmup-sets"><thead><tr><th scope="col">Set</th><th scope="col">${e.unilateral ? 'kg per side' : 'kg'}</th><th scope="col">${isSecondsTarget(e.target) ? 'Seconds' : 'Reps'}</th><th scope="col"><span class="sr-only">Done</span></th></tr></thead><tbody>${Array.from({length:count},(_,i)=>setRow(e,i,source[i]?.w || '',source[i]?.r || '',!!source[i]?.done,true))}</tbody></table></section><h4 class="work-set-heading">Working sets</h4>`;
}

function setLabel(e, r) {
  return e.unilateral ? (r % 2 ? 'R' : 'L') + (Math.floor(r / 2) + 1) : String(r + 1);
}

function setRow(e, r, w, reps, done, warmup = false) {
  const label = (warmup ? 'W·' : '') + setLabel(e, r);
  return html`<tr class="set-row${done ? ' done' : ''}"${warmup ? html` data-warmup="true"` : ''}>
    <td class="set-label">${label}</td>
    <td><input class="w" type="number" inputmode="decimal" step="any" min="0" value="${w}" placeholder="kg" aria-label="${exerciseDisplayName(e.name)}, set ${label}, weight in kg${e.unilateral ? ' per side' : ''}"></td>
    <td><input class="r" type="number" inputmode="numeric" step="1" min="0" value="${reps}" placeholder="${isSecondsTarget(e.target) ? 'sec' : 'reps'}" aria-label="${exerciseDisplayName(e.name)}, set ${label}, ${isSecondsTarget(e.target) ? 'seconds' : 'reps'}"></td>
    <td><label class="check"><input type="checkbox" class="d"${done ? ' checked' : ''}${!s.started && !s.retro ? ' disabled' : ''} aria-label="${exerciseDisplayName(e.name)}, set ${label} done"><span aria-hidden="true">${icons.check}</span></label></td>
  </tr>`;
}

function lastText(e) {
  const previous = previousUse(e);
  const sets = (previous?.sets || []).filter((x) => x.w !== '' || x.r !== '');
  if (!sets.length) return '';
  const top = sets.reduce((m, x) => ((parseFloat(x.w) || 0) > (parseFloat(m.w) || 0) ? x : m), sets[0]);
  if (isSecondsTarget(e.target)) {
    if (isTimedCardioExercise(e.name)) return 'Last ' + fmtClock(Number(top.r));
    return 'Last ' + top.r + ' s' + (Number(top.w) > 0 ? ' · ' + top.w + ' kg added' : '');
  }
  return 'Last ' + (top.w || '–') + ' kg × ' + (top.r || '–') + ' reps';
}

function renderSession(resume) {
  $('session').classList.toggle('session-preview', !!s.preview);
  $('sessionMain').closest('footer').hidden = !!s.preview;
  $('sessionTitle').textContent = s.day;
  $('sessionDate').textContent = s.date === ymd() ? 'Today' : fmtLong(s.date);
  replaceContent($('sessionList'), html`
    ${s.preview ? html`<p class="banner-note preview-note">Read-only preview · available ${relativeDay(parseYmd(s.date))}</p>` : ''}
    ${s.existing ? html`<p class="banner-note">You are editing the workout saved on ${fmtShort(s.date)}. Saving replaces it.</p>` : ''}
    ${s.exercises.map((e, i) => {
      const cardio = isTimedCardioExercise(e.name) && isSecondsTarget(e.target);
      const seconds = Number.parseInt(e.target, 10);
      const target = cardio && /^\d+ s$/.test(e.target) ? fmtClock(seconds) : e.target;
      return html`
      <article class="ex-card" data-index="${i}" aria-labelledby="ex-title-${i}">
        <div class="ex-head">
          <div class="ex-title">
            <p class="ex-cat">${categoryLabel(e.cat)}${e.rest ? ' · ' + fmtClock(e.rest) + ' rest' : ''}${e.unilateral ? ' · left/right' : ''}</p>
            <h3 id="ex-title-${i}">${exerciseDisplayName(e.name)}${e.attachment && e.attachment!=='none' ? ' · '+attachmentLabel(e) : ''}</h3>
            <p class="ex-meta">${[target ? 'Target ' + target : '', lastText(e)].filter(Boolean).join(' · ')}<span class="ex-saved" aria-hidden="true">Draft saved</span></p>
          </div>
          <span class="ex-count"><span aria-hidden="true">0/0</span><span class="sr-only"></span></span>
        </div>
        ${e.note ? html`<p class="ex-note">${e.note}</p>` : ''}
        ${warmupRows(e,resume)}
        <table class="sets work-sets">
          <thead><tr><th scope="col">Set</th><th scope="col">${e.unilateral ? 'kg per side' : 'kg'}</th><th scope="col">${cardio ? 'Time (sec)' : isSecondsTarget(e.target) ? 'Seconds' : 'Reps'}</th><th scope="col"><span class="sr-only">Done</span></th></tr></thead>
          <tbody>${rowsFor(e, resume)}</tbody>
        </table>
        ${e.unilateral && !s.preview ? html`<div class="matching-side-actions"></div>` : ''}
        <div class="ex-actions">
          <button type="button" class="btn btn-soft btn-sm" data-add aria-label="Add a set to ${e.name}">${icons.plus} Set</button>
          <button type="button" class="btn btn-ghost btn-sm" data-remove aria-label="Remove the last set of ${e.name}">${icons.minus} Set</button>
        </div>
      </article>`; })}
    ${s.quick && !s.existing ? html`<button type="button" class="btn btn-soft btn-block quick-exercise-add" data-quick-exercise>${icons.plus} Add exercise</button>` : ''}
    <div class="session-end-space"></div>`);
  if (s.preview) $('sessionList').querySelectorAll('input, button, select, textarea').forEach((control) => { control.disabled = true; });
  paintMain();
  updateProgress();
}

function paintMain() {
  const btn = $('sessionMain');
  $('sessionCancel').hidden = !s.started || !!s.existing;
  $('sessionEditPlan').hidden = !s.started;
  $('sessionList').querySelectorAll('.d').forEach((box) => { box.disabled = !!s.preview || (!s.started && !s.retro); });
  btn.textContent = s.existing ? 'Save changes' : s.retro ? 'Save workout' : s.started ? 'Finish workout' : 'Start workout';
  $('sessionClockLabel').textContent = s.preview ? 'Preview' : s.started ? 'In gym' : s.retro ? fmtShort(s.date) : 'Not started';
  if (!s.started) $('sessionClock').textContent = s.existing?.duration ? fmtClock(s.existing.duration) : '0:00';
}

function cards() { return [...$('sessionList').querySelectorAll('.ex-card')]; }
const validSetCount = (input) => Number.isInteger(input.valueAsNumber) && input.valueAsNumber > 0;

function collectSets(card, warmup = false) {
  return [...card.querySelectorAll(warmup ? '.warmup-sets tbody tr' : '.work-sets tbody tr')].map((tr) => ({
    w: tr.querySelector('.w').value.trim(),
    r: tr.querySelector('.r').value.trim(),
    done: tr.querySelector('.d').checked,
  }));
}

function updateProgress() {
  let total = 0, done = 0, partial = 0;
  cards().forEach((card) => {
    const exercise = s.exercises[+card.dataset.index];
    const sets = collectSets(card);
    const progress = workingSetProgress({...exercise, sets});
    total += progress.total;
    done += progress.done;
    partial += progress.partial;
    const count = card.querySelector('.ex-count');
    count.firstElementChild.textContent = progress.done + '/' + progress.total;
    count.lastElementChild.textContent = `${progress.done} of ${progress.total} sets complete${partialSetText(progress.partial)}`;
    card.classList.toggle('complete', progress.total > 0 && progress.done === progress.total);
    const actions = card.querySelector('.matching-side-actions');
    if (actions) render(actions, sets.map((set, i) => {
      if (!set.done || !sets[i ^ 1] || sets[i ^ 1].done) return '';
      const from = setLabel(exercise, i), to = setLabel(exercise, i ^ 1);
      return html`<button type="button" class="btn btn-soft btn-sm" data-match-side="${i}" data-key="match-${i}" aria-label="Log ${to} with the same weight and ${isSecondsTarget(exercise.target) ? 'seconds' : 'reps'} as ${from}">Match ${to} to ${from}</button>`;
    }));
  });
  s.progress = {done, total, partial};
  $('sessionSets').textContent = done + '/' + total + ' sets' + partialSetText(partial);
  $('sessionProgress').style.width = (total ? (done / total) * 100 : 0) + '%';
  $('sessionProgress').parentElement.setAttribute('aria-valuenow', String(total ? Math.round((done / total) * 100) : 0));
  syncWorkoutStatus();
}

function refreshPersonalRecord(exercise, card) {
  if (isSecondsTarget(exercise.target)) return;
  const key = exercise.name;
  const previous = s.prs.get(key) || {baseline: bestCompletedWeight(state.logs, exercise), current: 0};
  const best = collectSets(card).reduce((max, set) =>
    set.done && Number(set.r) > 0 ? Math.max(max, Number(set.w) || 0) : max, 0);
  if (previous.baseline > 0 && best > previous.baseline && best !== previous.current) {
    toast('New PR · ' + exercise.name + ' · ' + best + ' kg', { tone: 'accent' });
  }
  s.prs.set(key, {baseline: previous.baseline, current: best});
}

function partialSetText(n) {
  return n ? ` · ${n} one-sided` : '';
}

function saveDraft(card) {
  if (!s || s.preview) return null;
  const ex = {}, warmups = {}, targets = {};
  cards().forEach((card) => { const name=s.exercises[+card.dataset.index].name; ex[name] = collectSets(card); targets[name] = s.exercises[+card.dataset.index].target; warmups[name] = collectSets(card,true); });
  const draft = { day: s.day, date: s.date, key: s.key, startedAt: s.startedAt, active: Date.now(), ex, warmups, targets,
    attachments: Object.fromEntries(s.exercises.map(e => [e.name, e.attachment || 'none'])),
    ...(s.quick ? { quick: true, quickExercises: s.exercises } : s.existing ? {} : {sessionExercises:s.exercises}),
    ...(s.foodChanged.length ? { nutrition: sanitizeNutrition(pick(s.nutrition, s.foodChanged)), foodChanged: s.foodChanged } : {}) };
  if (writeDraft(s.draftId, draft) && card) showDraftSaved(card);
  return draft;
}

function showDraftSaved(card) {
  const tag = card.querySelector('.ex-saved');
  tag.classList.add('show');
  clearTimeout(tag._t);
  tag._t = setTimeout(() => tag.classList.remove('show'), 1200);
}

function select(card) {
  if (!card) return;
  const e = s.exercises[+card.dataset.index];
  if (s.selected !== e.name) { s.selected = e.name; s.wasWaiting = restState(e, s.doneAt, s.anyAt).remaining > 0; }
  cards().forEach((c) => c.classList.toggle('active', c === card));
  renderRest();
}

function renderRest() {
  const bar = $('restBar');
  syncWorkoutStatus();
  if (state.settings.restTimers === false || !s?.started) { bar.hidden = true; if (s) s.wasWaiting = false; return; }
  const e = s && s.selected && s.exercises.find((x) => x.name === s.selected);
  if (!e || !s.anyAt) { bar.hidden = true; return; }
  const r = restState(e, s.doneAt, s.anyAt);
  bar.hidden = false;
  bar.classList.toggle('ready', r.ready);
  $('restEx').textContent = e.name;
  $('restTime').textContent = r.ready ? 'GO' : fmtClock(r.remaining);
  $('restSub').textContent = r.ready ? 'Rested. You are good to go.' : r.reason === 'same' ? 'Same muscle, full ' + fmtClock(e.rest) + ' rest' : 'Different muscle, short break';
  if (s.wasWaiting && r.ready) { if (!nativeRestAlerts() && state.settings.restVibration !== false) haptic([200, 100, 200]); beep(); $('restAnnounce').textContent = 'Rest over for ' + e.name; }
  s.wasWaiting = !r.ready;
}

function beep() { if (!nativeRestAlerts()) playRestSound(); }
function unlockAudio() { unlockRestAudio(); }

function tick() {
  if (!s) return;
  if (s.started) $('sessionClock').textContent = fmtClock((Date.now() - s.startedAt) / 1000);
  renderRest();
}

async function lockScreen() {
  try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { /* not allowed */ }
}

function unlockScreen() {
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}

// The workout screen is modal: the page behind it must not be focusable or clickable.
function setBackgroundInert(on) {
  ['app', 'bottomNav', 'activeBar'].forEach((id) => { const el = $(id); if (el) el.inert = on; });
}

function closeSession(fromBack) {
  if (!s) return;
  s = null;
  clearInterval(tickTimer);
  unlockScreen();
  $('session').hidden = true;
  $('restBar').hidden = true;
  document.body.classList.remove('session-open');
  setBackgroundInert(false);
  if (!fromBack && closeLayer) closeLayer();
  closeLayer = null;
  dismissUndo(); // an Undo for a set can't act once the workout is closed
  // Show the "Workout running" bar first, so focus can go back to it.
  emit('gym:active-changed');
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  if (document.activeElement !== returnFocus) {
    const fallback = document.querySelector('#activeBar:not([hidden]) button, .page.active [data-start], .page.active h1');
    if (fallback?.matches('h1') && !fallback.hasAttribute('tabindex')) fallback.setAttribute('tabindex', '-1');
    fallback?.focus({ preventScroll: true });
  }
  returnFocus = null;
}

async function start({ quiet = false } = {}) {
  if (!s || s.preview || s.started || starting) return false;
  const current = s;
  starting = true;
  try {
    const other = getActive();
    if (other && other.key !== s.key) {
      const mins = Math.round((Date.now() - other.startedAt) / 60000);
      const ok = await confirmDialog(`${other.day} has been running for ${mins} min. Its sets stay saved as a draft, but its timer stops.`, { title: 'Start this workout instead?', ok: 'Start this one', cancel: 'Keep the other' });
      if (!ok || s !== current) return false;
    } else {
      const ok = await confirmDialog(`Start ${s.day} and its timer?`, { title: 'Start workout?', ok: 'Start workout' });
      if (!ok || s !== current) return false;
    }
    s.started = true;
    s.startedAt = Date.now();
    setActive({ day: s.day, date: s.date, key: s.key, startedAt: s.startedAt, ...(s.quick ? { quick: true } : {}) });
    syncWorkoutStatus({ requestPermission: true });
    saveDraft();
    paintMain();
    tick();
    lockScreen();
    toast(quiet ? 'Workout started. The timer is running.' : 'Workout started. Have a good one!');
    return true;
  } finally { starting = false; }
}

async function cancelWorkout() {
  if (!s || !s.started || s.preview || s.existing) return;
  const current = s;
  const ok = await confirmDialog('Discard this unfinished workout and stop its timer?', { title: 'Cancel workout?', ok: 'Cancel workout', cancel: 'Keep workout', danger: true });
  if (!ok || s !== current) return;
  writeDraft(s.draftId, null);
  const active = getActive();
  if (active && active.key === s.key && active.date === s.date && active.day === s.day) setActive(null);
  closeSession(false);
  toast('Workout cancelled.');
}

async function finish() {
  if (!s || s.preview) return;
  const current = s;
  const all = cards().map((card) => ({ e: s.exercises[+card.dataset.index], sets: collectSets(card), warmups:collectSets(card,true), hasWarmups:!!card.querySelector('.warmup-sets') || !!s.existing?.exercises.find(x=>x.name===s.exercises[+card.dataset.index].name)?.warmups }));
  const entry = all
    .map(({ e, sets, warmups, hasWarmups }) => ({ name: e.name, target: e.target, ...(attachmentFor(e.name,e.attachment)!==undefined?{attachment:e.attachment}:{}), ...(e.unilateral || usesSideRows({name:e.name}) ? {unilateral:!!e.unilateral} : {}), sets: loggedWorkingSets(sets,e.unilateral), ...(hasWarmups ? {warmups:loggedWorkingSets(warmups,e.unilateral)} : {}) }))
    .filter((x) => x.sets.length || x.warmups?.length);
  if (!entry.length) { toast('Log at least one set first.'); return; }
  const {done, total, partial} = s.progress;
  const duration = s.started ? Math.round((Date.now() - s.startedAt) / 1000) : s.existing?.duration;
  const ok = await confirmDialog(
    `${done} of ${total} sets complete${partialSetText(partial)}${duration ? ' · ' + fmtClock(duration) : ''}.`,
    { title: s.existing ? 'Save your changes?' : 'Finish and save this workout?', ok: 'Save workout' },
  );
  if (!ok || s !== current || s.owner !== (account.user?.id ?? null)) return;
  const id = s.existing?.id || (s.key.startsWith(NEW) && s.key !== NEW + 'legacy' ? s.key.slice(NEW.length) : newSessionId());
  // A logged workout that a sync defused while it was open: its text stays defused.
  const stored = s.existing && (state.logs[s.date] || []).find((x) => sessionKey(s.date, x) === sessionKey(s.date, s.existing));
  if (stored && JSON.stringify(stored.exercises) !== s.existingText) {
    entry.forEach((x) => { x.name = defang(x.name); if (x.target) x.target = defang(x.target); [...x.sets,...(x.warmups || [])].forEach((y) => { y.w = defang(String(y.w)); y.r = defang(String(y.r)); }); });
  }
  const time = new Date().toISOString();
  // Sync needs the edit time. Ranks need the time the workout actually occurred.
  const performedAt = s.existing ? s.existing.performedAt ?? s.existing.time ?? ''
    : s.started ? new Date(s.startedAt).toISOString() : time;
  const record = { id, day: s.day, exercises: entry, time, performedAt };
  const nutrition = sanitizeNutrition(s.nutrition);
  if (nutrition) record.nutrition = nutrition;
  if (duration) record.duration = duration;
  const previous = state.logs[s.date];
  const scoring = updatesLastUsed() && Object.values(state.schedule).some(Boolean) && entry.some(e =>
    !isSecondsTarget(e.target) && e.sets.some(set => set.done));
  const ranks = () => strengthStats(state.logs, state.weights, state.workouts, ymd(), state.schedule, state.settings.hiddenStatsExercises || []).exercises;
  const before = scoring ? new Map(ranks().filter(lift => lift.rank).map(lift => [rankSetupKey(lift), lift.rank.score])) : null;
  let list = previous || [];
  const oldKey = s.existing ? sessionKey(s.date, s.existing) : null;
  if (oldKey) list = list.filter((x) => sessionKey(s.date, x) !== oldKey);
  state.logs[s.date] = [...list, record];
  if (!saveLogs()) {
    // Nothing was stored (phone storage full): keep the draft and the running timer.
    state.logs[s.date] = previous;
    toast('This phone’s storage is full, so the workout was not saved. Your sets are kept: free up space or make a backup, then try again.', { tone: 'error', ms: 9000 });
    return;
  }
  // Sessions saved before ids existed are keyed by their time, which changes now.
  if (oldKey && oldKey !== record.id) markSessionsDeleted([oldKey]);
  if (updatesLastUsed()) {
    entry.forEach(({ name, target, sets }) => {
      const filled = trimSets(sets);
      if (filled.length) state.lastUsed[name] = { sets: filled, ...(isSecondsTarget(target) ? { target } : {}), updatedAt: Date.now() };
    });
    saveLastUsed();
  }
  writeDraft(s.draftId, null);
  const active = getActive();
  if (active && active.key === s.key && active.date === s.date) setActive(null);
  const quickRoutine = s.quick && !s.existing ? sanitizeWorkout(s.exercises.filter(exercise => entry.some(logged => logged.name === exercise.name))) : null;
  const changed = before && ranks().find(lift => lift.rank && lift.rank.score !== before.get(rankSetupKey(lift)));
  const owner = s.owner;
  closeSession(false);
  haptic(30);
  const oldScore = changed ? before.get(rankSetupKey(changed)) : undefined;
  const totalLP = score => Math.min(700, score) * 4 + Math.max(0, score - 700);
  const delta = oldScore === undefined ? 0 : totalLP(changed.rank.score) - totalLP(oldScore);
  const earnedLP = delta ? ` (${delta > 0 ? '+' : ''}${delta} LP)` : '';
  const savedMessage = changed
    ? `Workout saved. ${changed.name}: ${rankText(changed.rank.score)}${earnedLP} from ${changed.bestSet.w} ${changed.rank.unit} × ${changed.bestSet.r}.`
    : 'Workout saved' + (duration ? ' · ' + fmtClock(duration) : '') + '.';
  toast(savedMessage, quickRoutine?.length ? {
    ms: 10000, action: { label: 'Save as routine', shortcut: false, onClick: () => saveQuickRoutine(owner, quickRoutine) },
  } : { ms: changed ? 5000 : 2600 });
}

async function saveQuickRoutine(owner, exercises) {
  if ((account.user?.id ?? null) !== owner) return;
  const invalid = value => {
    const name = sanitizeWorkoutName(value);
    return !name ? 'Give the routine a name.' : Object.hasOwn(state.workouts, name) ? 'A routine already uses this name.' : '';
  };
  const value = await promptDialog({ title: 'Save as routine', label: 'Routine name', ok: 'Save routine', validate: invalid });
  if (value === null || (account.user?.id ?? null) !== owner || invalid(value)) return;
  createWorkout(sanitizeWorkoutName(value), exercises);
  toast('Routine saved to Plan.');
}

// Food and drink before or after the session: what (quick picks and/or a
// short note), when, and optionally water and protein. No calories on purpose.
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k]).map((k) => [k, obj[k]]));

/** The open workout's food: the saved workout's, with the sides changed in its draft taken from the draft. */
function draftFood(resume, existing) {
  const saved = sanitizeNutrition(existing?.nutrition) || {};
  if (!resume || !('nutrition' in resume)) return { nutrition: saved, foodChanged: [] };
  // Drafts from before per-side tracking changed both sides.
  const changed = Array.isArray(resume.foodChanged) ? resume.foodChanged.filter((k) => k === 'pre' || k === 'post') : ['pre', 'post'];
  const fromDraft = sanitizeNutrition(resume.nutrition) || {};
  const nutrition = { ...saved };
  changed.forEach((k) => { if (fromDraft[k]) nutrition[k] = fromDraft[k]; else delete nutrition[k]; });
  return { nutrition, foodChanged: changed };
}

/**
 * The food and drink sheet for one side ('pre' or 'post'). Resolves with
 * { entry } (entry null when removed), or null when cancelled.
 */
export function foodSheet(side, current) {
  const now = current || { items: [], note: '', when: '' };
  const label = side === 'pre' ? 'Before training' : 'After training';
  return openSheet({
    title: label,
    subtitle: 'Food and drink. Saved with this workout; friends never see it.',
    className: 'food-sheet',
    body: html`
      <fieldset class="field"><legend>What</legend>
        <div class="chips wrap">${ITEMS.map(([id, name]) => html`<button type="button" class="chip${now.items.includes(id) ? ' on' : ''}" aria-pressed="${now.items.includes(id) ? 'true' : 'false'}" data-item="${id}">${name}</button>`)}</div></fieldset>
      <label class="field"><span>Details (optional)</span><input class="input" name="note" maxlength="${NOTE_MAX}" value="${now.note}" placeholder="e.g. banana and oats" autocomplete="off"></label>
      <fieldset class="field"><legend>When</legend>
        <div class="chips wrap" role="radiogroup">${TIMES[side].map(([id, name], i) => html`<button type="button" class="chip${now.when === id ? ' on' : ''}" role="radio" aria-checked="${now.when === id ? 'true' : 'false'}" tabindex="${now.when === id || (!now.when && i === 0) ? '0' : '-1'}" data-when="${id}">${name}</button>`)}</div></fieldset>
      <div class="food-amounts">
        <label class="field"><span>Water (ml, optional)</span><input class="input" name="water" aria-describedby="food-error" type="number" inputmode="numeric" min="0" max="5000" step="1" value="${now.water ?? ''}"></label>
        <label class="field"><span>Protein (g, optional)</span><input class="input" name="protein" aria-describedby="food-error" type="number" inputmode="decimal" min="0" max="300" step="0.1" value="${now.protein ?? ''}"></label>
      </div>
      <p class="form-error" id="food-error" aria-live="polite"></p>`,
    actions: [
      {
        label: 'Save', tone: 'primary', submit: true,
        onClick: (finish, sheet) => {
          const field = (n) => sheet.querySelector(`[name=${n}]`);
          // badInput: something typed that is not a number (the field's value is then empty).
          const bad = ['water', 'protein'].find((n) => field(n).validity.badInput || (field(n).value !== '' && !field(n).checkValidity()));
          ['water', 'protein'].forEach((n) => (n === bad ? field(n).setAttribute('aria-invalid', 'true') : field(n).removeAttribute('aria-invalid')));
          if (bad) { sheet.querySelector('.form-error').textContent = bad === 'water' ? 'Water: a whole number from 0 to 5000 ml.' : 'Protein: a number from 0 to 300 g (one decimal).'; field(bad).focus(); return; }
          finish({
            entry: sanitizeEntry({
              items: [...sheet.querySelectorAll('[data-item][aria-pressed="true"]')].map((b) => b.dataset.item),
              note: field('note').value,
              when: sheet.querySelector('[data-when][aria-checked="true"]')?.dataset.when || '',
              water: field('water').value,
              protein: field('protein').value,
            }, side),
          });
        },
      },
      ...(current ? [{ label: 'Remove', tone: 'ghost', value: { entry: null } }] : []),
      { label: 'Cancel', tone: 'ghost', value: null },
    ],
    onMount: (sheet) => {
      // "Nothing" and the other picks exclude each other.
      const picks = [...sheet.querySelectorAll('[data-item]')];
      const press = (b, on) => { b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); };
      picks.forEach((b) => {
        b.onclick = () => {
          const on = b.getAttribute('aria-pressed') !== 'true';
          press(b, on);
          if (on) picks.filter((x) => x !== b && (x.dataset.item === 'nothing' || b.dataset.item === 'nothing')).forEach((x) => press(x, false));
        };
      });
      const radios = [...sheet.querySelectorAll('[data-when]')];
      radios.forEach((b) => {
        b.onclick = () => {
          // A second tap clears the choice (it is optional).
          const on = b.getAttribute('aria-checked') !== 'true';
          // The chip used keeps the tab stop, also when its choice was cleared.
          radios.forEach((x) => { const sel = x === b && on; x.setAttribute('aria-checked', String(sel)); x.classList.toggle('on', sel); x.tabIndex = x === b ? 0 : -1; });
        };
      });
    },
  });
}

/**
 * Accessible name of a food button: it starts with the button's visible text
 * (so voice control finds it), then says which side and what was logged.
 */
export function foodLabel(visible, side, entry) {
  return `${visible} ${side === 'pre' ? 'food before' : 'food after'}${entry ? ': ' + entrySummary(entry, side) : ''}`;
}



export function initSession() {
  initWorkoutStatus(() => {
    const a = getActive();
    if (!a) return;
    if (s) closeSession(false);
    openSession(a.day, a.date, { key: a.key });
  });
  const settingsChanged = () => {
    if (state.settings.restTimers === false && s) { s.doneAt = {}; s.anyAt = 0; s.wasWaiting = false; }
    if (s) renderRest(); else syncWorkoutStatus();
  };
  listen('gym:settings-changed', settingsChanged);
  listen('gym:preferences-updated', settingsChanged);
  listen('gym:active-changed', () => syncWorkoutStatus());
  listen('gym:logs-updated', () => syncWorkoutStatus());
  // Routines renamed by the sync's defusing: the running workout and drafts follow.
  listen('gym:routines-renamed', (e) => Object.entries(e.detail || {}).forEach(([from, to]) => renameRunningWorkout(from, to)));
  // A sync defused exercise names in the open workout's routine: the workout
  // follows, so it is saved (and its last-used values kept) under the new names.
  listen('gym:plan-updated', () => {
    if (s?.preview) return;
    const routine = new Map((state.workouts[s?.day] || []).map((e) => [e.name, e]));
    if (!s || !routine.size) return;
    let changed = false;
    s.exercises = s.exercises.map((e, i) => {
      const clean = defang(e.name);
      const now = routine.get(e.name) || (clean !== e.name ? routine.get(clean) : null);
      if (!now) return e;
      // The routine has the defused name or target: the workout takes it.
      const target = now.target !== e.target && now.target === defang(e.target || '') ? now.target : e.target;
      if (now.name === e.name && target === e.target) return e;
      changed = true;
      if (now.name !== e.name) {
        const title = document.getElementById('ex-title-' + i);
        if (title) title.textContent = now.name;
        // Its last-used values move along, so there are not two for one exercise.
        if (state.lastUsed[e.name] && !state.lastUsed[now.name]) state.lastUsed[now.name] = { ...state.lastUsed[e.name], updatedAt: Date.now() };
        delete state.lastUsed[e.name];
      }
      return { ...e, name: now.name, target };
    });
    if (changed) { saveDraft(); saveLastUsed(); }
  });
  const root = $('session');
  replaceContent(root, html`
    <header class="session-top">
      <div class="session-top-row">
        <button type="button" class="icon-btn" id="sessionBack" aria-label="Close workout">${icons.back}</button>
        <div class="session-heading">
          <p class="eyebrow" id="sessionDate"></p>
          <h2 id="sessionTitle" tabindex="-1"></h2>
        </div>
        <div class="session-clock"><span id="sessionClock">0:00</span><small id="sessionClockLabel">Not started</small></div>
      </div>
      <div class="session-detail-row">
        <div class="session-progress-row">
          <div class="progress" role="progressbar" aria-label="Sets done" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="sessionProgress"></div></div>
          <span id="sessionSets">0/0 sets</span>
        </div>
        <button type="button" class="btn btn-soft btn-sm" id="sessionEditPlan" hidden>Edit plan</button>
      </div>
    </header>
    <div class="session-scroll" id="sessionList"></div>
    <div class="rest-bar" id="restBar" hidden role="timer" aria-live="off">
      <div class="rest-main"><b id="restEx"></b><small id="restSub"></small></div>
      <span class="rest-time" id="restTime"></span>
      <button type="button" class="btn btn-ghost btn-sm" id="restSkip">Skip</button>
    </div>
    <p class="sr-only" id="restAnnounce" aria-live="polite"></p>
    <footer class="session-footer"><button type="button" class="btn btn-primary btn-lg" id="sessionMain">Start workout</button><button type="button" class="btn btn-ghost btn-sm" id="sessionCancel">Cancel workout</button></footer>`);

  $('sessionBack').onclick = () => closeSession(false);
  $('sessionEditPlan').onclick = () => {
    if (!s?.started) return;
    const name = s.quick ? null : s.day;
    saveDraft();
    closeSession(false);
    emit('gym:edit-running-plan', name);
  };
  listen('gym:open-update', () => closeSession(false));
  $('sessionCancel').onclick = cancelWorkout;
  $('sessionMain').onclick = () => { if (!s || s.preview) return; unlockAudio(); if (s.retro || s.started) finish(); else start(); };
  $('restSkip').onclick = () => {
    const e = s && s.exercises.find((x) => x.name === s.selected);
    if (!e) return;
    // Like the original app: skip the rest for this muscle group only.
    s.doneAt[muscleGroup(e.cat)] = 0;
    s.anyAt = 0;
    renderRest();
  };
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && s && !document.querySelector('.sheet-backdrop')) closeSession(false); });

  const list = $('sessionList');
  on(list, 'click', '[data-match-side]', (event, button) => {
    if (!s || (!s.started && !s.retro) || s.preview) return;
    const rows = button.closest('.ex-card').querySelector('.work-sets tbody').rows;
    const i = Number(button.dataset.matchSide);
    const source = rows[i], target = rows[i ^ 1];
    if (!source?.querySelector('.d').checked || !target || target.querySelector('.d').checked) return;
    for (const field of ['.w', '.r']) target.querySelector(field).value = source.querySelector(field).value;
    const checkbox = target.querySelector('.d');
    checkbox.focus({preventScroll:true});
    checkbox.click();
  });
  on(list, 'click', '[data-quick-exercise]', async () => {
    if (!s?.quick || s.existing) return;
    const current = s;
    const entry = await pickWorkoutExercise(current.exercises, state.lastUsed);
    if (!entry || s !== current || s.owner !== (account.user?.id ?? null)) return;
    if (s.exercises.some(exercise => sameExercise(exercise.name, entry.name))) return;
    const draft = saveDraft();
    s.exercises.push(defaultExerciseSetup(entry));
    renderSession(draft);
    saveDraft();
    list.querySelector('[data-quick-exercise]')?.focus({ preventScroll: true });
    list.querySelector('.ex-card:last-of-type')?.scrollIntoView({ block: 'nearest' });
  });
  list.addEventListener('focusin', (e) => {
    if (!s) return;
    if (e.target.matches('input[type=number]')) setTimeout(() => { try { e.target.select(); } catch { /* ignore */ } }, 0);
    select(e.target.closest('.ex-card'));
  });
  list.addEventListener('click', (e) => { if (!s) return; unlockAudio(); select(e.target.closest('.ex-card')); });
  on(list, 'click', '[data-add]', (e, btn) => {
    if (!s) return;
    const card = btn.closest('.ex-card'), ex = s.exercises[+card.dataset.index], body = card.querySelector('.work-sets tbody');
    const n = body.rows.length;
    const add = ex.unilateral ? 2 : 1;
    for (let k = 0; k < add; k++) appendContent(body, setRow(ex, n + k, '', '', false));
    updateProgress(); saveDraft(card);
  });
  on(list, 'click', '[data-remove]', (e, btn) => {
    if (!s) return;
    const card = btn.closest('.ex-card'), ex = s.exercises[+card.dataset.index], body = card.querySelector('.work-sets tbody');
    const step = ex.unilateral ? 2 : 1;
    if (body.rows.length <= step) return;
    const removed = [...body.rows].slice(-step);
    const values = removed.map((tr) => ({ w: tr.querySelector('.w').value, r: tr.querySelector('.r').value, done: tr.querySelector('.d').checked }));
    removed.forEach((tr) => tr.remove());
    updateProgress(); saveDraft(card);
    // A filled set can be brought back.
    if (values.some((v) => v.w || v.r || v.done)) {
      toast('Set removed.', {
        action: {
          label: 'Undo',
          onClick: () => {
            if (!s || !card.isConnected) return;
            values.forEach((v) => appendContent(body, setRow(ex, body.rows.length, v.w, v.r, v.done)));
            updateProgress(); saveDraft(card);
          },
        },
      });
    }
  });
  list.addEventListener('input', (e) => {
    if (!s) return;
    const card = e.target.closest('.ex-card');
    if (!card) return;
    if (e.target.matches('.r') && !validSetCount(e.target)) {
      const row = e.target.closest('tr'), done = row.querySelector('.d');
      if (done.checked) {
        done.checked = false;
        row.classList.remove('done');
        updateProgress();
      }
    }
    saveDraft(card);
  });
  list.addEventListener('change', (e) => {
    if (!s) return;
    const card = e.target.closest('.ex-card');
    if (!card) return;
    const ex = s.exercises[+card.dataset.index];
    if (e.target.classList.contains('d')) {
      const row = e.target.closest('tr');
      const count = row.querySelector('.r');
      if (e.target.checked && !validSetCount(count)) {
        e.target.checked = false;
        toast(isSecondsTarget(ex.target) ? 'Enter the time in seconds first.' : 'Enter your reps first.');
        count.focus({ preventScroll: true });
        saveDraft();
        return;
      }
      row.classList.toggle('done', e.target.checked);
      if(row.hasAttribute('data-warmup')) { saveDraft(card); return; }
      const wasComplete = card.classList.contains('complete');
      updateProgress();
      if (e.target.checked) {
        if (!reducedMotion()) {
          card.querySelector('.ex-count').animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: .4 }, { transform: 'scale(1)' }],
            { duration: 220, easing: 'ease-out' },
          );
        }
        haptic(15);
        // Starting the timer is an explicit, confirmed action.
        s.doneAt[muscleGroup(ex.cat)] = Date.now();
        s.anyAt = Date.now();
        s.selected = ex.name;
        s.wasWaiting = true;
        if (!wasComplete && card.classList.contains('complete')) {
          const next = card.nextElementSibling;
          if (next && next.classList.contains('ex-card')) setTimeout(() => {
            const focus = document.activeElement;
            if (card.isConnected && card.classList.contains('complete') && !(card.contains(focus) && focus.matches('.w, .r'))) {
              next.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
            }
          }, 450);
        }
        renderRest();
      }
      refreshPersonalRecord(ex, card);
    } else if (e.target.matches('.work-sets .w, .work-sets .r')) {
      const row = e.target.closest('tr');
      if (row.querySelector('.d').checked) refreshPersonalRecord(ex, card);
    }
    saveDraft(card);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { if (s?.started) lockScreen(); syncWorkoutStatus(); }
  });
  syncWorkoutStatus();
}
