import { addableMovements, canAddExercise, chooseMovementVersion, defaultExerciseSetup, recentExerciseEntries } from './exercise-picker.js';
import { hasExplicitEquipment, movementFor, pickerMovement, equipmentOptions, equipmentLabel, changeMovement } from '../domain/movement-groups.js';
import { ATTACHMENTS, attachmentOptions, attachmentFor, attachmentLabel, attachmentHint, GRIPS, gripOptions, gripFor, gripLabel } from '../domain/attachments.js';
import { streakBadge } from './streak.js';
import { measurement, targetValue, withUnit } from '../domain/measurement.js';
import { exerciseFamily, sideLabel, changeExerciseVariant, variantAlreadyIn } from '../domain/exercise-families.js';
import { exerciseDisplayName, matchesExerciseName, sameExercise, workoutExerciseTitle } from '../domain/exercises.js';
// Plan: weekly schedule, routine library and the routine editor.
import { sharedRoutinesPanel, loadSharing } from './sharing.js';
import { $, html, render, on, toast, busyAttr } from '../core/dom.js';
import { DOW, fmtClock, mondayIndex } from '../core/dates.js';
import { go, pushLayer } from '../core/router.js';
import { listen } from '../core/store.js';
import { state, savePlan, saveSettings, createWorkout, deleteWorkout, planTombstones, setPlanTombstones, restImage } from '../state.js';
import { editRestSound } from './rest-sound-editor.js';
import { restSound } from '../domain/rest-sounds.js';
import { editRestDay } from './rest-day-editor.js';
import { sanitizeWorkoutName, sanitizeWorkout, workoutBadge, displaySets, renameInSchedule, MAX_SETS, DEFAULT_TARGET } from '../domain/plan.js';
import { catalogueRegionLabels, CATALOG, GROUP_FILTERS, EQUIPMENT_FILTERS } from '../domain/catalog.js';
import { account } from '../cloud/sync.js';
import { shareWorkout } from '../cloud/social.js';
import { confirmDialog, promptDialog } from './sheet.js';
import { renameRunningWorkout } from './session.js';
import { icons } from './icons.js';
import { choiceField, chooseOption } from './choice.js';

let editing = null; // routine name open in the editor
let editorCopy = null; // what the editor last showed, to offer it back if the routine is deleted elsewhere
let closeEditorLayer = null;
let query = '';
let group = 'All';
let equipment = 'All equipment';
const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];


function weekView() {
  const names = Object.keys(state.workouts);
  const today = mondayIndex(new Date().getDay());
  return html`
    <header class="top" data-view="week"><h1>Plan</h1>
      <div class="top-actions">${streakBadge()}<button type="button" class="icon-btn" data-open-settings aria-label="Settings">${icons.settings}</button></div></header>
    ${!names.length ? html`<button type="button" class="btn btn-primary btn-block" data-new data-key="new">${icons.plus} New workout</button>` : ''}
    <section class="card list plan-week" data-key="week" aria-label="Weekly schedule">
      ${DOW.map((day,i)=>html`<button type="button" class="row row-btn week-slot${i===today?' is-today':''}" aria-haspopup="dialog" data-day="${i}" data-key="wd-${i}" aria-label="${day}: ${state.schedule[i]||'Rest'}" aria-current="${i===today?'date':'false'}">
        <span class="row-day">${day.slice(0,3)}</span><span class="row-main"><b class="${state.schedule[i]?'':'muted'}">${state.schedule[i]||'Rest'}</b></span>${i===today?html`<span class="plan-today-label">Today</span>`:''}<span class="chev">${icons.chevron}</span></button>`)}
    </section>
    <h2 class="section-title" data-key="mine">My workouts</h2>
    ${names.length ? html`<div class="routine-list" data-key="routines">${names.map((n) => {
      return html`<button type="button" class="routine" data-edit="${n}" data-key="routine-${n}">
        <span class="routine-mark" aria-hidden="true">${workoutBadge(n, state.settings)}</span>
        <span class="row-main"><b>${n}</b><small>${state.workouts[n].length} ${state.workouts[n].length===1?'exercise':'exercises'}</small></span>
        <span class="chev">${icons.chevron}</span></button>`;
    })}</div>` : html`<div class="empty-inline" data-key="no-routines"><p>No workouts yet.</p><p class="muted">Create one like Push, Pull, Legs, Upper or Lower.</p></div>`}
    <section class="plan-rest" data-key="rest-controls" aria-label="Rest">
      <button type="button" class="routine rest-day-routine" data-edit-rest-day data-key="rest-day"><img src="${restImage()}" alt=""><span class="row-main"><b>Rest day</b></span><span class="chev">${icons.image}</span></button>
      <button type="button" class="routine rest-alert-option" data-edit-rest-sound data-key="rest-sound"><span class="row-main"><b>Rest alert</b><small>${restSound(state.settings.restSound).name}</small></span><span class="chev">${icons.chevron}</span></button>
    </section>
    ${names.length ? html`<button type="button" class="btn btn-primary btn-block" data-new data-key="new">${icons.plus} New workout</button>` : ''}
    ${sharedRoutinesPanel()}`;
}

