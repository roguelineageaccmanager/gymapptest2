import { it, expect } from 'vitest';
import { sanitizeExercise, mergePlans, planHashes } from '../../js/domain/plan.js';
import { sanitizeLogs, mergeLogs, dailySummaries, leaderboardStats, bestWeight } from '../../js/domain/logs.js';
import { strengthStats } from '../../js/domain/ranks.js';
it('keeps warm-ups separate from working-set stats, bests and ranks',()=>{
  const work={w:'40',r:'8',done:true},warm={w:'100',r:'1',done:true};
  const logs={'2026-10-27':[{id:'test',day:'Push',time:'2026-10-27T12:00:00Z',exercises:[{name:'Barbell Bench Press',sets:[work],warmups:[warm]}]}]};
  const clean=sanitizeLogs(logs);expect(clean['2026-10-27'][0].exercises[0].warmups).toEqual([warm]);
  const stats=strengthStats(clean,[{date:'2026-10-27',weight:80}]);
  expect(stats.sets).toBe(1);expect(stats.volume).toBe(320);expect(stats.exercises[0].best).toBe(40);
  expect(bestWeight(clean,'Barbell Bench Press')).toBe(40);
  expect(leaderboardStats(clean).volume_kg_reps).toBe(320);
  expect(dailySummaries(clean)['2026-10-27'].volume_kg_reps).toBe(320);
  const legacy=structuredClone(clean);delete legacy['2026-10-27'][0].exercises[0].warmups;
  expect(mergeLogs(clean,legacy)['2026-10-27'][0].exercises[0].warmups).toEqual([warm]);
  legacy['2026-10-27'][0].exercises[0].warmups=[];
  expect(mergeLogs(clean,legacy)['2026-10-27'][0].exercises[0].warmups).toEqual([]);
});
it('preserves absent legacy template fields but honours disabling and unilateral counts',()=>{
  expect(sanitizeExercise({name:'Curl',warmupSets:3,unilateral:true}).warmupSets).toBe(4);
  const plan={workouts:{Push:[{name:'Bench',sets:2,warmupSets:2}]},schedule:{0:'Push'}};
  const legacy=structuredClone(plan);delete legacy.workouts.Push[0].warmupSets;legacy.workouts.Push[0].sets=3;
  expect(mergePlans(plan,legacy,planHashes(plan)).workouts.Push[0]).toMatchObject({sets:3,warmupSets:2});
  legacy.workouts.Push[0].warmupSets=0;
  expect(mergePlans(plan,legacy,planHashes(plan)).workouts.Push[0].warmupSets).toBe(0);
});
