import { html, raw, on, toast, busyAttr } from '../core/dom.js';
import { listen } from '../core/store.js';
import { cut } from '../core/text.js';
import { refresh, currentPage } from '../core/router.js';
import { account } from '../cloud/sync.js';
import * as social from '../cloud/social.js';
import { sharedThemes, removeSharedTheme } from '../cloud/themes.js';
import { state, createWorkout, saveSettings } from '../state.js';
import { sanitizeWorkoutName, workoutSummary, deepPlain } from '../domain/plan.js';
import { applyAppearance, cleanThemePresets } from '../domain/appearance.js';
import { applyTheme } from './theme.js';
import { icons } from './icons.js';
import { openSheet, confirmDialog, promptDialog } from './sheet.js';

const sharing = { shared: null, sharedThemes: null };
const pending = new Set();
const me = () => account.user?.id;
let owner = null, generation = 0, loading = null, queued = false;
function refreshView() { refresh('plan'); refresh('settings'); }
function reset() { if (owner !== me()) { owner = me(); generation++; sharing.shared = null; sharing.sharedThemes = null; } }
export async function loadSharing() {
  reset();
  if (!me() || !account.ready) return;
  if (loading) { queued = true; return loading; }
  const id = me(), revision = generation;
  loading = (async () => {
    try {
      const [r, themes] = await Promise.all([social.loadSharedWorkouts(), sharedThemes().catch(() => null)]);
      if (me() !== id || revision !== generation) return;
      sharing.shared = r.error ? { error: r.error } : r.data; sharing.sharedThemes = themes; refreshView();
    } catch (error) { if (me() === id && revision === generation) { sharing.shared = { error: error.message }; refreshView(); } }
  })().finally(() => { loading = null; if (queued) { queued = false; loadSharing(); } });
  return loading;
}
async function act(key, run, success) {
  if (pending.has(key)) return false;
  const id = me(); pending.add(key); refreshView();
  try {
    const result = await run();
    if (me() !== id) return false;
    if (result?.error) { toast(result.error, { tone: 'error' }); return false; }
    if (success) toast(success); return true;
  } catch (error) { if (me() === id) toast(error.message, { tone: 'error' }); return false; }
  finally { pending.delete(key); refreshView(); }
}
export function sharedRoutinesPanel() {
  reset(); if (!me()) return '';
  const shared = sharing.shared;
  return html`    <div class="shared-routines-heading"><h2 class="section-title" data-key="shared-title">Shared routines</h2><button type="button" class="btn btn-soft btn-sm" data-manage-routine-sharing${busyAttr(pending.has('share-routines'))}>Share routines</button></div>
    ${!shared ? html`<p class="muted" data-key="shared-loading">Loading…</p>` : shared.error ? html`<p class="notice error" data-key="shared-error">${shared.error} <button type="button" class="link-btn inline" data-retry-sharing>Try again</button></p>` : shared.length ? html`<div class="card list" data-key="shared-list">${shared.map((x) => html`
      <div class="row" data-key="shared-${x.id}"><div class="row-main"><b>${x.title}</b><small>${x.mine ? 'Shared by you' : '@' + (x.owner?.username || 'friend')} · ${workoutSummary(x.workout)}</small></div>
        ${x.mine ? html`<button type="button" class="btn btn-ghost btn-sm" data-unshare="${x.id}" aria-label="Stop sharing ${x.title}">Remove</button>` : html`<button type="button" class="btn btn-soft btn-sm" data-copy-shared="${x.id}" aria-label="Copy ${x.title} to my plan">${icons.copy} Copy</button>`}</div>`)}</div>`
      : html`<p class="muted small" data-key="shared-none">No shared routines.</p>`}
`;
}


export function sharedThemesPanel() { reset(); if (!me()) return ''; return html`    <h2 class="section-title">Shared themes</h2>
    ${sharing.sharedThemes?.length ? html`<div class="card list">${sharing.sharedThemes.map(t => html`<div class="row"><div class="row-main"><b>${t.name}</b><small>${'@' + (t.username || t.owner?.username || 'friend') + (t.recipient_id == null ? ' · Everyone' : ' · Private')}</small></div>${html`<button type="button" class="btn btn-soft btn-sm" data-use-shared-theme="${t.id}">Use theme</button>`}${t.owner_id === me() || t.recipient_id === me() ? html`<button type="button" class="icon-btn" data-remove-shared-theme="${t.id}" aria-label="Remove shared theme ${t.name}">${icons.x}</button>` : ''}</div>`)}</div>` : html`<p class="muted small">${sharing.sharedThemes === null ? 'No shared themes available.' : 'No shared themes.'}</p>`}`; }
