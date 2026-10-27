// Explicit aliases only. Distinct equipment, angles and assistance stay distinct.
export const normalizedExerciseName = name => String(name || '').normalize('NFKC').toLowerCase().replace(/[–—_-]/g, ' ').replace(/\s+/g, ' ').trim();
const aliases = {
  'preacher curls': 'Preacher Curl',
  'leg extensions': 'Leg Extension',
  'standing calf raises': 'Standing Calf Raise',
  'seated calf raises': 'Seated Calf Raise',
  'hip abduction machine': 'Hip Abduction',
  'hip adduction machine': 'Hip Adduction',
  'reverse chest fly machine': 'Reverse Pec Deck',
  'shoulder press machine': 'Machine Shoulder Press',
};
const canonical = new Map(Object.entries(aliases));
for (const name of Object.values(aliases)) canonical.set(normalizedExerciseName(name), name);
export const exerciseName = name => canonical.get(normalizedExerciseName(name)) || String(name || '').trim();
export const exerciseId = name => normalizedExerciseName(exerciseName(name));
export const sameExercise = (a, b) => exerciseId(a) === exerciseId(b);
export function exerciseBest(bests, name) {
  return Math.max(0, ...Object.entries(bests || {}).filter(([key]) => sameExercise(key, name)).map(([, value]) => Number(value) || 0));
}
export function lastExerciseUse(lastUsed, name) {
  return Object.entries(lastUsed || {}).filter(([key]) => sameExercise(key, name)).sort((a,b) => (Number(b[1]?.updatedAt) || 0) - (Number(a[1]?.updatedAt) || 0))[0]?.[1];
}
