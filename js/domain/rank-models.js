// Game reference targets, not population strength standards or machine calibration.
// Keep input conventions explicit: per dumbbell, per side, or total external load.
import { CATALOG } from './catalog.js';
import { exerciseId } from './exercises.js';
import { SIDE_VARIANTS } from './side-variants.js';
import { RANK_BENCHMARKS } from './rank-benchmarks.js';

const entries = new Map(CATALOG.map(e => [exerciseId(e.name), e]));
const bases = new Map(SIDE_VARIANTS.flatMap(([both, one, , aliases = []]) =>
  [both, one, ...aliases].map(n => [exerciseId(n), both])));
const references = { chest:1, back:1, shoulders:.6, biceps:.4, triceps:.5,
  forearms:.25, quads:1.5, hamstrings:1, calves:1, hips:1.5, abs:.4, lowerback:.8 };
// Verified single shared implement in the catalogue instructions/demonstrations.
const sharedDumbbells = new Set(['Dumbbell Pullover','Straight-Arm Dumbbell Pullover',
  'Bent-Arm Dumbbell Pullover','Seated Triceps Press','Close-Grip Dumbbell Press',
  'Plie Dumbbell Squat'].map(exerciseId));
// Per-implement logging does not change legacy one-row versus L/R tracking.
const perKettlebell = new Set(['Kettlebell Arnold Press','Kettlebell Seated Press',
  'Leg-Over Floor Press','Front Squats With Two Kettlebells'].map(exerciseId));
const unranked = (muscle, reason, unilateral = false) => ({ muscle, mode:'unrated', reference:null, multiplier:1, unilateral, reason, unit:'kg' });

export function catalogueRankModel(entry) {
  const name = exerciseId(bases.get(exerciseId(entry.name)) || entry.name);
  const base = entries.get(name) || entry;
  // Side selection must not move the same exercise into a different rank group.
  // Both kettlebell clean versions are hip-driven, as their instructions describe.
  const muscle = /upright[ -]row|rear[ -]delt[ -]fly/i.test(entry.name) ? 'shoulders'
    : name === 'two arm kettlebell clean' ? 'hamstrings' : base.cat;
  const unilateral = !!entry.unilateral;
  const equipment = entry.equipment;
  if (!references[muscle]) return unranked(muscle, 'conditioning-or-unsupported-muscle', unilateral);
  if (['stretching','cardio','plyometrics'].includes(entry.kind)) return unranked(muscle, entry.kind, unilateral);
  if (/assisted/.test(name)) return unranked(muscle, 'assistance-is-not-positive-load', unilateral);
  if (/plank|dead hang|hanging|hang$|carry|running|cycling|pinch|hold|isometric|wrist roller|sled|sprint|jump|bound|throw|slam/.test(name) || (/walk/.test(name) && !/lunge/.test(name))) return unranked(muscle, 'time-distance-or-power', unilateral);
  if (equipment === 'bands' || /\bbands?\b/.test(name)) return unranked(muscle, 'band-resistance-not-kilograms', unilateral);
  const machine = ['machine','plate-loaded machine','smith machine','cable'].includes(equipment) || /machine|plate loaded|leverage/.test(name);
  const bodyweight = /pull up|chin up|push up|\bdips?\b/.test(name) && !machine;
  if ((equipment === 'body only' || /bodyweight|suspension|\btrx\b|inverted row|nordic|glute bridge/.test(name)) && !bodyweight) return unranked(muscle, 'bodyweight-leverage-not-calibrated', unilateral);
  if (/swing|windmill|get up|thruster|halo|figure 8/.test(name)) return unranked(muscle, 'power-or-complex-movement', unilateral);

  let reference = references[muscle], rule = 'muscle-reference';
  const use = (value, label) => { reference = value; rule = label; };
  if (/deadlift/.test(name) && !/romanian|stiff/.test(name)) use(1.8, 'deadlift');
  else if (/romanian|stiff leg|\brdl\b|good morning/.test(name)) use(1, 'hip-hinge');
  if (muscle === 'quads' && /leg press/.test(name)) use(2.5, 'leg-press');
  else if (/leg extension/.test(name)) use(1, 'knee-extension');
  else if (/leg curl/.test(name)) use(.65, 'knee-flexion');
  else if (muscle === 'hips' && /adduct|abduct|kickback/.test(name)) use(.65, 'hip-isolation');
  if (/(?:lateral|front) raises?\b|reverse fly|rear delt fly|rear lateral|pec deck/.test(name) && muscle === 'shoulders') use(.2, 'shoulder-isolation');
  else if (muscle === 'chest' && /fly|flye|pec deck|crossover/.test(name)) use(.5, 'chest-isolation');
  else if (/face pull|rear delt row/.test(name)) use(.4, 'rear-shoulder-pull');
  else if (/straight arm|pullover/.test(name)) use(.6, 'shoulder-extension');
  if (/clean|snatch|jerk/.test(name) && !/grip|deadlift|pull|shrug|squat/.test(name)) use(/snatch/.test(name) ? .8 : /jerk/.test(name) ? 1.1 : 1, 'olympic-lift');
  if (bodyweight) use(/pull up|chin up/.test(name) ? 1.5 : /\bdips?\b/.test(name) ? 1.6 : 1.1, 'bodyweight-compound');

  // A pair of dumbbells is logged per dumbbell. Goblet and shared overhead
  // implements are one load; one-arm versions of those use per-side load.
  const handHeld = equipment === 'dumbbell' || /dumbbell/.test(name) || (equipment === 'kettlebells' && (/two arm|double|alternat/.test(name) || perKettlebell.has(name)));
  const shared = sharedDumbbells.has(name) || /goblet|single dumbbell|dumbbell overhead triceps extension/.test(name);
  const multiplier = unilateral ? 2 : handHeld && !shared ? 2 : 1;
  const benchmark=RANK_BENCHMARKS.get(name);
  if(benchmark)use(benchmark.reference,'observed-relative-reference');
  return { muscle, reference, mode:bodyweight ? 'bodyweight' : 'load',
    factor: /push up/.test(name) ? .65 : 1, multiplier, unilateral,
    unit: unilateral ? 'kg per side' : handHeld && !shared ? equipment === 'kettlebells' ? 'kg per kettlebell' : 'kg per dumbbell' : 'kg total', rule,
    source:benchmark?.source||null,calibration:benchmark?'observed-relative':'estimated',reason:null };
}

export const RANK_MODELS = new Map(CATALOG.map(entry => [exerciseId(entry.name), catalogueRankModel(entry)]));
export function rankModel(name) {
  const id = exerciseId(name), model = RANK_MODELS.get(id) || (id === 'dumbbell bench press' ? RANK_MODELS.get(exerciseId('Flat Dumbbell Bench Press')) : null);
  return model || unranked(null, 'unknown-movement');
}
export function rankModelEntry(name) { return entries.get(exerciseId(name)); }
