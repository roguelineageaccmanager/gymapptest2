import { it, expect } from 'vitest';
import { rankSet, strengthStats, estimatedMax, movement, RANKS, rankFromScore, rankText } from '../../js/domain/ranks.js';
import { cleanSettings } from '../../js/domain/settings.js';
import { cleanAppearance, applyAppearance } from '../../js/domain/appearance.js';
const session = sets => ({ exercises: [{ name: 'Barbell Bench Press', sets }] });
it('uses a documented movement reference, one-rep actual load and a bounded Epley estimate', () => {
  expect(estimatedMax(100, 1)).toBe(100); expect(estimatedMax(60, 10)).toBe(80);
  expect(estimatedMax(60, 13)).toBeNull(); expect(estimatedMax(60, 1.5)).toBeNull();
  expect(rankSet('Barbell Bench Press', 80, 1, 80).name).toBe('Gold 4');
  expect(rankSet('Dumbbell Bench Press', 40, 1, 80).name).toBe('Gold 4');
  expect(rankSet('Barbell Curl', 32, 8, 80).score).toBe(380);
  expect(rankSet('Barbell Bench Press', 1000, 1, 80).score).toBe(999);
  expect(rankSet('Mystery', 80, 1, 80)).toBeNull();
});
it('counts completed sets only, uses historical weigh-ins and never borrows a future weight', () => {
  const logs = { '2026-01-01': [session([{ w: '80', r: '1', done: true }, { w: '300', r: '1', done: false }])], '2026-02-01': [session([{ w: '80', r: '1', done: true }])] };
  const weights = [{ date: '2026-01-15', weight: 80 }, { date: '2027-01-01', weight: 40 }];
  const stats = strengthStats(logs, weights, {Push:[{name:'Barbell Bench Press'}]}, '2026-03-01');
  expect(stats.sets).toBe(2); expect(stats.volume).toBe(160);
  expect(stats.overall.name).toBe('Gold 4'); expect(stats.history).toEqual([{ date: '2026-02-01', w: 300 }]);
  expect(stats.exercises[0].bestSet.date).toBe('2026-02-01');
  expect(strengthStats(logs, weights, {Push:[{name:'Barbell Bench Press'}]}, '2026-01-10').overall).toBeNull();
  expect(strengthStats({}, weights).exercises).toEqual([]);
});
it('includes bodyweight for calisthenics, leaves assisted/timed lifts unrated and keeps meow curls in forearms', () => {
  expect(rankSet('Pull-up', 0, 8, 80)?.max).toBeGreaterThan(80);
  expect(rankSet('Assisted Pull-Up', 20, 8, 80)).toBeNull(); expect(rankSet('Plank', 30, 8, 80)).toBeNull();
  expect(movement('Meow Curls').muscle).toBe('forearms');
  expect(movement('Leg Curl').muscle).toBe('hamstrings');
});
it('recomputes ranks after deletions rather than keeping stale bests', () => {
  const weights = [{ date: '2026-01-01', weight: 80 }];
  const logs = { '2026-01-02': [session([{ w: 80, r: 1, done: true }])], '2026-01-03': [session([{ w: 160, r: 1, done: true }])] };
  expect(strengthStats(logs, weights).overall.name).toBe('Diamond 4');
  delete logs['2026-01-03']; expect(strengthStats(logs, weights).overall.name).toBe('Gold 4');
});
it('uses ten fixed ordered tiers and discards obsolete rank customization', () => {
  expect(RANKS.map(rank=>rank.name)).toEqual(['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger']);
  expect(new Set(RANKS.map(rank=>rank.color)).size).toBe(10);
  const values = {rankColors:{gold:'#ff0000'},statsFinish:'flat'};
  expect(cleanSettings(values)).toEqual({});
  const appearance=cleanAppearance(values),settings={}; applyAppearance(settings,appearance);
  expect(settings.rankColors).toBeUndefined(); expect(settings.statsFinish).toBeUndefined();
});

it('ranks only canonical exercises assigned in the current split while retaining all logged history', () => {
  const logs={'2026-01-02':[{exercises:[{name:'Preacher Curls',sets:[{w:30,r:8,done:true}]},{name:'Barbell Bench Press',sets:[{w:160,r:1,done:true}]}]}]};
  const weights=[{date:'2026-01-01',weight:80}],workouts={Pull:[{name:'Preacher Curl'}],Archived:[{name:'Barbell Bench Press'}]},before=structuredClone(logs);
  const stats=strengthStats(logs,weights,workouts,'2026-02-01',{0:'Pull'});
  expect(stats.ranked).toBe(1);expect(stats.exercises.find(x=>x.name==='Barbell Bench Press').rank).toBeNull();
  expect(stats.muscles.find(x=>x.id==='chest').exercises).toEqual([]);
  expect(stats.exercises).toHaveLength(2);expect(stats.sets).toBe(2);expect(logs).toEqual(before);
  expect(strengthStats(logs,weights,{},'2026-02-01',{}).overall).toBeNull();
  expect(strengthStats(logs,weights,workouts,'2026-02-01',{0:'Archived'}).overall.name).toBe('Diamond 4');
});