function executionControl(e) {
  const family = exerciseFamily(e.name);
  if (family?.variants.length > 1) return choiceField({ label: 'Version', value: sideLabel(e, family), field: 'variant', context: e.name });
  // Custom movements retain manual tracking. Known catalogue entries keep their
  // actual execution instead of offering impossible one-arm barbell versions.
  if (!CATALOG.some(x => sameExercise(x.name, e.name))) return html`<label class="toggle compact side-toggle"><input type="checkbox" data-field="unilateral" aria-label="Track left/right for ${e.name}"${e.unilateral ? ' checked' : ''}><span>Track left/right</span></label>`;
  return html`<span class="exercise-execution">${e.unilateral ? (/leg/i.test(e.name) ? 'One leg / side' : /alternat/i.test(e.name) ? 'Alternating sides' : 'Left/right separately') : 'Both sides together'}</span>`;
}

function exerciseRow(e, index) {
  const name = workoutExerciseTitle(e.name);
  const entry=CATALOG.find(x=>sameExercise(x.name,e.name));
  const sideChoice=exerciseFamily(e.name)?.variants.length>1||!entry;
  const warmup=html`<label class="toggle compact side-toggle warmup-toggle"><input type="checkbox" data-field="warmup" aria-label="Warm-up sets for ${e.name}"${e.warmupSets>0?' checked':''}><span>Warm-up</span></label>`;
  const grip = gripOptions(e.name).length
    ? choiceField({ label: 'Grip', value: gripLabel(e) || GRIPS.default, field: 'grip', context: name }) : '';
  const attachment=attachmentOptions(e.name).length?choiceField({label:'Attachment',value:attachmentLabel(e)||ATTACHMENTS.none,field:'attachment',context:e.name}):'';
  const equipment = entry ? choiceField({ label: 'Equipment', value: equipmentLabel(entry.equipment, movementFor(e.name)), field: 'exercise-equipment', context: name }) : '';
  const setupFields = [equipment, grip];
  if (!sideChoice) setupFields.push(warmup);
  if (attachment) setupFields.push(!sideChoice && !grip ? html`<div class="setup-attachment">${attachment}</div>` : attachment);

  return html`<li class="ex-edit" data-ex="${e.name}" data-key="ex-${e.name}">
    <div class="ex-edit-head">
      <button type="button" class="drag-handle exercise-position" data-drag aria-label="Exercise ${index + 1}: ${e.name}. Drag to reorder or use Alt and arrow up or down." aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" title="Drag to reorder · Alt + ↑ / ↓"><span data-ex-position>${index + 1}</span>${icons.grip}</button>
      <div class="row-main"><b>${name}${e.attachment && e.attachment !== 'none' ? ' · '+attachmentLabel(e) : ''}</b><small>${catalogueRegionLabels(e).join(' / ')}</small></div>

      <button type="button" class="icon-btn sm" data-remove aria-label="Remove ${e.name}">${icons.x}</button>
    </div>
    <div class="exercise-setup${sideChoice?'':' fixed-execution'}">${setupFields}</div>
    ${sideChoice?html`<div class="exercise-options">${executionControl(e)}${warmup}</div>`:''}
    ${e.warmupSets > 0 ? html`<div class="warmup-count field compact"><span>Warm-up sets${e.unilateral ? ' / side' : ''}</span><div class="stepper"><button type="button" data-warmup-count="-1" aria-label="Fewer warm-up sets for ${e.name}">${icons.minus}</button><output>${e.unilateral ? e.warmupSets / 2 : e.warmupSets}</output><button type="button" data-warmup-count="1" aria-label="More warm-up sets for ${e.name}">${icons.plus}</button></div></div>` : ''}
    <div class="ex-edit-fields">
      <div class="field compact"><span>${e.unilateral ? 'Sets / side' : 'Sets'}</span>
        <div class="stepper"><button type="button" data-sets="-1" aria-label="Fewer sets for ${e.name}">${icons.minus}</button><output aria-live="off">${displaySets(e)}</output><button type="button" data-sets="1" aria-label="More sets for ${e.name}">${icons.plus}</button></div></div>
      ${choiceField({ label: 'Measure', value: measurement(e) === 'seconds' ? 'Seconds' : 'Reps', field: 'measurement', context: e.name })}
      <label class="field compact"><span>${measurement(e) === 'seconds' ? 'Seconds' : 'Reps'}</span><input class="input" data-field="target" value="${targetValue(e)}" maxlength="18" placeholder="${measurement(e) === 'seconds' ? '30' : DEFAULT_TARGET}"></label>
      ${choiceField({ label: 'Rest', value: e.rest ? fmtClock(e.rest) : 'None', field: 'rest', context: e.name })}
    </div>

    <label class="field compact"><span class="sr-only">Note for ${e.name}</span><input class="input input-note" data-field="note" value="${e.note}" maxlength="200" placeholder="Note (seat height, grip…)"></label>
  </li>`;
}

