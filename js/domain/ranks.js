// Gym Tracker game scale v2. These are explicit app reference targets, not population percentiles.
import { isSecondsTarget } from './measurement.js';
import { exerciseId, exerciseName } from './exercises.js';
import { rankModel, catalogueRankModel } from './rank-models.js';
import {attachmentFor} from './attachments.js';
export const rankAttachment=exercise=>{const a=attachmentFor(exercise.name,exercise.attachment);return a&&a!=='none'?a:'';};
export const rankSetupKey=exercise=>JSON.stringify([exerciseId(exercise.name),rankAttachment(exercise)]);
export const RANKS = [
  ['iron', 'Iron', '#a29aa5'], ['bronze', 'Bronze', '#ed9758'], ['silver', 'Silver', '#dcecff'],
  ['gold', 'Gold', '#ffd34f'], ['platinum', 'Platinum', '#49d9d0'], ['emerald', 'Emerald', '#2ced99'],
  ['diamond', 'Diamond', '#80adff'], ['master', 'Master', '#c778ff'],
  ['grandmaster', 'Grandmaster', '#ff526f'], ['challenger', 'Challenger', '#64e3ff'],
].map(([id, name, color], i) => ({ id, name, color, index: i }));
export const MUSCLES = [
  ['chest', 'Chest', 1], ['back', 'Back', 1], ['shoulders', 'Shoulders', .6], ['biceps', 'Biceps', .4],
  ['triceps', 'Triceps', .5], ['forearms', 'Forearms', .25], ['quads', 'Quads', 1.5], ['hamstrings', 'Hamstrings', 1],
  ['calves', 'Calves', 1], ['hips', 'Glutes & abductors', 1.5], ['abs', 'Abs', .4], ['lowerback', 'Lower back', .8],
].map(([id, name, reference]) => ({ id, name, reference }));
const normalize = exerciseId;
export function cleanRankColors(input) {
  return Object.fromEntries(RANKS.filter(rank => /^#[a-f0-9]{6}$/i.test(input?.[rank.id] || '')).map(rank => [rank.id, input[rank.id].toLowerCase()]));
}
export function movement(name, workouts = {}, unilateral) {
  let base = rankModel(name);
  // Custom lifts use the muscle/side settings the user actually selected.
  if (!base.muscle) {
    const item = Object.values(workouts).flatMap(list => Array.isArray(list) ? list : []).find(e => normalize(e.name) === normalize(name));
    if (item) base = catalogueRankModel({name,cat:item.cat,equipment:'other',unilateral:!!item.unilateral});
  }
  return unilateral === true ? {...base,unilateral:true,multiplier:2,unit:'kg per side'} : base;
}
export function estimatedMax(weight, reps) {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 12) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}
// Divisions are a display layer over the existing 0–999 strength score.
// Four divisions share each existing tier; no stored/shared scores are rescaled.
function rankLevel(score) {
  const index = Math.min(RANKS.length - 1, Math.floor(score / 100));
  const tier = RANKS[index], division = index < 7 ? 4 - Math.floor((score % 100) / 25) : null;
  return { ...tier, tierName: tier.name, division, name: division ? `${tier.name} ${division}` : tier.name };
}
export function rankFromScore(value) {
  const numeric = Number(value);
  const score = Math.max(0, Math.min(999, Math.floor((Number.isNaN(numeric) ? 0 : numeric) + 1e-8)));
  const level = rankLevel(score), divided = level.division !== null;
  const lp = divided ? (score % 25) * 4 : score - 700;
  const nextScore = score >= 900 ? null : divided ? Math.floor(score / 25) * 25 + 25 : (level.index + 1) * 100;
  return { ...level, score, lp, progress: nextScore === null ? 100 : divided ? lp : score % 100,
    next: nextScore === null ? null : rankLevel(nextScore),
    lpToNext: nextScore === null ? null : (nextScore - score) * (divided ? 4 : 1) };
}
export function rankText(value) {
  const rank = rankFromScore(value);
  return `${rank.name} · ${rank.lp} LP`;
}

export function rankSet(name, weight, reps, bodyweight, workouts = {}, unilateral) {
  const model = movement(name, workouts, unilateral);
  if (!(bodyweight >= 20 && bodyweight <= 350) || !model.reference || !Number.isFinite(weight) || weight < 0) return null;
  const load = (model.mode === 'bodyweight' ? bodyweight * model.factor + weight : weight) * model.multiplier;
  const max = estimatedMax(load, reps);
  if (!max) return null;
  // A reference-equivalent e1RM starts Gold (300). Every reference third earns a tier.
  const rank = rankFromScore(max / bodyweight / model.reference * 300);
  return { ...rank, muscle: model.muscle, max: Math.round(max * 10) / 10, ratio: max / bodyweight, reference: model.reference, mode: model.mode, unit:model.unit, multiplier:model.multiplier,calibration:model.calibration,source:model.source };
}
export function strengthStats(logs, weights, workouts = null, today = '9999-12-31', schedule = null, hiddenExercises = []) {
  const hidden=new Set(hiddenExercises.map(normalize));
  const assigned = schedule ? new Set(Object.values(schedule).filter(Boolean)) : null;
  const active = workouts ? new Set(Object.entries(workouts).filter(([name])=>!assigned || assigned.has(name)).flatMap(([,list])=>Array.isArray(list)?list.map(rankSetupKey):[])) : null;
  const lifts = new Map(), history = [], allMuscles = new Map();
  const orderedWeights = weights.filter(x => x.date <= today && x.weight >= 20 && x.weight <= 350).sort((a, b) => a.date.localeCompare(b.date));
  let weightIndex = -1;
  let sets = 0, reps = 0, volume = 0;
  for (const date of Object.keys(logs).filter(date => date <= today).sort()) {
    while (orderedWeights[weightIndex + 1]?.date <= date) weightIndex++;
    const bodyweight = orderedWeights[weightIndex]?.weight || null;
    for (const session of logs[date] || []) for (const exercise of session.exercises || []) {
      const key = rankSetupKey(exercise), timed = isSecondsTarget(exercise.target);
      if(hidden.has(normalize(exercise.name)))continue;
      const model = movement(exercise.name, workouts || {}, exercise.unilateral);
      let lift = lifts.get(key);
      const working = exercise.sets || [];
      for (let index = 0; index < working.length; index++) {
        const set = working[index];
        const w = Number(set.w), r = Number(set.r);
        if (!set.done || !Number.isFinite(w) || w < 0 || !Number.isInteger(r) || r < 1) continue;
        if (!lift) { lift = { name: exerciseName(exercise.name),attachment:rankAttachment(exercise), muscle: model.muscle, active: !active || active.has(key), rank: null, best: 0, max: 0, sets: 0, points: [], timedPoints: [], timedSets: 0, bestSeconds: 0, timedBestWeight: 0, last: date }; lifts.set(key, lift); }
        sets++; lift.sets++; lift.last = date;
        if (timed) {
          lift.timedSets++; lift.bestSeconds = Math.max(lift.bestSeconds, r); lift.timedBestWeight = Math.max(lift.timedBestWeight,w);
          const point = lift.timedPoints.find(point => point.date === date);
          if (point) point.w = Math.max(point.w,r); else lift.timedPoints.push({date,w:r});
          continue;
        }
        reps += r; volume += w * r; lift.best = Math.max(lift.best, w);
        if (r <= 12) {
          lift.hasRankReps = true;
          if (bodyweight) lift.hasRankWeight = true;
        }
        const load = (model.mode === 'bodyweight' ? bodyweight ? w + bodyweight * model.factor : NaN : w) * model.multiplier;
        let max = estimatedMax(load, r);
        if (model.unilateral) {
          const partner = working[index - 1], pw = Number(partner?.w), pr = Number(partner?.r);
          const partnerLoad = (model.mode === 'bodyweight' ? bodyweight ? pw + bodyweight * model.factor : NaN : pw) * model.multiplier;
          const partnerMax = index % 2 && partner?.done && pw >= 0 ? estimatedMax(partnerLoad, pr) : null;
          max = max && partnerMax ? Math.min(max, partnerMax) : null;
        }
        if (max) { lift.max = Math.max(lift.max, max); const point = lift.points.find(point => point.date === date); if (point) point.w = Math.max(point.w, Math.round(max * 10) / 10); else lift.points.push({ date, w: Math.round(max * 10) / 10 }); }
        let rank = (!active || active.has(key)) ? rankSet(exercise.name, w, r, bodyweight, workouts || {}, exercise.unilateral) : null;
        let rankSetWeight = w, rankSetReps = r;
        if (model.unilateral) {
          // Stored unilateral rows are L1,R1,L2,R2. Never match across a missing
          // side or session, add repetitions, or let the stronger side set rank.
          const partner = working[index - 1];
          const other = index % 2 && partner?.done ? rankSet(exercise.name, Number(partner.w), Number(partner.r), bodyweight, workouts || {}, exercise.unilateral) : null;
          if (!other) rank = null;
          else if (rank && (other.score < rank.score || (other.score === rank.score && other.max < rank.max))) { rank = other; rankSetWeight = Number(partner.w); rankSetReps = Number(partner.r); }
        }
        if (rank && (!lift.rank || rank.score > lift.rank.score)) { lift.rank = rank; lift.bestSet = { w:rankSetWeight, r:rankSetReps, date, bodyweight, ...(model.unilateral ? {paired:true} : {}) }; }
        if (rank && rank.score > (allMuscles.get(rank.muscle)?.score ?? -1)) allMuscles.set(rank.muscle, rank);
      }
    }
    if (allMuscles.size) history.push({ date, w: Math.round([...allMuscles.values()].reduce((sum, rank) => sum + rank.score, 0) / allMuscles.size) });
  }
  const exercises = [...lifts.values()].sort((a, b) => (b.rank?.score ?? -1) - (a.rank?.score ?? -1) || a.name.localeCompare(b.name));
  const muscles = MUSCLES.map(group => ({ ...group, rank: allMuscles.get(group.id) || null, exercises: exercises.filter(lift => lift.active && lift.muscle === group.id) }));
  return { exercises, muscles, overall: history.length ? rankFromScore(history.at(-1).w) : null, history, sets, reps, volume: Math.round(volume), ranked: exercises.filter(lift => lift.rank).length, bodyweight: orderedWeights.at(-1)?.weight || null };
}
