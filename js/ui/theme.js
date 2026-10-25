// Applies the chosen theme (Settings → Appearance) to the page.
import { state } from '../state.js';
import { listen, emit } from '../core/store.js';
import { sanitizeTheme, resolveBase, themeColors } from '../domain/theme.js';

const light = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;

/** The theme as shown now: { base, accent, ink, soft, adjusted } plus the stored choice. */
export function currentTheme() {
  const theme = sanitizeTheme(state.settings.theme);
  const base = resolveBase(theme.base, !!light?.matches);
  return { ...theme, shown: base, ...themeColors(theme, base) };
}

export function applyTheme() {
  const t = currentTheme();
  const root = document.documentElement;
  if (t.shown === 'light') root.dataset.theme = 'light'; else delete root.dataset.theme;
  const background = /^#[0-9a-f]{6}$/i.test(state.settings.backgroundColor || '') ? state.settings.backgroundColor : '';
  if (background) root.style.setProperty('--page-bg', background);
  else root.style.removeProperty('--page-bg');
  const surface = /^#[0-9a-f]{6}$/i.test(state.settings.surfaceColor || '') ? state.settings.surfaceColor : '';
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
  const text = /^#[0-9a-f]{6}$/i.test(state.settings.textColor || '') ? state.settings.textColor : '';
  if (text) root.style.setProperty('--text', text);
  else root.style.removeProperty('--text');
  for (const variable of ['--muted', '--dim']) {
    if (text) root.style.setProperty(variable, text); else root.style.removeProperty(variable);
  }
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-ink', t.ink);
  root.style.setProperty('--accent-text', t.text);
  root.style.setProperty('--accent-soft', t.soft);
  const validColor = (value) => /^#[0-9a-f]{6}$/i.test(value || '');
  const border = validColor(state.settings.borderColor) ? state.settings.borderColor : '';
  for (const variable of ['--line', '--line-strong']) {
    if (border) root.style.setProperty(variable, border); else root.style.removeProperty(variable);
  }
  if (validColor(state.settings.buttonTextColor)) root.style.setProperty('--button-text', state.settings.buttonTextColor);
  else root.style.removeProperty('--button-text');
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
