import { sanitizeTheme, isHex } from './theme.js';

export const APPEARANCE_COLORS = ['wallpaperMiddle', 'wallpaperEnd', 'updateColor', 'backgroundColor', 'surfaceColor', 'textColor', 'borderColor', 'buttonTextColor', 'buttonColor', 'selectedColor', 'selectedTextColor', 'inputColor', 'badgeColor', 'streakColor', 'navColor', 'navTextColor', 'bodyColor'];
export function cleanAppearance(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = { theme: sanitizeTheme(input.theme) };
  for (const key of APPEARANCE_COLORS) if (isHex(input[key])) out[key] = input[key].toLowerCase();
  for (const key of ['wallpaperGlass', 'glassSurfaces', 'thirdWallpaperColor', 'clearBackgrounds']) {
    if (typeof input[key] === 'boolean') out[key] = input[key];
  }
  for (const key of ['surfaceAlpha', 'outlineAlpha']) {
    if (Number.isInteger(input[key]) && input[key] >= 0 && input[key] <= 100) out[key] = input[key];
  }
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
  for (const key of [...APPEARANCE_COLORS, 'clearBackgrounds', 'surfaceAlpha', 'outlineAlpha', 'wallpaperGlass', 'glassSurfaces', 'thirdWallpaperColor']) delete settings[key];
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
  palette('ultra-dark', 'Ultra Dark', 'dark', '#aebfd2', '#000000', '#090a0c', '#ecedf0', '#15171a', '#768497', '#434b55'),
  palette('crimson', 'Crimson', 'dark', '#fa6478', '#130b10', '#24151d', '#ffe9ef', '#391d29', '#623543', '#70404c'),
  palette('icy-blue', 'Icy Blue', 'dark', '#94dfff', '#08121c', '#102332', '#e5f5ff', '#17384b', '#315061', '#416579'),
  palette('midnight', 'Midnight', 'dark', '#c1b6ff', '#10101b', '#1a192c', '#f0edff', '#2b2741', '#48415e', '#645981'),
  palette('forest', 'Forest', 'dark', '#9bdfb0', '#0b1712', '#15291e', '#e7f5ec', '#234332', '#3a5a46', '#42634e'),
  palette('graphite', 'Graphite', 'dark', '#d6e1eb', '#0d0e10', '#181b1f', '#f0f3f7', '#252b32', '#424a54', '#525d68'),
  palette('ember', 'Ember', 'dark', '#ffc17b', '#17110c', '#281c13', '#fff0df', '#3c2819', '#674833', '#79503b'),
  palette('aurora', 'Aurora', 'dark', '#8ef3d8', '#09151a', '#132631', '#e2f9f5', '#1d3944', '#3a5965', '#456978'),
  palette('plum', 'Plum', 'dark', '#eeabf7', '#170e1b', '#26172e', '#fff0ff', '#3d2348', '#5d4367', '#73517d'),
].map(p => ({...p, appearance: {...p.appearance, wallpaperGlass: false, glassSurfaces: false, thirdWallpaperColor: false, clearBackgrounds: false, surfaceAlpha: 100, outlineAlpha: 35}}));

const glassPalettes = [
  ['Ultra Dark Glass', '#000000', '#0a0c0f', '#030405', '#acbac9'],
  ['Lagoon', '#081822', '#123743', '#155347', '#89ead9'],
  ['Afterglow', '#20101c', '#46283d', '#402519', '#ffa991'],
  ['Borealis', '#0d1325', '#263456', '#163e3b', '#a6eddb'],
  ['Amethyst', '#151125', '#34244a', '#302042', '#d3adff'],
  ['Copper', '#191311', '#38281e', '#443028', '#edb68e'],
  ['Abyss', '#091525', '#102c4c', '#192138', '#90c7ff'],
  ['Moss', '#101a14', '#1b382c', '#343720', '#c6df95'],
  ['Mulberry', '#1d101b', '#412239', '#302139', '#efa5d4'],
];
for (const [name, start, middle, end, accent] of glassPalettes) {
  const preset = palette(name.toLowerCase().replaceAll(' ', '-'), name, 'dark', accent, start, middle, '#f2f3f5', middle, accent, middle);
  Object.assign(preset.appearance, {wallpaperGlass: true, glassSurfaces: true, clearBackgrounds: false,
    thirdWallpaperColor: true, wallpaperMiddle: middle, wallpaperEnd: end, surfaceAlpha: 62, outlineAlpha: 24});
  THEME_SETS.push(preset);
}
