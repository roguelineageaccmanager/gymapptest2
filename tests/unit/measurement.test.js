import {it,expect} from 'vitest';
import {isHoldExercise,isSecondsTarget,measurement,defaultTarget,targetValue,withUnit} from '../../js/domain/measurement.js';
import {sanitizeWorkouts,mergePlans} from '../../js/domain/plan.js';
import {sanitizeLogs,mergeLogs,mergeProgress,dailySummaries,leaderboardStats,liftPoints} from '../../js/domain/logs.js';
import {strengthStats} from '../../js/domain/ranks.js';

it('defaults static holds to seconds without confusing hanging raises or hang cleans',()=>{
  for(const name of ['Dead Hang','Deadhangs','Dead Hangs','Front Plank','Front Lever Hold','Single-Arm Dead Hang','Plank','Side Plank','L-Sit','Wall Sit','Hollow Body Hold','Plate Pinch']) {
    expect(isHoldExercise(name),name).toBe(true);expect(defaultTarget(name)).toBe('30 s');
  }
  for(const name of ['Hang Clean','Hanging Leg Raise','Shoulder Press','Plank Row'])expect(isHoldExercise(name),name).toBe(false);
  expect(measurement({name:'Dead Hang',target:'8–12'},false)).toBe('reps');
  expect(measurement({name:'Dead Hang',target:'8–12'})).toBe('seconds');
  expect(measurement({name:'Dead Hang',target:'8 reps'})).toBe('reps');
  expect(targetValue({name:'Dead Hang',target:'8–12'})).toBe('30');
  expect(targetValue({name:'Dead Hang',target:'45 s'})).toBe('45');
  expect(targetValue({name:'Custom',target:'3 sets'})).toBe('3 sets');
  for(const target of ['30s','30 s','10–20 seconds','45 SEC'])expect(isSecondsTarget(target)).toBe(true);
  for(const target of ['8–12','8 reps','AMRAP','sets'])expect(isSecondsTarget(target)).toBe(false);
  expect(withUnit('45','seconds')).toBe('45 s');
  expect(withUnit('8–12','reps')).toBe('8–12 reps');
});

it('preserves seconds in the existing plan/log fields across sanitizing and merging',()=>{
  const exercise={name:'Dead Hang',cat:'back',sets:2,target:'45 s',rest:90};
  const plan={workouts:{Hold:[exercise]},schedule:{0:'Hold'}};
  expect(sanitizeWorkouts(plan.workouts).Hold[0].target).toBe('45 s');
  expect(mergePlans(plan,plan).workouts.Hold[0].target).toBe('45 s');
  const logs={'2026-01-02':[{id:'hold',day:'Hold',time:'2026-01-02T12:00:00Z',exercises:[{name:'Dead Hang',target:'45 s',sets:[{w:'20',r:'45',done:true}],warmups:[{w:'',r:'15',done:true}]}]}]};
  expect(sanitizeLogs(logs)['2026-01-02'][0].exercises).toEqual(logs['2026-01-02'][0].exercises);
  expect(mergeLogs(logs,logs)['2026-01-02'][0].exercises).toEqual(logs['2026-01-02'][0].exercises);
  expect(mergeProgress({}, {'Dead Hang':{sets:[{w:'20',r:'45'}],target:'45 s',updatedAt:1}})['Dead Hang'].target).toBe('45 s');
});

it('separates seconds from reps, lifting volume, estimated maxes and LP without rewriting legacy data',()=>{
  const logs={'2026-01-02':[{id:'mixed',day:'Test',duration:120,exercises:[
    {name:'Dead Hang',target:'45 s',sets:[{w:'20',r:'45',done:true}],warmups:[{w:'10',r:'15',done:true}]},
    {name:'Barbell Bench Press',target:'8',sets:[{w:'50',r:'6',done:true}]},
  ]}]},before=structuredClone(logs);
  expect(dailySummaries(logs)['2026-01-02'].volume_kg_reps).toBe(300);
  expect(leaderboardStats(logs).volume_kg_reps).toBe(300);
  expect(liftPoints(logs,'Dead Hang')).toEqual([]);
  const stats=strengthStats(logs,[{date:'2026-01-01',weight:80}]);
  expect(stats).toMatchObject({sets:2,reps:6,volume:300,ranked:1});
  expect(stats.exercises.find(e=>e.name==='Dead Hang')).toMatchObject({rank:null,timedSets:1,bestSeconds:45,timedBestWeight:20,points:[],timedPoints:[{date:'2026-01-02',w:45}]});
  expect(logs).toEqual(before);
  logs['2026-01-02'][0].exercises[0].target='8–12';
  expect(dailySummaries(logs)['2026-01-02'].volume_kg_reps).toBe(1200);
  const legacy=strengthStats(logs,[{date:'2026-01-01',weight:80}]);
  expect(legacy.exercises.find(e=>e.name==='Dead Hang').timedSets).toBe(0);
});
