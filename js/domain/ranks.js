// Gym Tracker game scale v2. These are explicit app reference targets, not population percentiles.
import { measurement } from './measurement.js';
import { exerciseId, exerciseName } from './exercises.js';
import { rankModel, rankModelEntry, catalogueRankModel } from './rank-models.js';
import {attachmentFor} from './attachments.js';
import { SIDE_VARIANTS } from './side-variants.js';
export const rankAttachment=exercise=>{const a=attachmentFor(exercise.name,exercise.attachment);return a&&a!=='none'?a:'';};
export const rankSetupKey=exercise=>JSON.stringify([exerciseId(exercise.name),rankAttachment(exercise)]);
const eligibilityKey = (setup, unilateral, unit) => JSON.stringify([setup, unilateral, unit]);
const singleSideNames = new Map(SIDE_VARIANTS.map(([both, one]) => [exerciseId(both), one]));
const recordedSideMode = exercise => exercise.unilateral ?? (exercise.sides === 'both' ? true : undefined);

// Older logs could store the base name with an explicit left/right flag.
// Match that record to the same one-arm setup without changing the saved log.
function rankedSetup(exercise, unilateral) {
  const name = unilateral ? singleSideNames.get(exerciseId(exercise.name)) : undefined;
  if (!name) return exercise;
  const attachment = rankAttachment(exercise);
  if (attachment && attachmentFor(name, attachment) !== attachment) return exercise;
  return { ...exercise, name };
}
export const RANKS = [
  ['iron', 'Iron', '#a29aa5'], ['bronze', 'Bronze', '#ed9758'], ['silver', 'Silver', '#dcecff'],
  ['gold', 'Gold', '#ffd34f'], ['platinum', 'Platinum', '#49d9d0'], ['emerald', 'Emerald', '#2ced99'],
  ['diamond', 'Diamond', '#80adff'], ['master', 'Master', '#c778ff'],
  ['grandmaster', 'Grandmaster', '#ff526f'], ['challenger', 'Challenger', '#64e3ff'],
].map(([id, name, color], i) => ({ id, name, color, index: i }));
export const MUSCLES = [
  ['chest', 'Chest', 1], ['back', 'Back', 1], ['shoulders', 'Shoulders', .6], ['biceps', 'Biceps', .4],
  ['triceps', 'Triceps', .5], ['forearms', 'Forearms', .25], ['quads', 'Quads', 1.5], ['hamstrings', 'Hamstrings', 1],
  ['calves', 'Calves', 1], ['hips', 'Glutes', 1.5], ['abs', 'Abs', .4], ['lowerback', 'Lower back', .8],
].map(([id, name, reference]) => ({ id, name, reference }));
const normalize = exerciseId;
export function cleanRankColors(input) {
  return Object.fromEntries(RANKS.filter(rank => /^#[a-f0-9]{6}$/i.test(input?.[rank.id] || '')).map(rank => [rank.id, input[rank.id].toLowerCase()]));
}
export function movement(name, workouts = {}, unilateral) {
  let base = rankModel(name);
  if (typeof unilateral === 'boolean' && base.unilateral !== unilateral) {
    const entry = rankModelEntry(name);
    if (entry) return catalogueRankModel({...entry, unilateral});
  }
  // Custom lifts use the muscle/side settings the user actually selected.
  if (!base.muscle) {
    const item = Object.values(workouts).flatMap(list => Array.isArray(list) ? list : []).find(e => normalize(e.name) === normalize(name));
    if (item) base = catalogueRankModel({name,cat:item.cat,equipment:'other',unilateral:unilateral ?? !!item.unilateral});
  }
  return unilateral === true ? {...base,unilateral:true,multiplier:2,unit:'kg per side'} : base;
}
export function estimatedMax(weight, reps) {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 12) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}
export const benchmarkReps = reps => Number.isSafeInteger(reps) ? Math.min(reps, 12) : 0;
const REFERENCE_BODYWEIGHT = 80;
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
  return scoreSet(movement(name, workouts, unilateral), weight, reps, bodyweight);
}
function equivalentMax(model, weight, reps, bodyweight) {
  if (!Number.isFinite(weight) || weight < 0 || (model.mode === 'bodyweight' && !bodyweight)) return null;
  const load = (model.mode === 'bodyweight' ? bodyweight * model.factor + weight : weight) * model.multiplier;
  return estimatedMax(load, benchmarkReps(reps));
}
function scoreSet(model, weight, reps, bodyweight) {
  return scoreMax(model, equivalentMax(model, weight, reps, bodyweight), bodyweight);
}
function scoreMax(model, max, bodyweight) {
  if (!max || !model.reference || !(bodyweight >= 20 && bodyweight <= 350)) return null;
  // A reference-equivalent e1RM starts Gold (300). Every reference third earns a tier.
  const rank = rankFromScore(max / bodyweight / model.reference * 300);
  return { ...rank, muscle: model.muscle, max: Math.round(max * 10) / 10, ratio: max / bodyweight, reference: model.reference, mode: model.mode, unit:model.unit, multiplier:model.multiplier,calibration:model.calibration,source:model.source };
}
function trackedLift(exercise, model) {
  return {
    name: exerciseName(exercise.name), attachment: rankAttachment(exercise), muscle: model.muscle,
    active: false, rank: null, best: 0, max: 0, sets: 0, points: [], timedPoints: [],
    pairedSets: 0, unpairedSets: 0, timedSets: 0, bestSeconds: 0, timedBestWeight: 0, trainingDays: 0,
  };
}

