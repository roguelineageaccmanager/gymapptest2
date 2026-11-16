import { THEME_SETS } from '../domain/appearance.js';
// Applies the chosen theme (Settings → Appearance) to the page.
import { state } from '../state.js';
import { listen, emit } from '../core/store.js';
import { sanitizeTheme, resolveBase, themeColors, inkFor } from '../domain/theme.js';

const light = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;

/** The theme as shown now: { base, accent, ink, soft, adjusted } plus the stored choice. */
export function currentTheme() {
  const theme = sanitizeTheme(state.settings.theme);
  const base = resolveBase(theme.base, !!light?.matches);
  return { ...theme, shown: base, ...themeColors(theme, base) };
}

export function applyTheme() {
  const t = currentTheme();
  // Baseline surfaces follow Graphite. Dependent controls must keep their CSS
  // fallbacks so custom button/selected colors also reach badges, nav and previews.
  const graphite = THEME_SETS.find(p => p.id === 'graphite').appearance;
  const defaults = t.preset === 'graphite' && t.shown === 'dark'
    ? Object.fromEntries(['backgroundColor','surfaceColor','textColor','borderColor','bodyColor','buttonColor'].map(key => [key,graphite[key]])) : {};
  const settings = { ...defaults, ...state.settings };
  for (const [fill, ink] of [['selectedColor','selectedTextColor'],['navColor','navTextColor'],['buttonColor','buttonTextColor']]) {
    if (state.settings[fill] && !state.settings[ink]) delete settings[ink];
  }
  const root = document.documentElement;
  if (t.shown === 'light') root.dataset.theme = 'light'; else delete root.dataset.theme;
  const background = /^#[0-9a-f]{6}$/i.test(settings.backgroundColor || '') ? settings.backgroundColor : '';
  if (background) root.style.setProperty('--page-bg', background);
  else root.style.removeProperty('--page-bg');
  const surface = /^#[0-9a-f]{6}$/i.test(settings.surfaceColor || '') ? settings.surfaceColor : '';
  if (surface) {
    root.style.setProperty('--surface', surface);
    root.style.setProperty('--surface-2', 'color-mix(in srgb, var(--surface) 88%, var(--text))');
    root.style.setProperty('--surface-3', 'color-mix(in srgb, var(--surface) 78%, var(--text))');
    root.style.setProperty('--nav-bg', 'color-mix(in srgb, var(--surface) 96%, transparent)');
  } else {
    root.style.removeProperty('--surface');
    root.style.removeProperty('--surface-2');
    root.style.removeProperty('--surface-3');
    root.style.removeProperty('--nav-bg');
  }
  const text = /^#[0-9a-f]{6}$/i.test(settings.textColor || '') ? settings.textColor : '';
  if (text) root.style.setProperty('--text', text);
  else root.style.removeProperty('--text');
  for (const variable of ['--muted', '--dim']) {
    if (state.settings.textColor) root.style.setProperty(variable, text); else root.style.removeProperty(variable);
  }
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-ink', t.ink);
  root.style.setProperty('--accent-text', t.text);
  root.style.setProperty('--accent-soft', t.soft);
  const validColor = (value) => /^#[0-9a-f]{6}$/i.test(value || '');
  const border = validColor(settings.borderColor) ? settings.borderColor : '';
  for (const variable of ['--line', '--line-strong']) {
    if (border) root.style.setProperty(variable, border); else root.style.removeProperty(variable);
  }
  if (validColor(settings.buttonTextColor)) root.style.setProperty('--button-text', settings.buttonTextColor);
  else root.style.removeProperty('--button-text');
  for (const [key, variable] of [['bodyColor', '--body-color'], ['updateColor', '--update-bg'], ['buttonColor', '--control-bg'], ['selectedColor', '--selected-bg'], ['selectedTextColor', '--selected-ink'], ['inputColor', '--field-bg'], ['badgeColor', '--badge-bg'], ['streakColor', '--streak-bg'], ['navColor', '--nav-selected-bg'], ['navTextColor', '--nav-selected-ink']]) {
    if (validColor(settings[key])) root.style.setProperty(variable, settings[key]);
    else root.style.removeProperty(variable);
  }
  if (validColor(settings.selectedColor) && !validColor(settings.selectedTextColor)) root.style.setProperty('--selected-ink', inkFor(settings.selectedColor));
  for (const [key, variable] of [['updateColor', '--update-ink'], ['buttonColor', '--control-ink'], ['badgeColor', '--badge-ink'], ['streakColor', '--streak-ink']]) {
    if (validColor(settings[key])) root.style.setProperty(variable, inkFor(settings[key]));
    else root.style.removeProperty(variable);
  }
  if (validColor(settings.navColor) && !validColor(settings.navTextColor)) root.style.setProperty('--nav-selected-ink', inkFor(settings.navColor));
  root.style.setProperty('--live', t.accent);
  root.style.setProperty('--live-ink', t.ink);
  // The phone's status bar matches the page.
  const styles = getComputedStyle(root);
  const bg = styles.getPropertyValue('--page-bg').trim() || styles.getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#0d0e10');
}

/** Follows the phone's dark/light setting while "Match phone" is chosen. */
export function initTheme() {
  applyTheme();
  light?.addEventListener?.('change', () => { if (sanitizeTheme(state.settings.theme).base === 'system') { applyTheme(); emit('gym:theme-changed'); } });
  // Settings removed at sign-out, or another account's on this phone: the page follows.
  listen('gym:account', applyTheme);
}