function updateLibraryFilters(){
 for(const [id,label,value]of [['exMuscle','Muscle',group==='All'?'All muscles':group],['exEquipment','Equipment',equipmentLabel(equipment)]]){
  const button=$(id);if(!button)continue;button.querySelector('span').textContent=value;button.setAttribute('aria-label',label+': '+value);
 }
}

function searchResults(list) {
  const all = addableMovements(query, group, equipment), results = all.slice(0, 60);
  const recent = !query.trim() && group === 'All' && equipment === 'All equipment'
    ? recentExerciseEntries(state.lastUsed).filter(entry => !variantAlreadyIn(list, entry)) : [];
  return html`<div class="library-results-head"><p class="muted small picks-count" role="status">${all.length} movements${group === 'All' ? '' : ' · ' + group}${all.length > results.length ? ' · showing ' + results.length + ', search to narrow down' : ''}</p>${group!=='All'||equipment!=='All equipment'?html`<button type="button" class="link-btn" data-reset-library>Reset filters</button>`:''}</div>
    ${recent.length ? html`<div class="library-recent"><p class="muted small">Recent</p>${recent.map(entry => html`<button type="button" class="pick" data-add="${entry.name}" data-add-recent data-key="recent-${entry.name}"><span class="row-main"><b>${exerciseDisplayName(entry.name)}</b><small>${equipmentLabel(entry.equipment)}</small></span><span class="pick-tag">${icons.plus} Add</span></button>`)}</div>` : ''}
    ${results.map(x => {
      const available = x.movement.variants;
      const exact = matchesExerciseName(x.name, query) || x.movement.id === 't bar row' && available.length === 1;
      const complete = exact ? variantAlreadyIn(list, x) : available.every(v => variantAlreadyIn(list, v));
      return html`<div class="catalog-pick"><button type="button" class="pick${complete ? ' added' : ''}" data-add="${x.name}" data-movement="${x.movement.id}" data-key="pick-${x.movement.id}"${busyAttr(complete)}>
        <span class="row-main"><b>${x.displayName}</b><small>${catalogueRegionLabels(x).join(' / ')} · ${exact ? equipmentLabel(x.equipment,x.movement) : equipmentOptions(x.movement).length>3 ? equipmentOptions(x.movement).length+' equipment options' : equipmentOptions(x.movement).map(value=>equipmentLabel(value,x.movement)).join(' / ')}</small></span>
        <span class="pick-tag">${complete ? 'Added' : !exact && x.movement.variants.length > 1 ? 'Choose' : html`${icons.plus} Add`}</span></button></div>`;
    })}
    ${!results.length?html`<div class="library-empty">${icons.search}<b>No matching exercises</b><p>Try another name or change the filters.</p></div>`:''}`;
}

function editorView() {
  const name = editing, list = state.workouts[name];
  editorCopy = { name, list: JSON.parse(JSON.stringify(list)) };
  return html`
    <header class="top editor-top" data-view="editor-${name}">
      <button type="button" class="icon-btn" data-close-editor data-key="back" aria-label="Back to my plan">${icons.back}</button>
      <div class="grow"><h1 class="h1-sm">${name}</h1></div>
      <button type="button" class="icon-btn" data-rename data-key="rename" aria-label="Rename workout">${icons.edit}</button>
      ${account.user ? html`<button type="button" class="icon-btn" data-share data-key="share" aria-label="Share with friends">${icons.share}</button>` : ''}
      <button type="button" class="icon-btn danger" data-delete data-key="delete" aria-label="Delete workout">${icons.trash}</button>
    </header>
    <section class="card workout-badge-editor" data-key="workout-badge">
      <label class="field"><span>Workout badge</span><input class="input" data-workout-badge value="${workoutBadge(name, state.settings)}" maxlength="3" autocomplete="off" placeholder="${Array.from(name)[0] || 'W'}" aria-describedby="badgeHint"></label>
      <p class="hint" id="badgeHint">Up to 3 letters shown on your week calendar.</p>
    </section>
    ${list.length ? html`<button type="button" class="btn btn-soft btn-block jump-add" data-jump-exercises data-key="jump-add">${icons.plus} Add exercises</button><ol class="ex-edit-list" data-key="ex-list">${list.map((e, i) => exerciseRow(e, i))}</ol>`
      : html`<div class="empty-inline" data-key="ex-empty"><p>Start with one exercise.</p><p class="muted">Search the library below.</p></div>`}
    <section class="card add-ex" data-key="add-ex">
      <header class="library-head"><h2>Exercise library</h2></header>
      <label class="field library-search"><span class="sr-only">Search the exercise library</span>${icons.search}
        <input class="input" id="exSearch" type="search" value="${query}" placeholder="Search by name, alias or muscle" autocomplete="off" enterkeyhint="search"></label>
      <div class="library-filters">${choiceField({label:'Muscle',value:group==='All'?'All muscles':group,field:'muscle',id:'exMuscle'})}${choiceField({ label: 'Equipment', value: equipmentLabel(equipment), field: 'equipment', id: 'exEquipment' })}</div>
      <div class="picks no-swipe" id="exResults">${searchResults(list)}</div>
    </section>
    <p class="sr-only" role="status" id="planStatus"></p>`;
}

