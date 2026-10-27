import { it, expect } from 'vitest';
import { rankSet, strengthStats, estimatedMax, movement, RANKS } from '../../js/domain/ranks.js';
import { cleanSettings } from '../../js/domain/settings.js';
import { cleanAppearance, applyAppearance } from '../../js/domain/appearance.js';
const session = sets => ({ exercises: [{ name: 'Barbell Bench Press', sets }] });
it('uses a documented movement reference, one-rep actual load and a bounded Epley estimate', () => {
  expect(estimatedMax(100, 1)).toBe(100); expect(estimatedMax(60, 10)).toBe(80);
  expect(estimatedMax(60, 13)).toBeNull(); expect(estimatedMax(60, 1.5)).toBeNull();
  expect(rankSet('Barbell Bench Press', 80, 1, 80).name).toBe('Gold');
  expect(rankSet('Dumbbell Bench Press', 40, 1, 80).name).toBe('Gold');
  expect(rankSet('Barbell Curl', 32, 8, 80).score).toBe(380);
  expect(rankSet('Barbell Bench Press', 1000, 1, 80).score).toBe(999);
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
  expect(strengthStats(logs, weights).overall.name).toBe('Diamond');
  delete logs['2026-01-03']; expect(strengthStats(logs, weights).overall.name).toBe('Gold');
});
it('uses ten fixed ordered tiers and discards obsolete rank customization', () => {
  expect(RANKS.map(rank=>rank.name)).toEqual(['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger']);
  expect(new Set(RANKS.map(rank=>rank.color)).size).toBe(10);
  const values = {rankColors:{gold:'#ff0000'},statsFinish:'flat'};
  expect(cleanSettings(values)).toEqual({});
  const appearance=cleanAppearance(values),settings={}; applyAppearance(settings,appearance);
  expect(settings.rankColors).toBeUndefined(); expect(settings.statsFinish).toBeUndefined();
});
