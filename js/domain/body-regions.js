// Regional drill-downs reuse qualifying lift scores; they do not add muscles
// to the overall rank denominator or change leaderboard scores.
const splits = {
  back: [['traps', 'Traps'], ['midback', 'Mid-back'], ['lats', 'Lats']],
  hips: [['hips', 'Glutes & abductors'], ['adductors', 'Adductors']],
  abs: [['abs', 'Abs'], ['obliques', 'Obliques']],
};
// Shared names for the bodygraph and exercise-picker filters, not saved categories.
export const BODY_REGION_GROUPS=[['chest','Chest'],...splits.back,['shoulders','Shoulders'],['biceps','Biceps'],['triceps','Triceps'],['forearms','Forearms'],['quads','Quads'],['hamstrings','Hamstrings'],['calves','Calves'],...splits.hips,...splits.abs,['lowerback','Lower back']];
export function liftBodyRegion(lift) {
  const n = lift.name.toLowerCase();
  if (lift.muscle === 'back') {
    if (/shrug|trap raise/.test(n)) return 'traps';
    if (/pulldown|pull.down|pull.up|chin.up|pullover/.test(n)) return 'lats';
    return 'midback';
  }
  if (lift.muscle === 'abs') return /oblique|side.*(?:bend|crunch|plank|jackknife)|wood.?chop|russian|twist|rotation/.test(n) ? 'obliques' : 'abs';
  if (lift.muscle === 'hips' && /adduct|inner.thigh/.test(n) && !/abduct/.test(n)) return 'adductors';
  return lift.muscle;
}
export function liftBodyRegions(lift) {
  const primary = liftBodyRegion(lift), n = lift.name.toLowerCase();
  if (/upright[ -]row/.test(n)) return ['shoulders', 'traps'];
  if (/\brows?\b/.test(n) && !/rowing machine/.test(n)) return [...new Set([primary, 'midback', 'traps'])];
  if (lift.muscle === 'abs' && /crunch/.test(n)) return ['abs', 'obliques'];
  return [primary];
}
export function bodyRegions(stats) {
  return stats.muscles.flatMap(group => (splits[group.id] || [[group.id, group.name]]).map(([id, name]) => {
    const exercises = stats.exercises.filter(lift => lift.active && liftBodyRegions(lift).includes(id));
    const rank = exercises.reduce((best, lift) => lift.rank && (!best || lift.rank.score > best.score) ? lift.rank : best, null);
    return { ...group, id, name, exercises, rank };
  }));
}
