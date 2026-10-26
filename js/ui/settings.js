// Settings: account, privacy, training options, rest-day image, backup, about.
import { $, html, raw, render, on, toast, toastLater, busyAttr } from '../core/dom.js';
import { loadProfilePictures } from '../cloud/profile-pictures.js';
import { loadProfileBanners } from '../cloud/profile-banners.js';
import { editProfileAppearance } from './profile-editors.js';
import { bannerMarkup, paintProfileBanners, profileAvatar } from './profile-banner.js';
import { openMemberProfile } from './profile.js';
import { listen, readText, write, KEYS } from '../core/store.js';
import { pushLayer, go, currentPage } from '../core/router.js';
import { state, saveSettings, loadState, planTombstones, setPlanTombstones } from '../state.js';
import { makeBackup, parseBackup, BACKUP_KEYS } from '../domain/backup.js';
import { sessionKey, exerciseNames } from '../domain/logs.js';
import { cloudConfigured } from '../cloud/client.js';
import {
  account, signIn, signUp, resetPassword, verifyRecoveryCode, updatePassword, signOut, changeUsername,
  deleteAccount, stopSyncs, signOutFinishing,
} from '../cloud/sync.js';
import { shareTheme } from '../cloud/themes.js';
import { THEME_SETS, cleanAppearance, cleanThemePresets, applyAppearance } from '../domain/appearance.js';
import { openSheet, confirmDialog, promptDialog, markBusy } from './sheet.js';
import { icons, navIcons } from './icons.js';
import { APP_VERSION } from '../version.js';
import { PRESETS, sanitizeTheme, themeColors, inkFor } from '../domain/theme.js';
import { applyTheme, currentTheme } from './theme.js';
import { updateOffer, installLatestUpdate } from '../native.js';

const MIN_AGE = 14;

let authMode = 'signin';
const openColorGroups = new Set();
let accentOpen = false;
let previousPage = 'today';
let closeLayer = null;
let busy = false;
let signingOut = false;
let authError = ''; // kept in state so a background re-render does not wipe it
let deleting = false;
let applyingUpdate = false;
let exerciseBoardDraft = '';
const MAX_EXERCISE_BOARDS = 8;

export function openSettings() {
  if (currentPage() === 'settings') return;
  previousPage = currentPage();
  go('settings');
  closeLayer = pushLayer(() => { closeLayer = null; leaveSettings(); });
}

function closeSettings() {
  if (closeLayer) { const c = closeLayer; closeLayer = null; c(); }
  leaveSettings();
}

// Back where the user came from, on the settings button they used.
function leaveSettings() {
  const wasHere = $('page-settings').contains(document.activeElement);
  go(previousPage);
  if (wasHere) document.querySelector('.page.active [data-open-settings]')?.focus({ preventScroll: true });
}

function accountCard() {
  if (!cloudConfigured()) return html`<section class="card"><h2>Account</h2><p class="muted">Accounts are not available in this version of the app.</p></section>`;
  if (!account.user) {
    const signup = authMode === 'signup';
    return html`<form class="card auth" id="authForm" novalidate>
      <div class="segmented small" role="tablist" aria-label="Account">
        <button type="button" role="tab" id="auth-tab-signin" aria-controls="authPanel" aria-selected="${!signup ? 'true' : 'false'}" tabindex="${!signup ? '0' : '-1'}" data-auth-mode="signin">Sign in</button>
        <button type="button" role="tab" id="auth-tab-signup" aria-controls="authPanel" aria-selected="${signup ? 'true' : 'false'}" tabindex="${signup ? '0' : '-1'}" data-auth-mode="signup">Create account</button>
      </div>
      <div id="authPanel" role="tabpanel" aria-labelledby="auth-tab-${authMode}">
      <label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="email" inputmode="email" required></label>
      <label class="field"><span>Password</span><input class="input" name="password" type="password" minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}" ${signup ? html` placeholder="At least 8 characters"` : ''} required></label>
      ${signup ? html`<div class="field"><label for="authUsername">Username</label><div class="input-row"><span class="input-prefix" aria-hidden="true">@</span><input class="input" id="authUsername" name="username" autocomplete="nickname" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="3–20 letters, numbers or _"></div></div>
        <label class="check-row consent"><input type="checkbox" name="consent"> <span>I am ${MIN_AGE} or older, or a parent or guardian agreed.</span></label>` : ''}
      <p class="form-error" aria-live="polite">${authError}</p>
      <button class="btn btn-primary btn-block" type="submit"${busyAttr(busy)}>${busy ? (signOutFinishing() ? 'Finishing the last sign-out…' : 'Please wait…') : signup ? 'Create account' : 'Sign in'}</button>
      ${signup ? '' : html`<button type="button" class="link-btn" data-forgot>Forgot password?</button>`}
      </div>
    </form>`;
  }
  const p = account.profile;
  return html`<section class="card">
    ${bannerMarkup(account.user.id, 'account-banner-preview')}
    <header class="card-head"><div class="account-identity">${profileAvatar(p?.username, 'lg', account.user.id)}<div><h2><button type="button" class="account-profile-link" data-view-my-profile>@${p?.username || '…'}</button></h2><small class="muted">${account.user.email}</small></div></div></header>
    <div class="btn-row profile-edit-actions"><button type="button" class="btn btn-soft" data-edit-picture>Edit picture</button><button type="button" class="btn btn-soft" data-edit-banner>Edit banner</button></div>
    <button type="button" class="btn btn-soft btn-block" data-account-settings>Account settings ${icons.chevron}</button>
  </section>`;
}

function selectedExerciseBoards() {
  if (!Array.isArray(state.settings.leaderboardExercises)) return [];
  return [...new Set(state.settings.leaderboardExercises
    .filter((x) => typeof x === 'string')
    .map((x) => x.trim().slice(0, 80))
    .filter(Boolean))].slice(0, MAX_EXERCISE_BOARDS);
}

