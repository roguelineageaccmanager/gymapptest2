import { attachmentFor, gripFor } from './attachments.js';
import { CATALOG, searchCatalog } from './catalog.js';
import { exerciseId, sameExercise } from './exercises.js';
import { MAX_SETS } from './plan.js';
import { SIDE_VARIANTS } from './side-variants.js';

const entries = new Map(CATALOG.map(x => [exerciseId(x.name), x]));
// Presentation groups only. Never merge stored identities, scores or histories.
export const EXERCISE_FAMILIES = SIDE_VARIANTS.map(([both, one, limb = 'arm', aliases = []]) => ({
  id: exerciseId(both), name: both, limb,
  variants: [entries.get(exerciseId(both)), entries.get(exerciseId(one))],
  members: [both, one, ...aliases].map(exerciseId),
}));
EXERCISE_FAMILIES.push({ id: 'dumbbell row one arm', name: 'Dumbbell Row', limb: 'arm',
  variants: [entries.get(exerciseId('Single-Arm Dumbbell Row'))], members: ['Single-Arm Dumbbell Row', 'One-arm Dumbbell Row'].map(exerciseId) });
// Fixed one-side movements get a neutral picker label without inventing a
// bilateral version or merging different equipment/angles. Saved names stay intact.
const represented = new Set(EXERCISE_FAMILIES.flatMap(f => f.members));
const sideWords = /\b(?:single|one)[ -](?:arm|leg)(?:ged)?[ -]?|\b(?:alternate|alternating)\s+/gi;
for (const entry of CATALOG) {
  const id = exerciseId(entry.name);
  if (represented.has(id) || !entry.unilateral || !sideWords.test(entry.name)) { sideWords.lastIndex = 0; continue; }
  sideWords.lastIndex = 0;
  const name = entry.name.replace(sideWords, '').replace(/\s+/g, ' ').trim();
  EXERCISE_FAMILIES.push({ id, name, limb: /(?:single|one)[ -]leg/i.test(entry.name) ? 'leg' : 'arm', variants:[entry], members:[id] });
  represented.add(id);
}
const families = new Map(EXERCISE_FAMILIES.flatMap(f => f.members.map(id => [id, f])));
export const exerciseFamily = name => families.get(exerciseId(name));
export function variantAlreadyIn(routine, variant, except) {
  const family = exerciseFamily(variant.name);
  return routine.some(item => item !== except && (sameExercise(item.name, variant.name) ||
    (family && family === exerciseFamily(item.name) && !family.variants.some(v => sameExercise(v.name, item.name)) && !!entries.get(exerciseId(item.name))?.unilateral === !!variant.unilateral)));
}
export const sideLabel = (entry, family) => entry.unilateral ? `One ${family.limb}` : `Both ${family.limb === 'leg' ? 'legs' : 'arms'}`;
export function searchExerciseFamilies(query, group, equipment) {
  const seen = new Set();
  return searchCatalog(query, group, equipment).flatMap(entry => {
    const family = exerciseFamily(entry.name), id = family?.id || exerciseId(entry.name);
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ ...entry, family, displayName: family?.name || entry.name }];
  });
}

// Switching changes only the edited routine, never old logs or another exercise.
// Separate variants deliberately keep separate last-used values and strength ranks.
export function changeExerciseVariant(exercise, name, routine) {
  const family = exerciseFamily(exercise.name);
  const next = family?.variants.find(x => sameExercise(x.name, name));
  if (!next) return { error: 'That version is not available.' };
  if (variantAlreadyIn(routine, next, exercise)) return { error: 'That version is already in this workout.' };
  const perSide = exercise.unilateral ? Math.max(1, Math.round(exercise.sets / 2)) : exercise.sets;
  const warmups = exercise.unilateral ? Math.round((exercise.warmupSets || 0) / 2) : (exercise.warmupSets || 0);
  if (perSide > MAX_SETS || (next.unilateral && warmups > 6)) return { error: 'Reduce the set count before switching versions.' };
  return { exercise: { ...exercise, attachment:attachmentFor(next.name,exercise.attachment), grip:gripFor(next.name,exercise.grip), name: next.name, cat: next.cat, unilateral: !!next.unilateral,
    sets: perSide * (next.unilateral ? 2 : 1),
    ...(exercise.warmupSets !== undefined ? { warmupSets: Math.min(12, warmups * (next.unilateral ? 2 : 1)) } : {}),
    sides: next.unilateral ? 'both' : undefined,
  } };
}