// Preserve the original row positions before discarding unfinished sides.
function completedRound(working, start, rowsPerRound) {
  return working.slice(start, start + rowsPerRound).flatMap((set, offset) => {
    const w = Number(set?.w), r = Number(set?.r);
    if (!set?.done || !Number.isFinite(w) || w < 0 || !Number.isSafeInteger(r) || r < 1) return [];
    return [{w, r, side: offset === 0 ? 'left' : 'right'}];
  });
}

// The same per-side load convention applies whether one or both sides were
// recorded. With two sides, use the weaker performance from this round.
function roundPerformance(completed, model, bodyweight) {
  const sides = completed.map(set => ({...set, max: equivalentMax(model, set.w, set.r, bodyweight)}))
    .filter(set => set.max);
  if (!sides.length) return null;
  const paired = model.unilateral && sides.length === 2;
  const singleSide = model.unilateral && !paired;
  if (singleSide && !model.reference) return null;
  const weaker = paired && sides[1].max < sides[0].max ? sides[1] : sides[0];
  return {w: weaker.w, r: weaker.r, max: weaker.max, paired, singleSide, ...(singleSide ? {side: weaker.side} : {})};
}

function recordMax(lift, date, performance) {
  const {max, singleSide} = performance;
  lift.max = Math.max(lift.max, max);
  const point = {date, w: Math.round(max * 10) / 10, ...(singleSide ? {singleSide:true} : {})};
  const previous = lift.points.at(-1);
  if (previous?.date !== date) lift.points.push(point);
  else if (point.w > previous.w || (point.w === previous.w && !singleSide)) lift.points[lift.points.length - 1] = point;
}