function exerciseLeaderboardsCard() {
  const selected = selectedExerciseBoards();
  const options = [...new Set([
    ...exerciseNames(state.logs),
    ...Object.values(state.workouts).flatMap((workout) => workout.map((e) => e.name)),
  ])].sort((a, b) => a.localeCompare(b));
  return html`<section class="card" data-key="exercise-leaderboards">
    <div class="card-head"><h2>Exercise leaderboards</h2><span class="muted small">${selected.length}/8</span></div>
    <form id="exerciseBoardForm" class="exercise-board-form">
      <label class="field"><span>Add an exercise</span>
        <input class="input" id="exerciseBoardName" value="${exerciseBoardDraft}" maxlength="80" placeholder="Search or type an exercise" autocomplete="off" enterkeyhint="done">
      </label>
      <div id="exerciseBoardSuggestions" class="board-suggestions">${boardSuggestions(exerciseBoardDraft, options)}</div>
      <button class="btn btn-soft btn-block" type="submit"${busyAttr(selected.length >= MAX_EXERCISE_BOARDS)}>${icons.plus} Add exercise leaderboard</button>
    </form>
    ${selected.length ? html`<div class="list" data-key="exercise-board-list">${selected.map((name) => html`
      <div class="row" data-key="exercise-board-${name}"><div class="row-main"><b>${name}</b><small>Best weight</small></div>
        <button type="button" class="icon-btn" data-remove-exercise-board="${name}" aria-label="Remove the ${name} leaderboard">${icons.x}</button></div>`)}</div>` : html`<p class="hint" data-key="no-exercise-boards">No exercise leaderboards yet.</p>`}
  </section>`;
}

function boardSuggestions(value, options = [...new Set([...exerciseNames(state.logs), ...Object.values(state.workouts).flatMap(list => list.map(e => e.name))])]) {
  if (!value.trim()) return '';
  const selected = selectedExerciseBoards();
  return html`${options.filter(name => !selected.includes(name) && name.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 5).map(name => html`<button type="button" class="row row-btn" data-board-suggestion="${name}"><span>${name}</span>${icons.plus}</button>`)}`;
}

function appearancePreview() {
  return html`<div class="preview-slot" data-key="appearance-preview"${openColorGroups.size ? '' : raw(' hidden')}><div class="appearance-preview">
    <div class="preview-caption"><b>Preview</b></div>
    <div class="preview-screen" role="img" aria-label="Live theme preview showing a workout badge, streak, button, input field and selected navigation tab">
      <div class="preview-card" aria-hidden="true">
        <div class="preview-workout"><span class="preview-badge">P</span><div class="grow"><b>Push day</b></div><span class="preview-streak">${icons.flame} 3</span></div>
        <div class="preview-controls"><span class="input preview-field">8–12 reps</span><span class="btn btn-secondary btn-sm">Edit workout</span></div>
      </div>
      <div class="preview-nav" aria-hidden="true"><span class="preview-tab active">${navIcons.today}<span>Today</span></span><span class="preview-tab">${navIcons.plan}<span>Plan</span></span><span class="preview-tab">${navIcons.stats}<span>Stats</span></span></div>
    </div>
  </div></div>`;
}

function anchorPreview() {
  const page = $('page-settings');
  if (!page?.classList.contains('active')) return;
  const slot = page.querySelector('.preview-slot'), preview = slot?.querySelector('.appearance-preview');
  if (!preview) return;
  if (slot.hidden) { preview.classList.remove('preview-pinned'); return; }
  const bounds = slot.getBoundingClientRect();
  const top = Math.max(8, page.querySelector('.editor-top').getBoundingClientRect().bottom + 8);
  const pinned = bounds.top + 12 <= top && slot.closest('[data-key="appearance"]').getBoundingClientRect().bottom > top;
  slot.style.minHeight = (preview.offsetHeight + 32) + 'px';
  preview.style.setProperty('--preview-top', top + 'px');
  preview.style.setProperty('--preview-left', bounds.left + 'px');
  preview.style.setProperty('--preview-width', bounds.width + 'px');
  preview.classList.toggle('preview-pinned', pinned);
}

