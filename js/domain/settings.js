import { restSound } from './rest-sounds.js';
// Account preferences, with per-setting edit times so devices merge independently.
import { sanitizeTheme, isHex } from './theme.js';
import { cleanThemePresets } from './appearance.js';

const COLORS = ['updateColor', 'backgroundColor', 'surfaceColor', 'textColor', 'borderColor', 'buttonTextColor', 'buttonColor', 'selectedColor', 'selectedTextColor', 'inputColor', 'badgeColor', 'streakColor', 'navColor', 'navTextColor', 'bodyColor'];
export const SETTING_KEYS = ['weightStep', 'shareScores', 'chatNotifications', 'restSound', 'restVibration', 'restTimers', 'theme', ...COLORS, 'workoutBadges', 'leaderboardExercises', 'weekStyle', 'themePresets'];

export function cleanSettings(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  if (typeof input.restSound === 'string' && restSound(input.restSound).id === input.restSound) out.restSound = input.restSound;
  if (typeof input.restVibration === 'boolean') out.restVibration = input.restVibration;
  if (typeof input.shareScores === 'boolean') out.shareScores = input.shareScores;
  if (typeof input.chatNotifications === 'boolean') out.chatNotifications = input.chatNotifications;
  if (typeof input.restTimers === 'boolean') out.restTimers = input.restTimers;
  if (Array.isArray(input.themePresets)) out.themePresets = cleanThemePresets(input.themePresets);
  if (['circles', 'boxes'].includes(input.weekStyle)) out.weekStyle = input.weekStyle;
  if (Number.isFinite(input.weightStep) && input.weightStep >= 0 && input.weightStep <= 100) out.weightStep = input.weightStep;
  if (input.theme && typeof input.theme === 'object') out.theme = sanitizeTheme(input.theme);
  for (const key of COLORS) if (isHex(input[key])) out[key] = input[key].toLowerCase();
  if (input.workoutBadges && typeof input.workoutBadges === 'object' && !Array.isArray(input.workoutBadges)) {
    out.workoutBadges = Object.fromEntries(Object.entries(input.workoutBadges).slice(0, 200)
      .filter(([key, value]) => key.length <= 100 && typeof value === 'string')
      .map(([key, value]) => [key, Array.from(value.trim()).slice(0, 3).join('').toUpperCase()]));
  }
  if (Array.isArray(input.leaderboardExercises)) out.leaderboardExercises = [...new Set(input.leaderboardExercises.filter(x => typeof x === 'string' && x.length <= 100))].slice(0, 8);
  return out;
}

export function cleanPreferences(input) {
  const values = cleanSettings(input?.values);
  const times = {};
  for (const key of SETTING_KEYS) {
    const time = input?.times?.[key];
    if (Number.isSafeInteger(time) && time >= 0) times[key] = time;
    else if (Object.hasOwn(values, key)) times[key] = 0;
  }
  return { values, times };
}

export function editPreferences(previous, settings, now = Date.now()) {
  const next = cleanPreferences(previous), values = cleanSettings(settings);
  for (const key of SETTING_KEYS) {
    if (JSON.stringify(values[key]) !== JSON.stringify(next.values[key])) next.times[key] = Math.max(now, (next.times[key] || 0) + 1);
  }
  return { values, times: next.times };
}

export function mergePreferences(local, remote) {
  const a = cleanPreferences(local), b = cleanPreferences(remote), values = {}, times = {};
  for (const key of SETTING_KEYS) {
    if (!Object.hasOwn(a.times, key) && !Object.hasOwn(b.times, key)) continue;
    const at = a.times[key] ?? -1, bt = b.times[key] ?? -1;
    // Deterministic tie resolution makes simultaneous edits converge.
    const winner = at > bt || (at === bt && JSON.stringify(a.values[key] ?? null) > JSON.stringify(b.values[key] ?? null)) ? a : b;
    times[key] = winner.times[key];
    if (Object.hasOwn(winner.values, key)) values[key] = winner.values[key];
  }
  return { values, times };
}