it('hides canonical Stats exercises without deleting logs or merging distinct equipment',()=>{
 const logs={'2026-01-02':[{exercises:[{name:'Preacher Curls',sets:[{w:30,r:8,done:true}]},{name:'Dumbbell Curl',sets:[{w:20,r:8,done:true}]}]}]},before=structuredClone(logs),weights=[{date:'2026-01-01',weight:80}];
 const stats=strengthStats(logs,weights,null,'2026-02-01',null,['Preacher Curl']);
 expect(stats.exercises.map(e=>e.name)).toEqual(['Dumbbell Curl']);expect(logs).toEqual(before);
 expect(strengthStats(logs,weights,null,'2026-02-01',null,[]).exercises).toHaveLength(2);
 const settings=cleanSettings({hiddenStatsExercises:['Preacher Curls','preacher curl','Dumbbell Curl',42,'']});
 expect(settings.hiddenStatsExercises).toEqual(['Preacher Curl','Dumbbell Curl']);
 expect(cleanAppearance(settings).hiddenStatsExercises).toBeUndefined();
});


it('adds divisions 4 to 1 without rescaling any existing score or tier', () => {
  for (let score = 0; score <= 999; score++) {
    const rank = rankFromScore(score);
    expect(rank.score).toBe(score);
    expect(rank.id).toBe(RANKS[Math.floor(score / 100)].id);
    if (score < 700) {
      expect(rank.division).toBe(4 - Math.floor((score % 100) / 25));
      expect(rank.lp).toBe((score % 25) * 4);
      expect(rank.lpToNext).toBe(100 - rank.lp);
      expect(rank.next.name).toBe(rankFromScore(Math.floor(score / 25) * 25 + 25).name);
    } else {
      expect(rank.division).toBeNull();
      expect(rank.lp).toBe(score - 700);
    }
  }
  expect(rankFromScore(400)).toMatchObject({ name: 'Platinum 4', lp: 0, next: { name: 'Platinum 3' } });
  expect(rankFromScore(424)).toMatchObject({ name: 'Platinum 4', lp: 96, lpToNext: 4 });
  expect(rankFromScore(425)).toMatchObject({ name: 'Platinum 3', lp: 0 });
  expect(rankFromScore(450).name).toBe('Platinum 2');
  expect(rankFromScore(475).name).toBe('Platinum 1');
  expect(rankFromScore(500).name).toBe('Emerald 4');
  expect(rankFromScore(699)).toMatchObject({ name: 'Diamond 1', next: { name: 'Master' }, lpToNext: 4 });
  expect(rankFromScore(799)).toMatchObject({ name: 'Master', lp: 99, lpToNext: 1 });
  expect(rankFromScore(800)).toMatchObject({ name: 'Grandmaster', lp: 100 });
  expect(rankFromScore(999)).toMatchObject({ name: 'Challenger', lp: 299, next: null, progress: 100 });
  expect(rankText(425)).toBe('Platinum 3 · 0 LP');
  expect(rankFromScore(-1).score).toBe(0);
  expect(rankFromScore(NaN).score).toBe(0);
  expect(rankFromScore(Infinity).score).toBe(999);
});

it('gives distinct requested lifts their own rank and leaves mobility/cardio history unranked', () => {
  for (const name of ['Single-Arm Cable Lateral Raises', 'Single-Arm Cable Rear Delt Fly', 'Smith Machine Shoulder Press', 'Smith Machine Incline Bench Press', 'Chest Press Machine', 'Plate-Loaded Row', 'Plate-Loaded Low Row', 'Plate-Loaded Pulldown', 'Seated Lumbar Extension Machine', '45-Degree Back Extension', 'Preacher Curl', 'Supinating Dumbbell Curl', 'Reverse Cable Bicep Curls', 'Single-Arm Tricep Pushdowns', 'Rope Overhead Cable Triceps Extension', 'Cable Wrist Flexion', 'Cable Wrist Extension', 'JM Press', 'Leg Press', 'Seated Leg Curl', 'Leg Extension', 'Hip Abduction', 'Hip Adduction', 'Standing Calf Raise', 'Leg Press Calf Raise', 'Abdominal Crunch Machine']) {
    expect(rankSet(name, 20, 8, 80)?.division, name).not.toBeUndefined();
  }
  for (const name of ['90/90 Hamstring', 'Neck-SMR', 'Wind Sprints', 'Depth Jump Leap', 'Plank', 'Hanging Leg Raise', 'Farmer Carry']) expect(rankSet(name, 100, 8, 80), name).toBeNull();
  expect(rankSet('Hang Clean', 80, 1, 80)).not.toBeNull();
  const logs = {'2026-01-02':[{exercises:[
    {name:'Plate-Loaded Row',sets:[{w:80,r:1,done:true}],warmups:[{w:999,r:1,done:true}]},
    {name:'Plate-Loaded Low Row',sets:[{w:40,r:1,done:true}]},
    {name:'90/90 Hamstring',sets:[{w:100,r:8,done:true}]},
  ]}]}, before = structuredClone(logs);
  const stats = strengthStats(logs,[{date:'2026-01-01',weight:80}]);
  expect(stats.exercises.find(x=>x.name==='Plate-Loaded Row').rank).toMatchObject({name:'Gold 4',lp:0,score:300});
  expect(stats.exercises.find(x=>x.name==='Plate-Loaded Low Row').rank).toMatchObject({name:'Bronze 2',lp:0,score:150});
  expect(stats.exercises.find(x=>x.name==='90/90 Hamstring')).toMatchObject({rank:null,sets:1});
  expect(stats.ranked).toBe(2);
  expect(logs).toEqual(before);
});