// Only the sample changes while a native color picker is open. The existing
// change handlers commit settings; closing/canceling a picker restores the sample.
function previewColor(input) {
  const preview = $('page-settings')?.querySelector('.preview-screen');
  if (!preview || !/^#[0-9a-f]{6}$/i.test(input.value)) return;
  const set = (name, value) => preview.style.setProperty(name, value);
  const color = input.value;
  if (input.matches('[data-custom-color]')) {
    const t = themeColors(sanitizeTheme({ ...currentTheme(), preset: 'custom', color }), currentTheme().shown);
    for (const [key, value] of [['--accent', t.accent], ['--accent-soft', t.soft], ['--accent-text', t.text], ['--accent-ink', t.ink]]) set(key, value);
  }
  const tokens = [
    ['background-color', '--page-bg'], ['surface-color', '--surface'], ['text-color', '--text'],
    ['border-color', '--line'], ['button-text-color', '--button-text'], ['button-color', '--control-bg'],
    ['selected-color', '--selected-bg'], ['selected-text-color', '--selected-ink'], ['input-color', '--field-bg'],
    ['badge-color', '--badge-bg'], ['streak-color', '--streak-bg'], ['update-color', '--update-bg'],
    ['nav-color', '--nav-selected-bg'], ['nav-text-color', '--nav-selected-ink'],
  ];
  for (const [attribute, token] of tokens) if (input.hasAttribute('data-' + attribute)) set(token, color);
  if (input.matches('[data-surface-color]')) {
    set('--surface-2', 'color-mix(in srgb, var(--surface) 88%, var(--text))');
    set('--surface-3', 'color-mix(in srgb, var(--surface) 78%, var(--text))');
  }
  if (input.matches('[data-text-color]')) { set('--muted', color); set('--dim', color); }
  if (input.matches('[data-border-color]')) set('--line-strong', color);
  for (const [attribute, ink] of [['button-color', '--control-ink'], ['badge-color', '--badge-ink'], ['streak-color', '--streak-ink']]) {
    if (input.hasAttribute('data-' + attribute)) set(ink, inkFor(color));
  }
  if (input.matches('[data-selected-color]') && !state.settings.selectedTextColor) set('--selected-ink', inkFor(color));
  if (input.matches('[data-nav-color]') && !state.settings.navTextColor) set('--nav-selected-ink', inkFor(color));
}

function appearanceCard() {
  const t = currentTheme();
  const backgroundColor = state.settings.backgroundColor || (t.shown === 'light' ? '#f5f6f8' : '#0d0e10');
  const surfaceColor = state.settings.surfaceColor || (t.shown === 'light' ? '#ffffff' : '#16181b');
  const textColor = state.settings.textColor || (t.shown === 'light' ? '#14171a' : '#f2f4f6');
  const borderColor = state.settings.borderColor || (t.shown === 'light' ? '#d6dae0' : '#30343a');
  const buttonTextColor = state.settings.buttonTextColor || textColor;
  const fieldColor = t.shown === 'light' ? '#eef0f3' : '#202328';
  const groups = [
    ['Screen', [
      ['background-color', 'backgroundColor', 'Page background', backgroundColor],
      ['surface-color', 'surfaceColor', 'Cards and panels', surfaceColor],
      ['text-color', 'textColor', 'Main text', textColor],
      ['border-color', 'borderColor', 'Borders', borderColor],
    ]],
    ['Buttons and fields', [
      ['button-color', 'buttonColor', 'Button backgrounds', surfaceColor],
      ['update-color', 'updateColor', 'Update section', surfaceColor],
      ['button-text-color', 'buttonTextColor', 'Button text', buttonTextColor],
      ['input-color', 'inputColor', 'Input fields', fieldColor],
      ['selected-color', 'selectedColor', 'Selected controls', t.accent],
      ['selected-text-color', 'selectedTextColor', 'Selected text', t.ink],
    ]],
    ['Bottom navigation', [
      ['nav-color', 'navColor', 'Highlight', state.settings.selectedColor || t.accent],
      ['nav-text-color', 'navTextColor', 'Icon and text', state.settings.navColor ? inkFor(state.settings.navColor) : state.settings.selectedTextColor || (state.settings.selectedColor ? inkFor(state.settings.selectedColor) : t.ink)],
    ]],
    ['Workout and streak', [
      ['badge-color', 'badgeColor', 'Workout badges', t.accent],
      ['streak-color', 'streakColor', 'Streak background', t.accent],
    ]],
  ];
  const bases = [['dark', 'Dark'], ['light', 'Light'], ['system', 'Match phone']];
  const radio = (on, attrs, label, swatch = '', stop = on) => html`<button type="button" class="chip${on ? ' on' : ''}" role="radio" aria-checked="${on ? 'true' : 'false'}" tabindex="${stop ? '0' : '-1'}"${attrs}>${swatch}${label}</button>`;
  return html`<section class="card" data-key="appearance">
    <h2>Appearance</h2>
    ${appearancePreview()}
    <div class="field"><span id="weekStyleLabel">This week style</span><div class="chips wrap" role="radiogroup" aria-labelledby="weekStyleLabel">${[['circles', 'Circles and dashes'], ['boxes', 'Boxes']].map(([value, label]) => radio((state.settings.weekStyle === 'boxes' ? 'boxes' : 'circles') === value, raw(` data-week-style="${value}"`), label))}</div></div>
    <div class="theme-section"><h3>Theme</h3>${themeLibrary()}
    <div class="field"><span id="baseLabel">Mode</span>
      <div class="chips wrap" role="radiogroup" aria-labelledby="baseLabel">${bases.map(([v, l]) => radio(t.base === v, raw(` data-base="${v}"`), l))}</div></div>
    <details class="accent-options"${accentOpen ? raw(' open') : ''}><summary>Accent color</summary><div class="field"><span id="colorLabel" class="sr-only">Accent colors</span>
      <div class="chips wrap" role="radiogroup" aria-labelledby="colorLabel">${PRESETS.map((p, i) => radio(t.preset === p.id, raw(` data-preset="${p.id}"`), p.name, html`<span class="swatch" data-swatch="${p.id}" aria-hidden="true"></span>`, t.preset === p.id || (t.preset === 'custom' && i === 0)))}</div>
      <label class="color-pick"><input type="color" data-custom-color value="${t.preset === 'custom' ? t.color : t.accent}"> <span>Your own color${t.preset === 'custom' ? ' (chosen)' : ''}</span></label>
    </div>
    </details><div class="customize-colors" data-key="customize-colors">
      ${groups.map(([title, colors]) => html`<details class="color-group" data-color-group="${title}"${openColorGroups.has(title) ? raw(' open') : ''}><summary>${title}</summary><div class="background-color-controls">${colors.map(([attribute, key, label, fallback]) => html`<label class="color-pick"><input type="color"${raw(' data-' + attribute)} aria-label="${title === 'Bottom navigation' ? 'Bottom navigation ' + label.toLowerCase() : label === 'Input fields' ? 'Input fields and set controls' : label === 'Workout badges' ? 'Workout letter badges' : label}" value="${state.settings[key] || fallback}"><span>${label}</span></label>`)} </div></details>`)}
      <button type="button" class="link-btn inline" data-reset-background>Reset custom colors</button>
    </div>
    </div>
  </section>`;
}

function themeLibrary() {
  const activeAppearance = JSON.stringify(cleanAppearance(state.settings));
  const presets = cleanThemePresets(state.settings.themePresets);
  return html`<div class="theme-grid">${THEME_SETS.map(p => html`<button type="button" class="theme-tile" data-theme-set="${p.id}" aria-pressed="${activeAppearance === JSON.stringify(cleanAppearance(p.appearance)) ? 'true' : 'false'}"><span class="theme-palette" aria-hidden="true">${['backgroundColor', 'buttonColor', 'selectedColor'].map(key => html`<i data-theme-swatch="${p.id}" data-theme-tone="${key}"></i>`)}</span><b>${p.name}</b></button>`)}</div>
    <div class="theme-presets">${presets.map(p => html`<div class="theme-preset-row" data-key="preset-${p.id}"><button type="button" class="btn btn-soft theme-preset-name" data-use-theme="${p.id}">${p.name}</button>${account.user ? html`<button type="button" class="icon-btn" data-share-theme="${p.id}" aria-label="Share ${p.name}">${icons.share}</button>` : ''}<button type="button" class="icon-btn" data-delete-theme="${p.id}" aria-label="Delete preset ${p.name}">${icons.trash}</button></div>`)}</div>
    <button type="button" class="btn btn-soft btn-sm" data-save-theme>${icons.plus} Save current theme</button>`;
}

function trainingCard() {
  return html`<section class="card" data-key="training">
    <h2>Training</h2>
    <label class="check-row"><input type="checkbox" data-rest-timers${state.settings.restTimers !== false ? ' checked' : ''}><span>Rest timers</span></label>

  </section>`;
}

function backupCard() {
  const switched = !!readText(KEYS.switchBackup);
  return html`<section class="card" data-key="backup">
    <h2>Backup</h2>
    <div class="btn-row">
      <button type="button" class="btn btn-soft" data-backup-file>${icons.download} Save file</button>
      <button type="button" class="btn btn-soft" data-backup-copy>${icons.copy} Copy</button>
      <button type="button" class="btn btn-soft" data-restore>${icons.upload} Restore</button>
    </div>
    ${switched ? html`<p class="hint">This phone kept a copy of the data from before another account signed in. <button type="button" class="link-btn inline" data-switch-backup>Save it as a file</button></p>` : ''}
    <input type="file" id="restoreFile" accept="application/json,.json,.txt" hidden>
  </section>`;
}

function dangerCard() {
  return account.user ? html`<button type="button" class="btn btn-danger" data-delete-account${busyAttr(deleting)}>${deleting ? 'Deleting…' : 'Delete account'}</button>` : '';
}

function setAuthError(message) {
  authError = message;
  renderSettings();
}

export function renderSettings() {
  const accountKey = document.activeElement?.closest?.('#page-settings [data-key^="account-"], #page-settings [data-key="danger"]')?.dataset.key;
  render($('page-settings'), html`
    <header class="top editor-top" data-view="settings">
      <button type="button" class="icon-btn" data-close-settings aria-label="Back">${icons.back}</button>
      <div class="grow"><h1 class="h1-sm">Settings</h1></div></header>
    <div data-key="account-${account.user ? 'in' : 'out'}">${accountCard()}</div>
    ${appearanceCard()}
    ${trainingCard()}
    ${account.user ? exerciseLeaderboardsCard() : ''}
    ${backupCard()}
    <div class="notice update-notice" data-key="update">${updateOffer()?.reinstall ? html`<b${raw(' tabindex="-1"')}>${updateOffer().title}</b>` : ''}
      ${updateOffer()?.reinstall ? html`<p class="small">This update is signed with a different key than the app on this phone (for example a test build), so Android can't install it over it.</p>
        <ol class="plain small"><li>Settings → Backup → Save file (or, if you are signed in, check that your account says “Synced”).</li><li>Uninstall Gym Tracker.</li><li>Install the new version from the download page, then restore or sign in.</li></ol>` : ''}
      <div class="update-row"><span class="update-version" aria-label="Current version ${APP_VERSION}">v${APP_VERSION}</span><button type="button" class="btn btn-primary btn-sm" data-apply-update${busyAttr(applyingUpdate)}>${applyingUpdate ? 'Working…' : updateOffer()?.action || 'Install latest update'}</button></div></div>`);
  // Color dots as they are shown in this theme (set through the CSS object model; inline styles are blocked).
  const shown = currentTheme().shown;
  $('page-settings').querySelectorAll('[data-swatch]').forEach((el) => { el.style.setProperty('background', themeColors({ preset: el.dataset.swatch }, shown).accent); });
  $('page-settings').querySelectorAll('[data-theme-swatch]').forEach(el => {
    const theme = THEME_SETS.find(p => p.id === el.dataset.themeSwatch);
    el.style.backgroundColor = theme.appearance[el.dataset.themeTone];
  });
  anchorPreview();
  paintProfileBanners($('page-settings'));
  // Signed in or out from within the account card: focus its new heading.
  const card = $('page-settings').querySelector('[data-key^="account-"]');
  if (accountKey && card && card.dataset.key !== accountKey) {
    const h = card.querySelector('h2') || card.querySelector('[role=tab][tabindex="0"]');
    if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
}

function backupText() {
  return makeBackup((k) => localStorage.getItem(k), APP_VERSION);
}

function download(text, name) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function restoreFrom(text) {
  if (!String(text || '').trim()) { toast('Paste the backup text first.', { tone: 'error' }); return; }
  let data;
  try { data = parseBackup(text); } catch (e) { toast(e.message, { tone: 'error' }); return; }
  const ok = await confirmDialog(account.user
    ? 'Everything on this phone is replaced by the backup. At the next sync, your routines and week return to how they are in the backup (also if they were changed or deleted since), and workouts already in your account are merged back in.'
    : 'Everything on this phone is replaced by the backup.', { title: 'Restore this backup?', ok: 'Restore', danger: true });
  if (!ok) return;
  // A sync on its way would mark the restored data as checked when it lands.
  stopSyncs();
  // Replace everything: keys the backup does not have are removed, not kept.
  BACKUP_KEYS.forEach((k) => { if (!(k in data)) localStorage.removeItem(k); });
  Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
  // This phone's copy changed wholesale: forget what it last saw in the cloud.
  // Deletion records are not taken from a backup file (anyone could have
  // written it, and the account keeps its own).
  [KEYS.planBase, KEYS.drafts, KEYS.draft, KEYS.active, KEYS.deletedSessions, KEYS.deletedDates].forEach((k) => localStorage.removeItem(k));
  state.sync.syncedWeightDates = [];
  state.sync.pendingWeightDeletes = {};
  localStorage.setItem(KEYS.sync, JSON.stringify(state.sync));
  loadState();
  saveSettings(); // Restored preferences are new edits for the current account.
  // What the backup holds comes back, also if it was deleted in the account since.
  state.sync.restoredSessions = Object.entries(state.logs).flatMap(([d, list]) => list.map((x) => sessionKey(d, x)));
  state.sync.dirtyWeightDates = state.weights.map((x) => x.date);
  // A backup file can come from anyone: what it adds to the account is defused at the next sync
  // (all of it: nothing restored counts as unchanged since a sign-out).
  state.sync.untrusted = { plan: true, data: true };
  localStorage.removeItem(KEYS.trustedSnapshot);
  localStorage.setItem(KEYS.sync, JSON.stringify(state.sync));
  // The backup's routines and week count as changed now, so they win over
  // deletions and edits made in the account since.
  const now = Date.now(), names = Object.keys(state.workouts);
  write(KEYS.planTimes, { workouts: Object.fromEntries(names.map((n) => [n, now])), schedule: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, now])), restImage: now });
  // Deletion records are not taken from a backup file either (the account keeps its own).
  const { restored } = planTombstones();
  setPlanTombstones([], [...new Set([...restored, ...names])]);
  toast('Backup restored.');
  setTimeout(() => location.reload(), 600);
}

