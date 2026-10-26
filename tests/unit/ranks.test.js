import { it, expect } from 'vitest';
import { rankSet, strengthStats, estimatedMax, movement, cleanRankColors } from '../../js/domain/ranks.js';
import { cleanSettings, editPreferences, mergePreferences } from '../../js/domain/settings.js';
import { cleanAppearance, applyAppearance } from '../../js/domain/appearance.js';
const session = sets => ({ exercises: [{ name: 'Barbell Bench Press', sets }] });
it('uses a documented movement reference, one-rep actual load and a bounded Epley estimate', () => {
  expect(estimatedMax(100, 1)).toBe(100); expect(estimatedMax(60, 10)).toBe(80);
  expect(estimatedMax(60, 13)).toBeNull(); expect(estimatedMax(60, 1.5)).toBeNull();
  expect(rankSet('Barbell Bench Press', 80, 1, 80).name).toBe('Gold');
  expect(rankSet('Dumbbell Bench Press', 40, 1, 80).name).toBe('Gold');
  expect(rankSet('Barbell Curl', 32, 8, 80).score).toBe(380);
  expect(rankSet('Barbell Bench Press', 1000, 1, 80).score).toBe(899);
  expect(rankSet('Mystery', 80, 1, 80)).toBeNull();
});
it('counts completed sets only, uses historical weigh-ins and never borrows a future weight', () => {
  const logs = { '2026-01-01': [session([{ w: '80', r: '1', done: true }, { w: '300', r: '1', done: false }])], '2026-02-01': [session([{ w: '80', r: '1', done: true }])] };
  const weights = [{ date: '2026-01-15', weight: 80 }, { date: '2027-01-01', weight: 40 }];
  const stats = strengthStats(logs, weights, {}, '2026-03-01');
  expect(stats.sets).toBe(2); expect(stats.volume).toBe(160);
  expect(stats.overall.name).toBe('Gold'); expect(stats.history).toEqual([{ date: '2026-02-01', w: 300 }]);
  expect(stats.exercises[0].bestSet.date).toBe('2026-02-01');
  expect(strengthStats(logs, weights, {}, '2026-01-10').overall).toBeNull();
  expect(strengthStats({}, weights).exercises).toEqual([]);
});
it('includes bodyweight for calisthenics, leaves assisted/timed lifts unrated and keeps meow curls in forearms', () => {
  expect(rankSet('Pull-up', 0, 8, 80)?.max).toBeGreaterThan(80);
  expect(rankSet('Assisted Pull-Up', 20, 8, 80)).toBeNull(); expect(rankSet('Plank', 30, 8, 80)).toBeNull();
  expect(movement('Meow Curls').muscle).toBe('forearms');
  expect(movement('Leg Curl').muscle).toBe('hamstrings');
});
it('recomputes ranks after deletions rather than keeping stale bests', () => {
  const weights = [{ date: '2026-01-01', weight: 80 }];
  const logs = { '2026-01-02': [session([{ w: 80, r: 1, done: true }])], '2026-01-03': [session([{ w: 160, r: 1, done: true }])] };
  expect(strengthStats(logs, weights).overall.name).toBe('Champion');
  delete logs['2026-01-03']; expect(strengthStats(logs, weights).overall.name).toBe('Gold');
});
it('validates rank appearance, syncs per setting and carries it through shared presets', () => {
  expect(cleanRankColors({ gold: '#AABBCC', titan: 'red; color:blue', fake: '#aabbcc' })).toEqual({ gold: '#aabbcc' });
  const values = { rankColors: { gold: '#ff0000' }, statsFinish: 'flat' };
  expect(cleanSettings(values)).toEqual(values);
  const merged = mergePreferences(editPreferences({}, values, 2), editPreferences({}, { statsFinish: 'metallic' }, 3));
  expect(merged.values.rankColors).toEqual(values.rankColors); expect(merged.values.statsFinish).toBe('metallic');
  const appearance = cleanAppearance(values); const settings = {}; applyAppearance(settings, appearance);
  expect(settings.rankColors.gold).toBe('#ff0000'); expect(settings.statsFinish).toBe('flat');
});