export function renderPlan() {
  const page = $('page-plan');
  if (editing && !Object.hasOwn(state.workouts, editing)) {
    // Deleted on another device or tab: say so, keep focus on the plan, and offer it back.
    const gone = editorCopy, hadFocus = page.contains(document.activeElement);
    // Keep what was being typed, so "Keep it" brings it back too.
    const field = document.activeElement?.closest?.('#page-plan [data-ex] [data-field]');
    if (gone && field?.matches('input:not([type=checkbox]), textarea, select')) {
      const ex = gone.list.find((x) => x.name === field.closest('[data-ex]').dataset.ex);
      if (ex) {
        const key = field.dataset.field;
        ex[key] = key === 'target' ? withUnit(field.value, measurement(ex)) : key === 'rest' ? +field.value : field.value;
      }
    }
    closeEditor();
    render(page, weekView());
    const h = page.querySelector('[data-key="mine"]');
    if (hadFocus && h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    if (gone) {
      toast(`${gone.name} was deleted or renamed on another device or tab.`, {
        action: { label: 'Keep it', onClick: () => { if (!Object.hasOwn(state.workouts, gone.name)) { state.workouts[gone.name] = sanitizeWorkout(gone.list); savePlan(); } openEditor(gone.name); } },
      });
    }
    return;
  }
  render(page, editing ? editorView() : weekView());
}

function openEditor(name) {
  editing = name;
  query = '';
  if (!closeEditorLayer) closeEditorLayer = pushLayer(() => { closeEditorLayer = null; editing = null; renderPlan(); });
  renderPlan();
  window.scrollTo(0, 0);
}

/** Called when the user switches tabs: the editor's back entry must not linger. */
export function leavePlan() {
  if (editing) closeEditor();
}

function closeEditor() {
  editing = null;
  if (closeEditorLayer) { const c = closeEditorLayer; closeEditorLayer = null; c(); }
}

function list() { return state.workouts[editing]; }

/** The exercise a control belongs to, found by name (positions can change under a sync). */
function exerciseOf(el) {
  const l = list();
  if (editing && !l) setTimeout(renderPlan); // the routine went away meanwhile: tell the user
  const name = el.closest('[data-ex]')?.dataset.ex;
  return l && name ? { l, i: l.findIndex((x) => x.name === name), name } : { l: null, i: -1, name };
}

function nameError(v, current) {
  const n = sanitizeWorkoutName(v);
  if (!n) return 'Give it a name.';
  if (n !== current && Object.hasOwn(state.workouts, n)) return 'You already have a workout with that name.';
  return '';
}

async function chooseForDay(i, trigger) {
  const owner = account.user?.id;
  const value = await chooseOption({
    trigger,
    title: DOW[i],
    selected: state.schedule[i] || '',
    options: [
      { value: '', label: 'Rest day', badge: '–' },
      ...Object.keys(state.workouts).map(name => ({ value: name, label: name, badge: workoutBadge(name, state.settings) })),
    ],
  });
  if (value === null || owner !== account.user?.id || (value && !Object.hasOwn(state.workouts, value))) return;
  state.schedule[i] = value || null;
  savePlan({ deliberateRemoval: true });
}

// Drag an exercise by its grip to reorder (from upstream v2.12.3); near the
// top or bottom edge the page scrolls on its own (upstream e622386). The
// Numbered handles also support Alt + Up/Down without opening a picker.
function enableDragReorder(page) {
  page.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag]');
    if (!handle || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const row = handle.closest('.ex-edit'), listEl = row?.parentElement;
    if (!row || !listEl) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    // Rows go by exercise name: a sync or another tab may change the list during the drag.
    const rows = [...listEl.children];
    const from = rows.indexOf(row), name = row.dataset.ex, startY = e.clientY, startScroll = window.scrollY;
    const routine = editing, owner = account.user?.id || null;
    let to = from, before = null, pointerY = e.clientY, raf = 0, moved = false;
    row.classList.add('dragging');
    const update = () => {
      // The row follows the finger, also while the page scrolls under it.
      row.style.transform = `translateY(${pointerY - startY + window.scrollY - startScroll}px)`;
      // Use the finger position so cards of different heights reorder predictably.
      const mid = pointerY;
      const others = rows.filter((r) => r !== row && r.isConnected);
      const above = others.filter((r) => r.getBoundingClientRect().top + r.offsetHeight / 2 < mid).length;
      before = others[above] || null; // dropped in front of this row (null: at the end)
      to = rows.indexOf(before) - (before && rows.indexOf(before) > from ? 1 : 0);
      if (!before) to = others.length;
      rows.forEach((r) => r.classList.toggle('drop-before', r === before));
    };
    const autoScroll = () => {
      if (!row.isConnected) { end({ type: 'pointercancel' }); return; } // the routine went away
      const top = 110, bottom = window.innerHeight - 130; // clear of the header and the bottom bar
      // Only a drag scrolls: a press held still near the edge does nothing.
      const speed = !moved ? 0 : pointerY < top ? -(4 + 20 * Math.min(1, (top - pointerY) / top))
        : pointerY > bottom ? 4 + 20 * Math.min(1, (pointerY - bottom) / 110) : 0;
      if (speed) {
        const before = window.scrollY;
        window.scrollBy(0, Math.round(speed));
        if (window.scrollY !== before) update();
      }
      raf = requestAnimationFrame(autoScroll);
    };
    const move = (ev) => {
      pointerY = ev.clientY;
      if (!moved && Math.abs(pointerY - startY) < 8) return;
      moved = true;
      update();
    };
    // pointerup drops the row; pointercancel (the system took the gesture) puts it back.
    const end = (ev) => {
      cancelAnimationFrame(raf);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      row.classList.remove('dragging');
      row.style.transform = '';
      rows.forEach((r) => r.classList.remove('drop-before'));
      const l = list();
      if (ev.type === 'pointercancel' || editing !== routine || (account.user?.id || null) !== owner || !l || to === from) return;
      const at = l.findIndex((x) => x.name === name);
      if (at < 0 || (before && !l.some((x) => x.name === before.dataset.ex))) return; // changed meanwhile: nothing moves
      const [item] = l.splice(at, 1);
      const place = before ? l.findIndex((x) => x.name === before.dataset.ex) : l.length;
      if (place === at) { l.splice(at, 0, item); return; }
      l.splice(place, 0, item);
      savePlan();
      toast(`${item.name} moved to position ${place + 1}.`);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    raf = requestAnimationFrame(autoScroll);
  });
}

