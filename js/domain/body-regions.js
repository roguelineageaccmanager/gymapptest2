// Regional drill-downs reuse qualifying lift scores; they do not add muscles
// to the overall rank denominator or change leaderboard scores.
const splits = {
  back: [['traps', 'Traps'], ['midback', 'Mid-back'], ['lats', 'Lats']],
  hips: [['hips', 'Glutes'], ['adductors', 'Adductors']],
  abs: [['abs', 'Abs'], ['obliques', 'Obliques']],
};
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
export function bodyRegions(stats) {
  return stats.muscles.flatMap(group => (splits[group.id] || [[group.id, group.name]]).map(([id, name]) => {
    const exercises = stats.exercises.filter(lift => lift.active && liftBodyRegion(lift) === id);
    const rank = exercises.reduce((best, lift) => lift.rank && (!best || lift.rank.score > best.score) ? lift.rank : best, null);
    return { ...group, id, name, exercises, rank };
  }));
}
