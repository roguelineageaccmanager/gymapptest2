// Regional drill-downs reuse qualifying lift scores; they do not add muscles
// to the overall rank denominator or change leaderboard scores.
const splits = {
  back: [['traps', 'Traps'], ['midback', 'Mid-back'], ['lats', 'Lats']],
  hips: [['hips', 'Glutes'], ['adductors', 'Adductors']],
};
// Shared names for the bodygraph and exercise-picker filters, not saved categories.
export const BODY_REGION_GROUPS=[['chest','Chest'],...splits.back,['shoulders','Shoulders'],['biceps','Biceps'],['triceps','Triceps'],['forearms','Forearms'],['quads','Quads'],['hamstrings','Hamstrings'],['calves','Calves'],...splits.hips,['abs','Abs'],['lowerback','Lower back']];
export function liftBodyRegion(lift) {
  const n = lift.name.toLowerCase();
  if (lift.muscle === 'back') {
    if (/shrug|trap raise/.test(n)) return 'traps';
    if (/pulldown|pull.down|pull.up|chin.up|pullover/.test(n)) return 'lats';
    return 'midback';
  }
  if (lift.muscle === 'hips' && /adduct|inner.thigh/.test(n) && !/abduct/.test(n)) return 'adductors';
  return lift.muscle;
}
export function liftBodyRegions(lift) {
  const primary = liftBodyRegion(lift), n = lift.name.toLowerCase();
  if (/upright[ -]row/.test(n)) return ['shoulders', 'traps'];
  if (/\brows?\b/.test(n) && !/rowing machine/.test(n)) return [...new Set([primary, 'midback', 'traps'])];
  return [primary];
}
export function bodyRegions(stats) {
  return stats.muscles.flatMap(group => (splits[group.id] || [[group.id, group.name]]).map(([id, name]) => {
    const exercises = stats.exercises.filter(lift => lift.active && liftBodyRegions(lift).includes(id));
    const bestRank = field => exercises.reduce((best, lift) => {
      const rank = lift[field];
      return rank && (!best || rank.score > best.score) ? rank : best;
    }, null);
    const strength = bestRank('rank');
    const estimate = bestRank('estimatedRank');
    const estimated = estimate && (!strength || estimate.score > strength.score) ? estimate : null;
    const training = strength || estimated ? null : bestRank('trainingRank');
    return { ...group, id, name, exercises, rank: estimated || strength || (training?.score ? training : null), confirmedRank:strength,
      estimated: !!estimated, training: !!training?.score };
  }));
}
