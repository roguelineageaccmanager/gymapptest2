// Raw stored names are intentional here: history is never silently renamed.
const lists = plan => plan?.workouts && typeof plan.workouts === 'object' ? plan.workouts : {};
const names = list => new Set((Array.isArray(list) ? list : []).map(e => e?.name).filter(n => typeof n === 'string'));
export function planLosses(before, after) {
  const previous = lists(before), next = lists(after), losses = { routines: [], exercises: {}, days: [] };
  for (const [name, list] of Object.entries(previous)) {
    if (!Object.hasOwn(next, name)) { losses.routines.push(name); continue; }
    const remaining = names(next[name]), removed = [...names(list)].filter(n => !remaining.has(n));
    if (removed.length) losses.exercises[name] = removed;
  }
  for (let i=0;i<7;i++) if (before?.schedule?.[i] && !after?.schedule?.[i]) losses.days.push(String(i));
  return losses;
}
export const hasPlanLoss = loss => loss.routines.length > 0 || loss.days.length > 0 || Object.keys(loss.exercises).length > 0;
export function coversPlanLoss(approval, loss) {
  return loss.routines.every(n => approval?.routines?.includes(n)) && loss.days.every(n => approval?.days?.includes(n)) && Object.entries(loss.exercises).every(([routine,names]) => names.every(n => approval?.exercises?.[routine]?.includes(n)));
}
export function combinePlanLoss(a, b) {
  const union = (x=[],y=[]) => [...new Set([...x,...y])];
  return { routines: union(a?.routines,b?.routines), days: union(a?.days,b?.days), exercises: Object.fromEntries([...new Set([...Object.keys(a?.exercises || {}),...Object.keys(b?.exercises || {})])].map(n => [n,union(a?.exercises?.[n],b?.exercises?.[n])])) };
}
export function prunePlanLoss(approval, plan) {
  const current=lists(plan);
  return { routines:(approval?.routines || []).filter(n=>!Object.hasOwn(current,n)), days:(approval?.days || []).filter(n=>!plan?.schedule?.[n]), exercises:Object.fromEntries(Object.entries(approval?.exercises || {}).map(([routine,removed])=>[routine,removed.filter(n=>!names(current[routine]).has(n))]).filter(([,removed])=>removed.length)) };
}
