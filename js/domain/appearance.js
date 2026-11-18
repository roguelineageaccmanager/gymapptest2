import { sanitizeTheme, isHex } from './theme.js';

export const APPEARANCE_COLORS = ['updateColor', 'backgroundColor', 'surfaceColor', 'textColor', 'borderColor', 'buttonTextColor', 'buttonColor', 'selectedColor', 'selectedTextColor', 'inputColor', 'badgeColor', 'streakColor', 'navColor', 'navTextColor', 'bodyColor'];
export function cleanAppearance(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = { theme: sanitizeTheme(input.theme) };
  for (const key of APPEARANCE_COLORS) if (isHex(input[key])) out[key] = input[key].toLowerCase();
  return out;
}
export function cleanThemePresets(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input.slice(0, 20).flatMap(p => {
    if (!p || typeof p.id !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(p.id) || seen.has(p.id) || typeof p.name !== 'string' || !p.name.trim()) return [];
    const appearance = cleanAppearance(p.appearance);
    if (!appearance) return [];
    seen.add(p.id);
    return [{ id: p.id, name: Array.from(p.name.trim()).slice(0, 40).join(''), appearance }];
  });
}
export function applyAppearance(settings, appearance) {
  const safe = cleanAppearance(appearance);
  if (!safe) return false;
  for (const key of APPEARANCE_COLORS) delete settings[key];
  delete settings.rankColors;
  delete settings.statsFinish;
  Object.assign(settings, safe);
  return true;
}
function palette(id, name, base, accent, bg, surface, text, button, border, body) {
  const ink = base === 'light' ? '#173047' : '#f1f7ff';
  return { id, name, appearance: { theme: { base, preset: 'custom', color: accent }, backgroundColor: bg, surfaceColor: surface, textColor: text, buttonColor: button, buttonTextColor: ink, borderColor: border, inputColor: button, updateColor: surface, selectedColor: accent, selectedTextColor: '#10212e', navColor: accent, navTextColor: '#10212e', badgeColor: button, streakColor: button, bodyColor: body } };
}
export const THEME_SETS = [
  palette('crimson', 'Crimson', 'dark', '#fa6478', '#130b10', '#24151d', '#ffe9ef', '#391d29', '#623543', '#70404c'),
  palette('icy-blue', 'Icy Blue', 'dark', '#94dfff', '#08121c', '#102332', '#e5f5ff', '#17384b', '#315061', '#416579'),
  palette('baby-blue', 'Baby Blue', 'light', '#b5dfff', '#eff7ff', '#ffffff', '#173047', '#deefff', '#b8d1e5', '#709bb7'),
  palette('midnight', 'Midnight', 'dark', '#c1b6ff', '#10101b', '#1a192c', '#f0edff', '#2b2741', '#48415e', '#645981'),
  palette('forest', 'Forest', 'dark', '#9bdfb0', '#0b1712', '#15291e', '#e7f5ec', '#234332', '#3a5a46', '#42634e'),
  palette('graphite', 'Graphite', 'dark', '#d6e1eb', '#0d0e10', '#181b1f', '#f0f3f7', '#252b32', '#424a54', '#525d68'),
  palette('ember', 'Ember', 'dark', '#ffc17b', '#17110c', '#281c13', '#fff0df', '#3c2819', '#674833', '#79503b'),
  palette('aurora', 'Aurora', 'dark', '#8ef3d8', '#09151a', '#132631', '#e2f9f5', '#1d3944', '#3a5965', '#456978'),
  palette('plum', 'Plum', 'dark', '#eeabf7', '#170e1b', '#26172e', '#fff0ff', '#3d2348', '#5d4367', '#73517d'),
  palette('linen', 'Linen', 'light', '#f4ce9e', '#fbf5ec', '#fffdf7', '#332615', '#f3e7d5', '#d8c4ad', '#b69373'),
  palette('lavender', 'Lavender', 'light', '#cdbaff', '#f6f1ff', '#fffaff', '#292038', '#eae0f8', '#cfc0e4', '#a48bbf'),
  palette('rosewater', 'Rosewater', 'light', '#f8b6c5', '#fff3f4', '#fffafa', '#432832', '#f8e1e6', '#e0bfc8', '#bb8e9b'),
];