export function strengthStats(logs, weights, workouts = null, today = '9999-12-31', schedule = null, hiddenExercises = []) {
  const hidden=new Set(hiddenExercises.map(normalize));
  const assigned = schedule ? new Set(Object.values(schedule).filter(Boolean)) : null;
  const active = workouts ? new Set() : null;
  const plannedLifts = new Map();
  for (const [routine, exercises] of Object.entries(workouts || {})) {
    if ((assigned && !assigned.has(routine)) || !Array.isArray(exercises)) continue;
    for (const planned of exercises) {
      const unilateral = recordedSideMode(planned);
      const exercise = rankedSetup(planned, unilateral);
      if (hidden.has(normalize(planned.name)) || hidden.has(normalize(exercise.name))) continue;
      const key = rankSetupKey(exercise);
      const model = movement(exercise.name, workouts, unilateral);
      active.add(eligibilityKey(key, model.unilateral, measurement(exercise)));
      if (assigned && !plannedLifts.has(key)) plannedLifts.set(key, trackedLift(exercise, model));
    }
  }
  const lifts = new Map(), history = [], allMuscles = new Map();
  const orderedWeights = weights.filter(x => x.date <= today && x.weight >= 20 && x.weight <= 350).sort((a, b) => a.date.localeCompare(b.date));
  const firstWeighIn = orderedWeights[0]?.weight;
  let weightIndex = -1;
  let sets = 0, reps = 0, volume = 0;
  for (const date of Object.keys(logs).filter(date => date <= today).sort()) {
    while (orderedWeights[weightIndex + 1]?.date <= date) weightIndex++;
    const bodyweight = orderedWeights[weightIndex]?.weight || null;
    for (const session of logs[date] || []) for (const recorded of session.exercises || []) {
      const sideMode = recordedSideMode(recorded);
      const exercise = rankedSetup(recorded, sideMode);
      const key = rankSetupKey(exercise), unit = measurement(exercise, false), timed = unit === 'seconds';
      if(hidden.has(normalize(exercise.name)) || hidden.has(normalize(recorded.name)))continue;
      const unilateral = sideMode ?? (rankModel(exercise.name).muscle ? undefined : false);
      const model = movement(exercise.name, workouts || {}, unilateral);
      const inSplit = !active || active.has(eligibilityKey(key, model.unilateral, unit));
      let lift = lifts.get(key);
      const working = exercise.sets || [];
      const rowsPerRound = model.unilateral ? 2 : 1;
      const weightBasis = bodyweight || firstWeighIn || REFERENCE_BODYWEIGHT;
      const sessionRounds = [];
      for (let start = 0; start < working.length; start += rowsPerRound) {
        const completed = completedRound(working, start, rowsPerRound);
        if (!completed.length) continue;
        if (!lift) { lift = trackedLift(exercise, model); lifts.set(key, lift); }
        sets += completed.length;
        lift.sets += completed.length;
        if (model.unilateral) {
          if (completed.length === 2) lift.pairedSets++;
          else lift.unpairedSets++;
        }
        if (inSplit && lift.lastTrainingDay !== date) {
          lift.active = true;
          lift.lastTrainingDay = date;
          lift.trainingDays++;
        }
        for (const {w,r} of completed) {
          if (timed) {
            lift.timedSets++;
            lift.bestSeconds = Math.max(lift.bestSeconds, r);
            lift.timedBestWeight = Math.max(lift.timedBestWeight, w);
            const point = lift.timedPoints.at(-1);
            if (point?.date === date) point.w = Math.max(point.w,r);
            else lift.timedPoints.push({date,w:r});
          } else {
            reps += r;
            volume += w * r;
            lift.best = Math.max(lift.best, w);
          }
        }
        if (timed) continue;
        if (inSplit && bodyweight) lift.hasRankWeight = true;
        const performance = roundPerformance(completed, model, bodyweight);
        if (!performance) continue;
        recordMax(lift, date, performance);
        if (!inSplit) continue;
        const rank = scoreMax(model, performance.max, weightBasis);
        if (!rank) continue;
        const {w,r,paired,singleSide,side} = performance;
        const round = start / rowsPerRound + 1;
        sessionRounds.push({round,w,r,paired,singleSide,score:rank.score,...(side ? {side} : {})});
        const bestSet = {round,w,r,date,bodyweight:weightBasis,...(paired ? {paired:true} : {})};
        if (!bodyweight || singleSide) {
          const previous = lift.estimatedRank;
          if (!previous || rank.score > previous.score ||
              (rank.score === previous.score && (paired && !lift.estimatedBestSet.paired))) {
            lift.estimatedRank = rank;
            lift.estimatedBestSet = {...bestSet,singleSide,...(side ? {side} : {}),weightSource:bodyweight ? 'dated' : firstWeighIn ? 'later' : 'reference'};
            lift.estimatedRankSession = sessionRounds;
          }
          continue;
        }
        if (!lift.rank || rank.ratio > lift.rank.ratio) {
          lift.rank = rank;
          lift.bestSet = bestSet;
          lift.confirmedRankSession = sessionRounds;
        }
        if (rank.score > (allMuscles.get(rank.muscle)?.score ?? -1)) allMuscles.set(rank.muscle, rank);
      }
    }
    if (allMuscles.size) history.push({ date, w: Math.round([...allMuscles.values()].reduce((sum, rank) => sum + rank.score, 0) / allMuscles.size) });
  }
  for (const [key, planned] of plannedLifts) {
    const lift = lifts.get(key) || planned;
    lift.active = true;
    lifts.set(key, lift);
  }
  // Training LP keeps progress visible for every setup without treating workout
  // frequency as a load benchmark or using it in the strength leaderboard.
  for (const lift of lifts.values()) {
    if (lift.rank && (lift.estimatedRank?.score ?? -1) <= lift.rank.score) {
      delete lift.estimatedRank;
      delete lift.estimatedBestSet;
      delete lift.estimatedRankSession;
    }
    lift.rankSession = lift.estimatedRankSession || lift.confirmedRankSession || [];
    if (lift.active && !lift.rank && !lift.estimatedRank) lift.trainingRank = rankFromScore(lift.trainingDays);
  }
  const displayedStrength = lift => lift.estimatedRank?.score ?? lift.rank?.score ?? -1;
  const exercises = [...lifts.values()].sort((a, b) => displayedStrength(b) - displayedStrength(a)
    || (b.trainingRank?.score ?? -1) - (a.trainingRank?.score ?? -1) || a.name.localeCompare(b.name));
  const muscles = MUSCLES.map(group => ({ ...group, rank: allMuscles.get(group.id) || null, exercises: exercises.filter(lift => lift.active && lift.muscle === group.id) }));
  return { exercises, muscles, overall: history.length ? rankFromScore(history.at(-1).w) : null, history, sets, reps, volume: Math.round(volume), ranked: exercises.filter(lift => lift.rank).length, bodyweight: orderedWeights.at(-1)?.weight || null };
}