export function initSharing() {
  on(document, 'click', '[data-manage-routine-sharing]', async () => {
    if (pending.has('share-routines')) return;
    const uid = me(), workouts = structuredClone(state.workouts), names = Object.keys(workouts);
    if (!names.length) { toast('Create a routine first.'); return; }
    pending.add('share-routines'); refreshView();
    try {
      const result = await social.loadSharedWorkouts();
      if (me() !== uid) return;
      if (result.error) throw new Error(result.error);
      const mine = result.data.filter(item => item.mine);
      const selected = await openSheet({ title: 'Share routines with friends',
        body: html`<label class="routine-share-option"><input type="checkbox" data-share-all><b>All routines</b></label><div class="list">${names.map(name => html`<label class="routine-share-option"><input type="checkbox" data-share-routine="${name}"${mine.some(item => item.title === name) ? raw(' checked') : ''}><span><b>${name}</b><small>${workoutSummary(workouts[name])}</small></span></label>`)}</div>`,
        actions: [{ label: 'Save sharing', tone: 'primary', onClick: (finish, sheet) => finish([...sheet.querySelectorAll('[data-share-routine]:checked')].map(input => input.dataset.shareRoutine)) }, { label: 'Cancel', value: null, tone: 'ghost' }],
        onMount: sheet => {
          const all = sheet.querySelector('[data-share-all]'), inputs = [...sheet.querySelectorAll('[data-share-routine]')];
          const update = () => { all.checked = inputs.every(input => input.checked); all.indeterminate = !all.checked && inputs.some(input => input.checked); };
          all.onchange = () => { inputs.forEach(input => { input.checked = all.checked; }); update(); };
          inputs.forEach(input => { input.onchange = update; }); update();
        },
      });
      if (selected === null || me() !== uid) return;
      await social.setRoutineSharing(selected, workouts, uid);
      if (me() === uid) { await loadSharing(); toast('Sharing updated.'); }
    } catch (error) { if (me() === uid) { toast(error.message, { tone: 'error' }); loadSharing(); } }
    finally { pending.delete('share-routines'); refreshView(); }
  });
  on(document, 'click', '[data-use-shared-theme]', (e, button) => {
    const item = sharing.sharedThemes?.find(t => t.id === button.dataset.useSharedTheme);
    if (!item || !applyAppearance(state.settings, item.appearance)) return;
    const presets = cleanThemePresets(state.settings.themePresets), id = 'shared-' + item.id;
    if (presets.some(p => p.id === id) || presets.length < 20) state.settings.themePresets = [...presets.filter(p => p.id !== id), { id, name: item.name, appearance: item.appearance }];
    saveSettings(); applyTheme(); refreshView(); toast('Theme applied and saved.');
  });
  on(document, 'click', '[data-remove-shared-theme]', async (e, button) => {
    try { await removeSharedTheme(button.dataset.removeSharedTheme); await loadSharing(); }
    catch (error) { toast(error.message, { tone: 'error' }); }
  });
  on(document, 'click', '[data-copy-shared]', async (e, b) => {
    const user = me();
    const item = (Array.isArray(sharing.shared) ? sharing.shared : []).find((x) => x.id === b.dataset.copyShared);
    if (!item) return;
    const name = await promptDialog({
      title: 'Copy routine', label: 'Name in your plan', value: cut(sanitizeWorkoutName(item.title).trim(), 40), maxLength: 40, ok: 'Copy', autofocus: false,
      validate: (v) => (!sanitizeWorkoutName(v) ? 'Give it a name.' : Object.hasOwn(state.workouts, sanitizeWorkoutName(v)) ? 'You already have a routine with that name.' : ''),
    });
    if (!name || me() !== user) return;
    createWorkout(sanitizeWorkoutName(name), deepPlain(item.workout));
    toast('Copied to your plan.');
  });
  on(document, 'click', '[data-unshare]', async (e, b) => {
    if (!(await confirmDialog('Friends can no longer copy it. Copies they already made stay with them.', { title: 'Stop sharing this routine?', ok: 'Stop sharing', danger: true }))) return;
    if (await act(b.dataset.unshare, () => social.deleteSharedWorkout(b.dataset.unshare), 'No longer shared.')) loadSharing();
  });

  on(document, 'click', '[data-retry-sharing]', loadSharing);
  listen('gym:account', () => { reset(); if (['plan', 'settings'].includes(currentPage())) loadSharing(); });
}
