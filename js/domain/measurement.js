import { normalizedExerciseName } from './exercises.js';

// Units live in the existing target string, which old clients already preserve.
// The set's numeric r value is seconds only when its logged target says so.
// Historical numeric targets are never inferred to be seconds on playback.
export const isSecondsTarget = target => /(?:^|[0-9\s])(?:s|sec|secs|seconds?)$/i.test(String(target || '').trim());
const explicitReps = target => /\sreps?$/i.test(String(target || '').trim());
export function isHoldExercise(name) {
  const n = normalizedExerciseName(name).replace(/^deadhangs?$/, 'dead hang').replace(/dead hangs$/, 'dead hang').replace(/^one handed hang$/, 'single arm dead hang');
  return /^(?:(?:weighted|single arm|one arm|single leg|one leg|side|front|reverse|forearm|high|low) )*(?:dead hang|hang|active hang|passive hang|flexed arm hang|plank|l sit|hollow body hold|wall sit|plate pinch|front lever hold|back lever hold)$/.test(n) || /\bholds?$/.test(n) || /^isometric .+ exercise/.test(n);
}
export function measurement(exercise, infer = true) {
  if (isSecondsTarget(exercise.target)) return 'seconds';
  if (explicitReps(exercise.target)) return 'reps';
  return infer && isHoldExercise(exercise.name) ? 'seconds' : 'reps';
}
export const defaultTarget = name => isHoldExercise(name) ? '30 s' : '8–12';
function stripUnit(value) {
  const text = String(value || '').trim();
  return isSecondsTarget(text) ? text.replace(/(?:seconds?|secs?|s)$/i,'').trim() : explicitReps(text) ? text.replace(/\sreps?$/i,'').trim() : text;
}
export function targetValue(exercise) {
  if (measurement(exercise) === 'seconds' && !isSecondsTarget(exercise.target)) return '30';
  return stripUnit(exercise.target || defaultTarget(exercise.name));
}
export function withUnit(value, unit) {
  const clean = stripUnit(value);
  return unit === 'seconds' ? (clean.slice(0, 18) || '30') + ' s' : (clean.slice(0, 15) || '8–12') + ' reps';
}