async function forgotPassword() {
  // Each step waits for the server inside its own prompt ("Saving…"), so no
  // answer arrives later and opens something while the user is elsewhere.
  const email = await promptDialog({ title: 'Reset password', label: 'Your account email', type: 'email', value: $('authForm')?.email.value || '', ok: 'Send email', busy: 'Sending…', maxLength: 120, submit: resetPassword });
  if (!email) return;
  // The email has a link (opens the web app) and, if the project's email
  // template includes it, a code that works right here, e.g. in the Android app.
  const code = await promptDialog({
    title: 'Check your email',
    label: 'Code from the email',
    hint: 'Or tap the link in the email instead. It opens Gym Tracker in your browser.',
    ok: 'Continue', busy: 'Checking…', maxLength: 10, type: 'text', input: { inputmode: 'numeric', autocomplete: 'one-time-code' },
    validate: (v) => (/^\d{6,10}$/.test(v) ? '' : 'Enter the code from the email.'),
    submit: (v) => verifyRecoveryCode(email, v),
  });
  if (!code) return;
  // On success the PASSWORD_RECOVERY event asks for the new password.
}

export function initSettings() {
  const page = $('page-settings');
  on(page, 'click', '[data-account-settings]', async () => {
    const id = account.user?.id;
    if (!id) return;
    let unlisten;
    try {
      await openSheet({ title: 'Account settings', className: 'account-settings-sheet',
        body: html`<p class="muted small">${account.user.email}</p><div class="account-options"><div class="btn-row"><button type="button" class="btn btn-soft" data-change-username>Change username</button><button type="button" class="btn btn-soft" data-change-password>Change password</button><button type="button" class="btn btn-ghost" data-signout${busyAttr(signingOut)}>Sign out</button>${dangerCard()}</div></div>`,
        onMount(sheet, close) {
          sheet.addEventListener('click', event => {
            if (event.target.closest('[data-change-username], [data-change-password], [data-signout], [data-delete-account]')) close();
          });
          unlisten = listen('gym:account', () => { if (account.user?.id !== id) close(); });
        },
      });
    } finally { unlisten?.(); }
  });
  const useTheme = appearance => { if (applyAppearance(state.settings, appearance)) { saveSettings(); applyTheme(); renderSettings(); } };
  on(page, 'click', '[data-theme-set]', (e, button) => useTheme(THEME_SETS.find(p => p.id === button.dataset.themeSet)?.appearance));
  on(page, 'click', '[data-use-theme]', (e, button) => useTheme(cleanThemePresets(state.settings.themePresets).find(p => p.id === button.dataset.useTheme)?.appearance));
  on(page, 'click', '[data-save-theme]', async () => {
    const uid = account.user?.id, appearance = cleanAppearance(state.settings), presets = cleanThemePresets(state.settings.themePresets);
    if (presets.length >= 20) { toast('You can save up to 20 themes.'); return; }
    const name = await promptDialog({ title: 'Save theme', label: 'Theme name', maxLength: 40, ok: 'Save', validate: value => !value.trim() ? 'Give it a name.' : presets.some(p => p.name.toLowerCase() === value.trim().toLowerCase()) ? 'Choose a different name.' : '' });
    if (!name || account.user?.id !== uid) return;
    state.settings.themePresets = [...presets, { id: crypto.randomUUID(), name: name.trim(), appearance }];
    saveSettings(); renderSettings(); toast('Theme saved.');
  });
  on(page, 'click', '[data-delete-theme]', async (e, button) => {
    const uid = account.user?.id, id = button.dataset.deleteTheme;
    if (!await confirmDialog('Remove this saved preset?', { title: 'Delete theme?', ok: 'Delete', danger: true }) || account.user?.id !== uid) return;
    state.settings.themePresets = cleanThemePresets(state.settings.themePresets).filter(p => p.id !== id);
    saveSettings(); renderSettings();
  });
  on(page, 'click', '[data-share-theme]', async (e, button) => {
    const uid = account.user?.id, preset = cleanThemePresets(state.settings.themePresets).find(p => p.id === button.dataset.shareTheme);
    if (!uid || !preset) return;
    if (!await confirmDialog('Everyone signed in can use this theme.', { title: 'Share ' + preset.name + '?', ok: 'Share with everyone' }) || account.user?.id !== uid) return;
    try { await shareTheme(preset, uid); if (account.user?.id === uid) toast('Theme shared with everyone.'); }
    catch (error) { if (account.user?.id === uid) toast(error.message, { tone: 'error' }); }
  });
  window.addEventListener('scroll', anchorPreview, { passive: true });
  window.addEventListener('resize', anchorPreview);
  on(page, 'toggle', 'details.color-group', (event, group) => {
    if (group.open) openColorGroups.add(group.dataset.colorGroup); else openColorGroups.delete(group.dataset.colorGroup);
    const slot = page.querySelector('.preview-slot');
    if (slot) slot.hidden = openColorGroups.size === 0;
    anchorPreview();
  }, true);
  on(page, 'click', '[data-close-settings]', closeSettings);
  on(page, 'input', '#exerciseBoardName', (e, input) => { exerciseBoardDraft = input.value; render($('exerciseBoardSuggestions'), boardSuggestions(input.value)); });
  on(page, 'click', '[data-board-suggestion]', (e, button) => {
    const input = $('exerciseBoardName'); input.value = button.dataset.boardSuggestion; exerciseBoardDraft = input.value;
    input.blur(); $('exerciseBoardForm').requestSubmit();
  });
  on(page, 'submit', '#exerciseBoardForm', (e) => {
    e.preventDefault();
    const name = String($('exerciseBoardName')?.value || '').trim().slice(0, 80);
    if (!name) { $('exerciseBoardName')?.focus(); return; }
    const selected = selectedExerciseBoards();
    if (selected.some((x) => x.toLowerCase() === name.toLowerCase())) { toast('That exercise leaderboard already exists.'); return; }
    if (selected.length >= MAX_EXERCISE_BOARDS) { toast('You can add up to ' + MAX_EXERCISE_BOARDS + ' exercise leaderboards.'); return; }
    state.settings.leaderboardExercises = [...selected, name];
    exerciseBoardDraft = '';
    saveSettings();
    renderSettings();
    toast(name + ' leaderboard added.');
  });
  on(page, 'toggle', '.accent-options', (event, group) => { accentOpen = group.open; }, true);
  on(page, 'click', '[data-remove-exercise-board]', (e, button) => {
    const name = button.dataset.removeExerciseBoard;
    state.settings.leaderboardExercises = selectedExerciseBoards().filter((x) => x !== name);
    saveSettings();
    renderSettings();
    toast(name + ' leaderboard removed.');
  });
  on(page, 'click', '[data-auth-mode]', (e, b) => { authMode = b.dataset.authMode; authError = ''; renderSettings(); $('auth-tab-' + authMode)?.focus({ preventScroll: true }); });
  on(page, 'submit', '#authForm', async (e) => {
    e.preventDefault();
    const f = e.target;
    authError = '';
    const email = f.email.value.trim(), password = f.password.value;
    const signup = authMode === 'signup';
    const username = signup ? f.username.value.trim().toLowerCase() : '';
    if (!/^\S+@\S+\.\S+$/.test(email)) { setAuthError('Enter a valid email address.'); return; }
    if (password.length < 8) { setAuthError('Use a password with at least 8 characters.'); return; }
    if (signup && !/^[a-z0-9_]{3,20}$/.test(username)) { setAuthError('Usernames have 3–20 letters, numbers or _.'); return; }
    if (signup && !f.consent.checked) { setAuthError(`Please confirm you are ${MIN_AGE} or older, or have a parent's permission.`); f.consent.focus(); return; }
    if (busy) return;
    const toast = toastLater();
    busy = true; renderSettings();
    const r = signup ? await signUp(email, password, username) : await signIn(email, password);
    busy = false;
    if (r === 'confirm-email') { toast('Account created. Check your email to confirm it, then sign in.', { ms: 6000 }); authMode = 'signin'; renderSettings(); return; }
    if (r) { setAuthError(r); return; }
    toast(signup ? 'Welcome! Your account is ready.' : 'Signed in. Syncing your workouts…');
    renderSettings();
  });
  on(page, 'click', '[data-forgot]', forgotPassword);
  // Each choice signs out inside the sheet ("Syncing…"), so its result and the
  // "Not synced yet" question come while the user is still in it, never later.
  const signOutStep = (choice) => async (finish, sheet, button) => {
    if (signingOut) return;
    signingOut = true; renderSettings();
    let done = markBusy(sheet, button, 'Syncing…');
    try {
      const r = await signOut({ removeLocalData: choice === 'remove', everywhere: choice === 'everywhere' });
      if (r !== 'not-synced') { finish(r === 'everywhere-failed' ? r : r === 'unsynced' ? 'out-unsynced' : choice === 'everywhere' ? 'out-everywhere' : 'out'); return; }
      done(); done = null;
      const next = await openSheet({
        title: 'Not synced yet',
        body: html`<p class="sheet-text">Some workouts on this phone have not reached your account yet (no connection?). If you remove the data now, they are lost.</p>`,
        actions: [
          { label: 'Sign out, keep data here', value: 'keep', tone: 'primary' },
          { label: 'Remove anyway', value: 'remove', tone: 'danger' },
          { label: 'Stay signed in', value: null, tone: 'ghost' },
        ],
      });
      if (!next) { finish('stayed'); return; }
      done = markBusy(sheet, button, 'Signing out…');
      await signOut({ removeLocalData: next === 'remove', force: true });
      finish(next === 'remove' ? 'removed' : 'kept');
    } finally {
      done?.();
      signingOut = false; renderSettings();
    }
  };
  on(document, 'click', '[data-signout]', async () => {
    if (signingOut) return;
    const result = await openSheet({
      title: 'Sign out?',
      body: html`<p class="sheet-text">If someone else uses this phone, remove your workouts from it. They stay in your account. Signing out here keeps your other devices signed in; if one was lost or shared, sign out everywhere.</p>`,
      actions: [
        { label: 'Sign out, keep data here', tone: 'secondary', onClick: signOutStep('keep') },
        { label: 'Sign out and remove my data', tone: 'danger', onClick: signOutStep('remove') },
        { label: 'Sign out on all devices', tone: 'secondary', onClick: signOutStep('everywhere') },
        { label: 'Cancel', value: null, tone: 'ghost' },
      ],
    });
    const messages = {
      out: 'Signed out.',
      'out-everywhere': 'Signed out here and on all your other devices.',
      'out-unsynced': 'Signed out. Your latest changes had not reached your account yet (no connection?); they stay on this phone.',
      removed: 'Signed out and removed from this phone.',
      kept: 'Signed out. Your data stays on this phone.',
      stayed: 'You are still signed in. Nothing was removed.',
    };
    if (result === 'everywhere-failed') toast('Signed out here, but your other devices could not be signed out (no connection?). Try again online, or change your password.', { tone: 'error' });
    else if (messages[result]) toast(messages[result], { ms: result === 'out-unsynced' ? 7000 : 2600 });
  });
  on(document, 'click', '[data-change-password]', async () => {
    const pw = await promptDialog({ title: 'Change password', label: 'New password', type: 'password', maxLength: 72, ok: 'Save password', input: { autocomplete: 'new-password' }, trim: false, validate: (v) => (v.length >= 8 ? '' : 'Use at least 8 characters.'), submit: updatePassword });
    if (pw) toast('Password changed.');
  });
  on(document, 'click', '[data-change-username]', async () => {
    const name = await promptDialog({ title: 'Change username', label: 'Username', value: account.profile?.username || '', maxLength: 20, hint: 'Friends find you by this exact name.', validate: (v) => (/^[a-z0-9_]{3,20}$/.test(v.toLowerCase()) ? '' : 'Use 3–20 letters, numbers or _.'), submit: changeUsername });
    if (name) toast(`Username changed to @${name.toLowerCase()}.`);
  });
  const setTheme = (change) => {
    state.settings.theme = sanitizeTheme({ ...sanitizeTheme(state.settings.theme), ...change });
    saveSettings();
    applyTheme();
    renderSettings();
  };
  on(page, 'input', 'input[type="color"]', (e, input) => previewColor(input));
  on(page, 'focusout', 'input[type="color"]', () => page.querySelector('.preview-screen')?.removeAttribute('style'));
  on(page, 'click', '[data-base]', (e, b) => setTheme({ base: b.dataset.base }));
  on(page, 'change', '[data-rest-timers]', (e, input) => {
    state.settings.restTimers = input.checked;
    saveSettings();
  });
  on(page, 'click', '[data-week-style]', (e, button) => {
    state.settings.weekStyle = button.dataset.weekStyle;
    saveSettings();
    renderSettings();
  });
  on(page, 'click', '[data-preset]', (e, b) => setTheme({ preset: b.dataset.preset }));
  on(page, 'change', '[data-custom-color]', (e, input) => setTheme({ preset: 'custom', color: input.value }));
  on(page, 'change', '[data-background-color]', (e, input) => {
    state.settings.backgroundColor = input.value.toLowerCase();
    saveSettings();
    applyTheme();
    renderSettings();
  });
  on(page, 'change', '[data-surface-color]', (e, input) => {
    state.settings.surfaceColor = input.value.toLowerCase();
    saveSettings();
    applyTheme();
    renderSettings();
  });
  on(page, 'change', '[data-text-color]', (e, input) => {
    state.settings.textColor = input.value.toLowerCase();
    saveSettings();
    applyTheme();
    renderSettings();
  });
  on(page, 'click', '[data-reset-background]', () => {
    delete state.settings.backgroundColor;
    delete state.settings.surfaceColor;
    delete state.settings.textColor;
    delete state.settings.borderColor;
    delete state.settings.trainColor;
    delete state.settings.buttonTextColor;
    for (const key of ['updateColor', 'buttonColor', 'selectedColor', 'selectedTextColor', 'inputColor', 'badgeColor', 'streakColor', 'navColor', 'navTextColor']) delete state.settings[key];
    saveSettings();
    applyTheme();
    renderSettings();
  });
  for (const [selector, key] of [['[data-border-color]', 'borderColor'], ['[data-button-text-color]', 'buttonTextColor'], ['[data-button-color]', 'buttonColor'], ['[data-update-color]', 'updateColor'], ['[data-selected-color]', 'selectedColor'], ['[data-selected-text-color]', 'selectedTextColor'], ['[data-input-color]', 'inputColor'], ['[data-badge-color]', 'badgeColor'], ['[data-streak-color]', 'streakColor'], ['[data-nav-color]', 'navColor'], ['[data-nav-text-color]', 'navTextColor']]) {
    on(page, 'change', selector, (e, input) => {
      state.settings[key] = input.value.toLowerCase();
      saveSettings();
      applyTheme();
      renderSettings();
    });
  }
  on(page, 'click', '[data-backup-file]', () => download(backupText(), 'tracker-backup-' + new Date().toISOString().slice(0, 10) + '.json'));
  on(page, 'click', '[data-switch-backup]', () => download(readText(KEYS.switchBackup), 'tracker-backup-before-switch.json'));
  on(page, 'click', '[data-backup-copy]', async () => {
    try { await navigator.clipboard.writeText(backupText()); toast('Backup copied. Paste it somewhere safe.'); } catch { toast('Copying is blocked here. Use “Save file” instead.', { tone: 'error' }); }
  });
  on(page, 'click', '[data-restore]', async () => {
    const choice = await openSheet({
      title: 'Restore a backup',
      body: html`<label class="field"><span>Paste backup text</span><textarea class="input" name="paste" rows="4" placeholder="{&quot;app&quot;:&quot;tracker&quot;…"></textarea></label>`,
      actions: [{ label: 'Restore pasted text', tone: 'primary', onClick: (finish, sheet) => finish({ text: sheet.querySelector('textarea[name=paste]').value }) }, { label: 'Choose file', value: 'file', tone: 'ghost' }],
    });
    if (choice === 'file') $('restoreFile').click();
    else if (choice && 'text' in choice) restoreFrom(choice.text);
  });
  on(page, 'change', '#restoreFile', async (e, input) => {
    const file = input.files && input.files[0];
    if (file) restoreFrom(await file.text());
    input.value = '';
  });
  on(document, 'click', '[data-delete-account]', async () => {
    const result = await openSheet({
      title: 'Delete your account?',
      body: html`<p class="sheet-text">Your account, friends, gym dates and everything synced to the cloud are deleted. This cannot be undone.</p>
        <label class="field"><span>Type DELETE to confirm</span><input class="input" name="confirm" autocomplete="off" autocapitalize="characters" maxlength="10"></label>
        <label class="check-row"><input type="checkbox" name="wipe" checked> <span>Also remove my workouts from this phone</span></label>
        <p class="form-error" aria-live="polite"></p>`,
      actions: [
        {
          label: 'Delete forever', tone: 'danger', submit: true,
          onClick: (finish, sheet) => {
            if (sheet.querySelector('[name=confirm]').value !== 'DELETE') { sheet.querySelector('.form-error').textContent = 'Type DELETE in capital letters.'; return; }
            finish({ wipe: sheet.querySelector('[name=wipe]').checked });
          },
        },
        { label: 'Cancel', value: null, tone: 'ghost' },
      ],
    });
    if (!result || deleting) return;
    const toast = toastLater();
    deleting = true; renderSettings();
    const r = await deleteAccount({ removeLocalData: result.wipe });
    deleting = false; renderSettings();
    toast(r || 'Your account was deleted.', { tone: r ? 'error' : 'default' });
  });
  // Busy while it works (a second tap must not start a second download).
  on(page, 'click', '[data-apply-update]', async () => {
    applyingUpdate = true;
    renderSettings();
    try { await installLatestUpdate(); } finally { applyingUpdate = false; renderSettings(); }
  });
  listen('gym:theme-changed', () => { if (currentPage() === 'settings') renderSettings(); });
  on(page, 'click', '[data-edit-picture]', () => editProfileAppearance('picture'));
  on(page, 'click', '[data-edit-banner]', () => editProfileAppearance('banner'));
  on(page, 'click', '[data-view-my-profile]', () => openMemberProfile(account.user?.id));
  listen('gym:banners', () => { if (currentPage() === 'settings') renderSettings(); });
  listen('gym:pictures', () => { if (currentPage() === 'settings') renderSettings(); });
  listen('gym:open-update', () => {
    openSettings();
    const button = page.querySelector('[data-apply-update]');
    button?.closest('.update-notice')?.scrollIntoView({ block: 'center' });
    button?.focus({ preventScroll: true });
  });
  listen('gym:update-ready', () => {
    if (currentPage() !== 'settings') return;
    renderSettings();
    // The reinstall steps replaced the offer: read them before the button can be pressed again.
    if (updateOffer()?.reinstall && document.activeElement?.matches?.('[data-apply-update]')) {
      page.querySelector('.update-notice b')?.focus({ preventScroll: true });
    }
  });

  listen('gym:account', () => {
    if (currentPage() === 'settings' && account.ready) loadProfilePictures([]);
    if (currentPage() === 'settings' && account.ready) loadProfileBanners([]);
    if (currentPage() === 'settings') renderSettings();
  });
  listen('gym:username-taken', async (e) => {
    const name = await promptDialog({
      title: 'Choose another username',
      label: 'Username',
      hint: `@${e.detail.wanted} was already taken, so your account got @${e.detail.given} for now. Friends find you by this exact name.`,
      maxLength: 20, ok: 'Save', input: { autocomplete: 'nickname', autocapitalize: 'none' },
      validate: (v) => (/^[a-z0-9_]{3,20}$/.test(v.toLowerCase()) ? '' : 'Use 3–20 letters, numbers or _.'),
      submit: changeUsername, // a taken name keeps the prompt open with the reason
    });
    if (name) toast(`Username saved: @${name.toLowerCase()}.`);
  });
  let askingPassword = false;
  listen('gym:password-recovery', async () => {
    if (askingPassword) return;
    askingPassword = true;
    // Kept exactly as typed (the sign-in form does not trim either); a refusal keeps the prompt open.
    // A stray tap must not end the reset: only "Not now" or a saved password closes it.
    const pw = await promptDialog({ title: 'Choose a new password', label: 'New password', type: 'password', maxLength: 72, ok: 'Save password', cancel: 'Not now', required: true, input: { autocomplete: 'new-password' }, trim: false, validate: (v) => (v.length >= 8 ? '' : 'Use at least 8 characters.'), submit: updatePassword });
    askingPassword = false;
    toast(pw ? 'Password changed.' : 'You can set a password later with “Change password” in Settings.');
  });
}

export function onSettingsShown() {
  loadProfilePictures([]);
  loadProfileBanners([]);
}