export function initPlan() {
  listen('gym:edit-running-plan', ({detail: name}) => {
    go('plan');
    if (name && Object.hasOwn(state.workouts, name)) openEditor(name);
    const heading = $('page-plan').querySelector('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
  });
  const page = $('page-plan');
  on(page, 'click', '[data-edit-rest-sound]', async () => { await editRestSound(); renderPlan(); });
  enableDragReorder(page);
  on(page, 'change', '[data-workout-badge]', (e, input) => {
    if (!editing) return;
    state.settings.workoutBadges = { ...state.settings.workoutBadges, [editing]: Array.from(input.value.trim()).slice(0, 3).join('').toUpperCase() };
    saveSettings();
    renderPlan();
  });
  on(page, 'click', '[data-day]', (e, b) => chooseForDay(+b.dataset.day, b));
  on(page, 'click', '[data-edit]', (e, b) => openEditor(b.dataset.edit));
  on(page, 'click', '[data-edit-rest-day]', () => editRestDay());
  on(page, 'click', '[data-close-editor]', () => { closeEditor(); renderPlan(); });
  on(page, 'click', '[data-new]', async () => {
    const name = await promptDialog({ title: 'New workout', label: 'Name', placeholder: 'e.g. Push day', maxLength: 40, ok: 'Create', validate: (v) => nameError(v) });
    if (!name) return;
    createWorkout(sanitizeWorkoutName(name));
    openEditor(sanitizeWorkoutName(name));
  });
  on(page, 'click', '[data-rename]', async () => {
    const from = editing;
    const to = await promptDialog({ title: 'Rename workout', label: 'Name', value: from, maxLength: 40, validate: (v) => nameError(v, from) });
    if (!to || sanitizeWorkoutName(to) === from) return;
    const name = sanitizeWorkoutName(to);
    // Rebuild the object so the routine keeps its position in the list.
    const next = {};
    Object.keys(state.workouts).forEach((k) => { next[k === from ? name : k] = state.workouts[k]; });
    state.workouts = next;
    renameInSchedule(state.schedule, from, name);
    const { deleted, restored } = planTombstones();
    setPlanTombstones([...new Set([...deleted, from])].filter((n) => n !== name), [...new Set([...restored.filter((n) => n !== from), ...(deleted.includes(name) ? [name] : [])])]);
    editing = name;
    if (Object.hasOwn(state.settings.workoutBadges || {}, from)) {
      const badges = { ...state.settings.workoutBadges, [name]: state.settings.workoutBadges[from] };
      delete badges[from];
      state.settings.workoutBadges = badges;
      saveSettings();
    }
    renameRunningWorkout(from, name);
    savePlan({ deliberateRemoval: true });
    toast('Renamed. Past logs keep the old name.');
  });
  on(page, 'click', '[data-delete]', async () => {
    const name = editing;
    if (!(await confirmDialog(`“${name}” will be removed from your plan. Your workout history stays.`, { title: 'Delete workout?', ok: 'Delete', danger: true }))) return;
    closeEditor();
    deleteWorkout(name);
    toast('Workout deleted.');
  });
  on(page, 'click', '[data-share]', async () => {
    // Shared from inside the prompt: busy while it sends, once, with any error shown there.
    const routine = list();
    const title = await promptDialog({ title: 'Share with friends', label: 'Title your friends will see', value: editing, maxLength: 80, ok: 'Share', autofocus: false, busy: 'Sharing…', hint: 'Friends can copy this routine into their plan.', submit: async (t) => (await shareWorkout(t, routine)).error || '' });
    if (title) toast('Shared with your friends.');
  });
  on(page,'click','[data-remove]',async(event,button)=>{
    const {l,i}=exerciseOf(button),routine=editing,owner=account.user?.id||null;
    if(!l||i<0)return;
    const exercise=l[i],snapshot=JSON.stringify(exercise);
    if(!await confirmDialog(`Remove “${exerciseDisplayName(exercise.name)}” from this workout? Your logged sets and records stay saved.`,{title:'Remove exercise?',ok:'Remove',cancel:'Keep exercise',danger:true}))return;
    if(editing!==routine||(account.user?.id||null)!==owner)return;
    const current=list(),index=current?.findIndex(e=>e.name===exercise.name)??-1;
    if(index<0||JSON.stringify(current[index])!==snapshot){toast('Exercise changed. Try again.');return;}
    const [removed]=current.splice(index,1);savePlan({deliberateRemoval:true});
    toast(removed.name+' removed.',{action:{label:'Undo',onClick:()=>{
      if((account.user?.id||null)!==owner)return;
      const r=state.workouts[routine];if(!r||r.some(e=>sameExercise(e.name,removed.name)))return;
      r.splice(Math.min(index,r.length),0,removed);savePlan();
    }}});
  });
  on(page,'click','[data-warmup-count]',(event,button)=>{
    const {l,i}=exerciseOf(button); if(!l || i<0) return;
    const ex=l[i],step=ex.unilateral ? 2 : 1;
    ex.warmupSets=Math.max(step,Math.min(step*6,ex.warmupSets+Number(button.dataset.warmupCount)*step));
    savePlan();
  });
  on(page, 'click', '[data-sets]', (e, b) => {
    const { l, i } = exerciseOf(b);
    if (!l || i < 0) return;
    const ex = l[i], step = ex.unilateral ? 2 : 1;
    ex.sets = Math.max(step, Math.min(MAX_SETS * step, ex.sets + +b.dataset.sets * step));
    savePlan();
    // Announce only the change the user made (the counters themselves are silent).
    const status = $('planStatus');
    if (status) status.textContent = `${ex.name}: ${displaySets(ex)} ${ex.unilateral ? 'sets per side' : 'sets'}`;
  });
  on(page, 'click', '[data-jump-exercises]', () => {
    const search = $('exSearch');
    search?.focus({ preventScroll: true });
    search?.scrollIntoView({ block: 'center' });
  });
  on(page, 'keydown', '[data-drag]', (event, button) => {
    if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const { l, i } = exerciseOf(button), step = event.key === 'ArrowUp' ? -1 : 1;
    if (!l || i < 0 || i + step < 0 || i + step >= l.length) return;
    const name = l[i].name;
    const top = button.getBoundingClientRect().top;
    l.splice(i + step, 0, l.splice(i, 1)[0]);
    savePlan();
    if (button.isConnected) window.scrollTo(0, window.scrollY + button.getBoundingClientRect().top - top);
    toast(`${name} moved ${step < 0 ? 'up' : 'down'}.`);
  });
  on(page, 'click', '[data-choice]', async (event, button) => {
    if (['exercise-equipment','attachment','grip'].includes(button.dataset.choice)) {
      const {l,i}=exerciseOf(button);
      if(!l||i<0)return;
      const ex=l[i],snapshot=JSON.stringify(ex),routine=editing,owner=account.user?.id||null;
      const field=button.dataset.choice;
      let result;
      if(field==='attachment'){
        const value=await chooseOption({trigger:button,title:'Attachment',selected:ex.attachment||'none',options:attachmentOptions(ex.name).map(value=>({value,label:ATTACHMENTS[value],description:attachmentHint(ex,value)}))});
        if(!value)return;
        result={exercise:{...ex,attachment:attachmentFor(ex.name,value)}};
      }else if(field==='grip'){
        const value=await chooseOption({trigger:button,title:'Grip',subtitle:'Choose a handle your machine or bar has.',selected:ex.grip||'default',options:gripOptions(ex.name).map(value=>({value,label:GRIPS[value]}))});
        if(!value)return;
        result={exercise:{...ex,grip:gripFor(ex.name,value)}};
      }else{
        const next=await chooseMovementVersion(button,movementFor(ex.name),CATALOG.find(e=>sameExercise(e.name,ex.name)),true,undefined,entry=>sameExercise(ex.name,entry.name)||canAddExercise(entry));
        if(!next)return;
        result=changeMovement(ex,next.name,l);
      }
      if(editing!==routine||(account.user?.id||null)!==owner||!button.isConnected)return;
      const current=exerciseOf(button);
      if(current.i<0||JSON.stringify(current.l[current.i])!==snapshot){toast('Exercise changed. Choose again.');return;}
      if(result.error){toast(result.error);return;}
      const top=button.getBoundingClientRect().top;
      current.l[current.i]=result.exercise;savePlan();renderPlan();
      const next=[...page.querySelectorAll('[data-ex]')].find(row=>row.dataset.ex===result.exercise.name)?.querySelector(`[data-choice="${field}"]`);
      next?.focus({preventScroll:true});
      if(next)window.scrollBy(0,next.getBoundingClientRect().top-top);
      return;
    }
    if (button.dataset.choice === 'variant') {
      const { l, i } = exerciseOf(button);
      if (!l || i < 0) return;
      const ex = l[i], family = exerciseFamily(ex.name), routine = editing, owner = account.user?.id || null;
      if (!family) return;
      const snapshot = JSON.stringify(ex);
      const chosen = await chooseOption({ trigger: button, title: 'Exercise version', subtitle: family.name,
        selected: family.variants.find(v => v.unilateral === !!ex.unilateral)?.name,
        options: family.variants.map(v => ({ value: v.name, label: sideLabel(v, family), description: v.unilateral && v.equipment === 'plate-loaded machine' ? family.limb==='leg'?'Machine must support single-leg use':'Independent arms required' : '' })) });
      if (!chosen || editing !== routine || (account.user?.id || null) !== owner || !button.isConnected) return;
      const current = exerciseOf(button);
      if (current.i < 0 || JSON.stringify(current.l[current.i]) !== snapshot) { toast('Exercise changed. Choose its version again.'); return; }
      const result = changeExerciseVariant(current.l[current.i], chosen, current.l);
      if (result.error) { toast(result.error); return; }
      const top = button.getBoundingClientRect().top;
      current.l[current.i] = result.exercise;
      savePlan(); renderPlan();
      const next = [...page.querySelectorAll('[data-ex]')].find(row => row.dataset.ex === result.exercise.name)?.querySelector('[data-choice=variant]');
      next?.focus({ preventScroll: true });
      if (next) window.scrollBy(0, next.getBoundingClientRect().top - top);
      if (ex.name !== result.exercise.name) toast('Version updated.');
      return;
    }

    const field = button.dataset.choice;
    if (field === 'equipment'||field==='muscle') {
      const routine=editing,owner=account.user?.id||null;
      const value=await chooseOption({trigger:button,title:field==='muscle'?'Muscle group':'Equipment',selected:field==='muscle'?group:equipment,
        options:(field==='muscle'?GROUP_FILTERS:EQUIPMENT_FILTERS).map(value=>({value,label:value==='All'?'All muscles':field==='equipment'?equipmentLabel(value):value}))});
      if(value===null||editing!==routine||(account.user?.id||null)!==owner||!button.isConnected)return;
      if(field==='muscle')group=value;else equipment=value;
      updateLibraryFilters();render($('exResults'),searchResults(list()));
      return;
    }
    const { l, i } = exerciseOf(button), routine = editing, owner = account.user?.id || null;
    if (!l || i < 0) return;
    const exercise = l[i], name = exercise.name;
    const seconds = [...new Set([...REST_OPTIONS, exercise.rest])].sort((a, b) => a - b);
    const value = await chooseOption({ trigger: button, title: field === 'rest' ? 'Rest timer' : 'Set measurement', subtitle: name,
      selected: field === 'rest' ? exercise.rest : measurement(exercise), layout: field === 'rest' ? 'timers' : 'pair',
      options: field === 'rest' ? seconds.map(value => ({ value, label: value ? fmtClock(value) : 'None', description: value ? 'min : sec' : 'No timer' })) : [
        { value: 'reps', label: 'Reps', description: 'Count repetitions' },
        { value: 'seconds', label: 'Seconds', description: 'Time each hold' },
      ],
    });
    if (value === null || editing !== routine || !button.isConnected || (account.user?.id || null) !== owner) return;
    const current = state.workouts[routine]?.find(ex => ex.name === name);
    if (!current) return;
    let undo;
    if (field === 'rest') current.rest = value;
    else if (measurement(current) !== value) {
      const previous = current.target, next = withUnit(value === 'seconds' ? '30' : DEFAULT_TARGET, value);
      current.target = next;
      undo = () => {
        if ((account.user?.id || null) !== owner) return;
        const exercise = state.workouts[routine]?.find(ex => ex.name === name);
        if (!exercise || exercise.target !== next) { toast('Target changed since then.'); return; }
        exercise.target = previous;
        savePlan();
        toast('Measurement restored.');
      };
    }
    else return; // Re-selecting the current unit preserves its custom target.
    savePlan();
    renderPlan();
    if (undo) toast(`${name} now uses ${value}.`, { action: { label: 'Undo', onClick: undo } });
  });
  on(page, 'change', '[data-field]', (e, input) => {
    const { l, i } = exerciseOf(input);
    if (!l || i < 0) return;
    const ex = l[i];
    const field = input.dataset.field;
    if (field === 'unilateral') {
      // Keep the number of sets per side when switching.
      ex.sets = input.checked ? ex.sets * 2 : Math.max(1, Math.round(ex.sets / 2));
      if (ex.warmupSets) ex.warmupSets = input.checked ? Math.min(12,ex.warmupSets * 2) : Math.max(1,Math.round(ex.warmupSets / 2));
      ex.unilateral = input.checked;
      if (input.checked) ex.sides = 'both'; else delete ex.sides;
    } else if (field === 'target') ex.target = withUnit(input.value, measurement(ex));
    else if (field === 'warmup') ex.warmupSets = input.checked ? (ex.unilateral ? 2 : 1) : 0;
    else ex[field] = input.value.trim().slice(0, field === 'note' ? 200 : 20);
    savePlan();
  });
  on(page,'click','[data-reset-library]',()=>{
    group='All';equipment='All equipment';updateLibraryFilters();render($('exResults'),searchResults(list()));$('exSearch')?.focus({preventScroll:true});
  });
  on(page, 'input', '#exSearch', (e, input) => {
    query = input.value;
    render($('exResults'), searchResults(list()));
  });
  const add = (entry) => {
    const {name} = entry;
    const l = list();
    if (!l) return;
    if (l.some((x) => sameExercise(x.name, name))) return;
    l.push(defaultExerciseSetup(entry));
    savePlan();
    toast(exerciseDisplayName(name) + ' added.');
  };

  on(page, 'click', '[data-add]', async (e, b) => {
    let x = CATALOG.find(c => c.name === b.dataset.add);
    if (!x || !canAddExercise(x)) return;
    if (b.hasAttribute('data-add-recent')) { if (!variantAlreadyIn(list() || [], x)) add(x); return; }
    const routine=editing,owner=account.user?.id||null,movement=pickerMovement(x.name,query);
    const explicitEquipment=hasExplicitEquipment(query,x);
    const exact=matchesExerciseName(x.name,query);
    if (exact && variantAlreadyIn(list() || [], x)) return;
    const needsVersion = !exact && !explicitEquipment;
    x=await chooseMovementVersion(b,movement,x,needsVersion && equipment==='All equipment',equipment,v=>canAddExercise(v)&&!variantAlreadyIn(list()||[],v),needsVersion);
    if(!x||editing!==routine||(account.user?.id||null)!==owner||!b.isConnected)return;
    if (x && !variantAlreadyIn(list() || [], x)) add(x);
  });
}

/** Re-render after a data change, but not while the user is typing in the editor. */
export function onPlanUpdated() {
  const page = $('page-plan');
  if (!page.classList.contains('active')) return;
  const focused = document.activeElement;
  const typing = focused && page.contains(focused) && focused.matches('input:not([type=checkbox]), select, textarea');
  if (typing && focused.id !== 'exSearch') return;
  const keepSearch = focused && focused.id === 'exSearch';
  const scroll = window.scrollY;
  // Adding a card grows the routine above the picker. Preserve the visible
  // control's position, rather than restoring a now-stale absolute scrollY.
  const picker = page.querySelector('.add-ex');
  const visible = element => {
    const rect = element.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  };
  const anchor = picker?.contains(focused) && visible(focused) ? focused
    : [...(picker?.querySelectorAll('#exSearch, [data-add], [data-create-exercise]') || [])].find(visible);
  const top = anchor?.getBoundingClientRect().top;
  const pickerTop = anchor && picker?.getBoundingClientRect().top;
  renderPlan();
  const stable = anchor?.isConnected ? anchor : anchor && picker?.isConnected ? picker : null;
  const previousTop = stable === anchor ? top : pickerTop;
  window.scrollTo(0, stable ? window.scrollY + stable.getBoundingClientRect().top - previousTop : scroll);
  if (keepSearch) $('exSearch')?.focus({ preventScroll: true });
}

export function onPlanShown() { loadSharing(); }
