// Gym Tracker game scale v1. These are explicit app reference targets, not population percentiles.
import { CATALOG } from './catalog.js';
export const RANKS = [
  ['wood', 'Wood', '#be916b'], ['bronze', 'Bronze', '#dba27a'], ['silver', 'Silver', '#b9ccdf'],
  ['gold', 'Gold', '#edca53'], ['platinum', 'Platinum', '#66ddd0'], ['diamond', 'Diamond', '#91a8ff'],
  ['champion', 'Champion', '#dc98ed'], ['titan', 'Titan', '#ee727b'], ['olympian', 'Olympian', '#b4f0ff'],
].map(([id, name, color], i) => ({ id, name, color, index: i }));
export const MUSCLES = [
  ['chest', 'Chest', 1], ['back', 'Back', 1], ['shoulders', 'Shoulders', .6], ['biceps', 'Biceps', .4],
  ['triceps', 'Triceps', .5], ['forearms', 'Forearms', .25], ['quads', 'Quads', 1.5], ['hamstrings', 'Hamstrings', 1],
  ['calves', 'Calves', 1], ['hips', 'Glutes', 1.5], ['abs', 'Abs', .4], ['lowerback', 'Lower back', .8],
].map(([id, name, reference]) => ({ id, name, reference }));
const normalize = name => String(name || '').toLowerCase().replace(/[-–_]/g, ' ').replace(/\s+/g, ' ').trim();
const catalog = new Map(CATALOG.map(item => [normalize(item.name), item.cat]));
export function cleanRankColors(input) {
  return Object.fromEntries(RANKS.filter(rank => /^#[a-f0-9]{6}$/i.test(input?.[rank.id] || '')).map(rank => [rank.id, input[rank.id].toLowerCase()]));
}
export function movement(name, workouts = {}) {
  const n = normalize(name);
  let muscle = catalog.get(n);
  if (/meow|wrist|forearm/.test(n)) muscle = 'forearms';
  else if (/deadlift|\brdl\b/.test(n)) muscle = /romanian|\brdl\b|stiff/.test(n) ? 'hamstrings' : 'back';
  else if (/bench press|chest press|chest fly|pec deck|dips?\b|push ups?/.test(n)) muscle = 'chest';
  else if (/pull ups?|chin ups?|pulldown|\brow\b/.test(n)) muscle = 'back';
  else if (/squats?|leg press|leg extension|lunge/.test(n)) muscle = 'quads';
  else if (/tricep|pushdown|skull/.test(n)) muscle = 'triceps';
  else if (/bicep|curl/.test(n) && !/leg/.test(n)) muscle = 'biceps';
  if (!muscle) for (const exercises of Object.values(workouts)) {
    const item = Array.isArray(exercises) && exercises.find(item => normalize(item.name) === n);
    if (item) { muscle = item.cat; break; }
  }
  const group = MUSCLES.find(group => group.id === muscle);
  if (!group) return { muscle: null, reference: null, mode: 'unrated' };
  const bodyweight = /pull up|chin up|push up|\bdips?\b/.test(n) && !/assisted/.test(n);
  // Assisted and time/distance movements have no comparable positive-load scale.
  if (/assisted|plank|hang|carry|walk|running|cycling/.test(n)) return { muscle, reference: null, mode: 'unrated' };
  let reference = group.reference;
  if (/deadlift/.test(n) && !/romanian|stiff/.test(n)) reference = 1.8;
  if (/leg press/.test(n)) reference = 2.5;
  if (/leg curl/.test(n)) reference = .65;
  if (/lateral|front raise/.test(n)) reference = .2;
  if (/dumbbell/.test(n)) reference *= .5;
  if (/pull up|chin up/.test(n)) reference = 1.5;
  if (/\bdips?\b/.test(n)) reference = 1.6;
  if (/push up/.test(n)) reference = 1.1;
  return { muscle, reference, mode: bodyweight ? 'bodyweight' : 'load', factor: /push up/.test(n) ? .65 : 1 };
}
export function estimatedMax(weight, reps) {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 12) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}
export function rankFromScore(value) {
  const score = Math.max(0, Math.min(899, Math.floor(Number(value) || 0)));
  const index = Math.min(8, Math.floor(score / 100));
  return { ...RANKS[index], score, progress: index === 8 ? 100 : score % 100, next: RANKS[index + 1] || null };
}
export function rankSet(name, weight, reps, bodyweight, workouts = {}) {
  const model = movement(name, workouts);
  if (!(bodyweight >= 20 && bodyweight <= 350) || !model.reference || !Number.isFinite(weight) || weight < 0) return null;
  const load = model.mode === 'bodyweight' ? bodyweight * model.factor + weight : weight;
  const max = estimatedMax(load, reps);
  if (!max) return null;
  // A reference-equivalent e1RM starts Gold (300). Every reference third earns a tier.
  const rank = rankFromScore(max / bodyweight / model.reference * 300);
  return { ...rank, muscle: model.muscle, max: Math.round(max * 10) / 10, ratio: max / bodyweight, reference: model.reference, mode: model.mode };
}
export function strengthStats(logs, weights, workouts = {}, today = '9999-12-31') {
  const lifts = new Map(), history = [], allMuscles = new Map();
  const orderedWeights = weights.filter(x => x.date <= today && x.weight >= 20 && x.weight <= 350).sort((a, b) => a.date.localeCompare(b.date));
  let weightIndex = -1;
  let sets = 0, reps = 0, volume = 0;
  for (const date of Object.keys(logs).filter(date => date <= today).sort()) {
    while (orderedWeights[weightIndex + 1]?.date <= date) weightIndex++;
    const bodyweight = orderedWeights[weightIndex]?.weight || null;
    for (const session of logs[date] || []) for (const exercise of session.exercises || []) {
      const model = movement(exercise.name, workouts);
      const key = normalize(exercise.name);
      let lift = lifts.get(key);
      for (const set of exercise.sets || []) {
        const w = Number(set.w), r = Number(set.r);
        if (!set.done || !Number.isFinite(w) || w < 0 || !Number.isInteger(r) || r < 1) continue;
        if (!lift) { lift = { name: exercise.name, muscle: model.muscle, rank: null, best: 0, max: 0, sets: 0, points: [], last: date }; lifts.set(key, lift); }
        sets++; reps += r; volume += w * r; lift.sets++; lift.best = Math.max(lift.best, w); lift.last = date;
        const load = model.mode === 'bodyweight' && bodyweight ? w + bodyweight * model.factor : w;
        const max = estimatedMax(load, r);
        if (max) { lift.max = Math.max(lift.max, max); const point = lift.points.find(point => point.date === date); if (point) point.w = Math.max(point.w, Math.round(max * 10) / 10); else lift.points.push({ date, w: Math.round(max * 10) / 10 }); }
        const rank = rankSet(exercise.name, w, r, bodyweight, workouts);
        if (rank && (!lift.rank || rank.score > lift.rank.score)) { lift.rank = rank; lift.bestSet = { w, r, date, bodyweight }; }
        if (rank && rank.score > (allMuscles.get(rank.muscle)?.score ?? -1)) allMuscles.set(rank.muscle, rank);
      }
    }
    if (allMuscles.size) history.push({ date, w: Math.round([...allMuscles.values()].reduce((sum, rank) => sum + rank.score, 0) / allMuscles.size) });
  }
  const exercises = [...lifts.values()].sort((a, b) => (b.rank?.score ?? -1) - (a.rank?.score ?? -1) || a.name.localeCompare(b.name));
  const muscles = MUSCLES.map(group => ({ ...group, rank: allMuscles.get(group.id) || null, exercises: exercises.filter(lift => lift.muscle === group.id) }));
  return { exercises, muscles, overall: history.length ? rankFromScore(history.at(-1).w) : null, history, sets, reps, volume: Math.round(volume), ranked: exercises.filter(lift => lift.rank).length, bodyweight: orderedWeights.at(-1)?.weight || null };
}
