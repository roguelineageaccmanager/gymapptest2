import {it,expect} from 'vitest';
import {rankSet,strengthStats,movement,rankSetupKey} from '../../js/domain/ranks.js';
import {sharedRankSnapshot,sharedRankStats} from '../../js/domain/shared-ranks.js';
import {bodyRegions} from '../../js/domain/body-regions.js';
const weights=[{date:'2026-01-01',weight:80}];
const exercise=(attachment,w)=>({name:'Cable Lateral Raise',attachment,target:'8',sets:[{w:String(w),r:'8',done:true}]});
it('uses reviewed equipment/angle references instead of one chest target',()=>{
 expect(movement('Barbell Bench Press').reference).toBe(1);
 expect(movement('Flat Dumbbell Bench Press').reference).toBe(.8);
 expect(movement('Incline Barbell Press').reference).toBe(.83);
 expect(movement('Smith Machine Bench Press').reference).toBe(.97);
 expect(rankSet('Flat Dumbbell Bench Press',32,1,80).score).toBe(300);
 expect(rankSet('Barbell Bench Press',64,1,80).score).toBe(240);
 expect(rankSet('Dumbbell Lateral Raise',14.4,1,80).score).toBe(300);
 expect(movement('Plate-Loaded Pulldown').calibration).toBe('estimated');
 expect(movement('Lat Pulldown').calibration).toBe('observed-relative');
});
it('keeps attachment best sets separate and only ranks setups in the assigned plan',()=>{
 const logs={'2026-01-02':[{exercises:[exercise('handle',30),exercise('cuff',10)]}]},before=structuredClone(logs);
 const all=strengthStats(logs,weights);
 expect(all.exercises).toHaveLength(2);
 expect(all.exercises.find(e=>e.attachment==='cuff').bestSet.w).toBe(10);
 expect(all.exercises.find(e=>e.attachment==='handle').bestSet.w).toBe(30);
 const current=strengthStats(logs,weights,{Push:[exercise('cuff',10)]},'2026-01-03',{0:'Push'});
 expect(current.overall.score).toBe(rankSet('Cable Lateral Raise',10,8,80).score);
 expect(current.exercises.find(e=>e.attachment==='handle').rank).toBeNull();
 expect(current.volume).toBe(320);expect(logs).toEqual(before);
});
it('does not manufacture an attachment bonus and preserves legacy unspecified setups',()=>{
 const logs={'2026-01-02':[{exercises:[exercise('handle',10),exercise('cuff',10),exercise(undefined,10),exercise('not-a-real-attachment',10)]}]};
 const stats=strengthStats(logs,weights);
 expect(stats.exercises).toHaveLength(3);
 expect(new Set(stats.exercises.map(e=>e.rank.score)).size).toBe(1);
 expect(stats.exercises.find(e=>!e.attachment).sets).toBe(2);
});
it('shares distinct setup ranks and retains them through profile reconstruction',()=>{
 const stats=strengthStats({'2026-01-02':[{exercises:[exercise('handle',30),exercise('cuff',10)]}]},weights);
 const back=sharedRankStats(sharedRankSnapshot(stats));
 expect(back.exercises).toHaveLength(2);
 expect(back.exercises.map(e=>[e.attachment,e.bestSet.w,e.rank.score])).toEqual(stats.exercises.map(e=>[e.attachment,e.bestSet.w,e.rank.score]));
 expect(back.overall.score).toBe(stats.overall.score);
});

it('does not merge a legacy custom name with a catalogue attachment setup',()=>{
 expect(rankSetupKey({name:'Cable Lateral Raise',attachment:'cuff'})).not.toBe(rankSetupKey({name:'Cable Lateral Raise::cuff'}));
 expect(rankSetupKey({name:'Cable Lateral Raise',attachment:'none'})).toBe(rankSetupKey({name:'Cable Lateral Raise'}));
});

it('ranks only the row variation assigned to the split while keeping both histories', () => {
 const oneArm = 'Single-Arm Plate-Loaded Row', twoArm = 'Plate-Loaded Row';
 const set = w => ({w, r:8, done:true});
 const logs = {'2026-01-02':[{exercises:[
   {name:twoArm,sets:[set(150)]},
   {name:oneArm,sets:[set(30),set(35)]},
 ]}]};
 const workouts = {Pull:[{name:oneArm}], Old:[{name:twoArm}]};
 const stats = strengthStats(logs, weights, workouts, '2026-01-03', {0:'Pull'});
 const score = rankSet(oneArm,30,8,80).score;
 expect(stats.overall.score).toBe(score);
 expect(stats.exercises.find(lift => lift.name === twoArm)).toMatchObject({active:false,rank:null,best:150,sets:1});
 expect(bodyRegions(stats).find(group => group.id === 'midback').exercises.map(lift => lift.name)).toEqual([oneArm]);
 expect(sharedRankSnapshot(stats).exercises.map(lift => lift.name)).toEqual([oneArm]);
 expect(strengthStats(logs, weights, workouts, '2026-01-03', {0:'Old'}).overall.score).toBe(rankSet(twoArm,150,8,80).score);
 expect(strengthStats(logs, weights, workouts, '2026-01-03', {}).overall).toBeNull();
});

it('keeps same-name legacy side settings and rep sets out of incompatible current setups', () => {
 const name = 'Plate-Loaded Row';
 const set = w => ({w, r:8, done:true});
 const logs = {'2026-01-02':[{exercises:[
   {name,sets:[set(40)]},
   {name,unilateral:true,sets:[set(90),set(85)]},
 ]}]};
 const inSplit = exercise => strengthStats(logs, weights, {Pull:[{name,...exercise}]}, '2026-01-03', {0:'Pull'});
 expect(inSplit({}).exercises[0].bestSet).toMatchObject({w:40});
 expect(inSplit({unilateral:true}).exercises[0].bestSet).toMatchObject({w:85,paired:true});
 expect(inSplit({target:'30 s'})).toMatchObject({overall:null,ranked:0,sets:3});
});

it('counts old one-arm back records under the matching current variation', () => {
 const set = w => ({w, r:8, done:true});
 const row = {name:'Single-Arm Plate-Loaded Row'};
 const pulldown = {name:'Single-Arm Lat Pulldown',attachment:'handle'};
 const workouts = {Pull:[row,pulldown]};
 const logs = {'2026-01-02':[{exercises:[
   {name:'Plate-Loaded Row',sets:[set(150)]},
   {name:'Plate-Loaded Row',unilateral:true,sets:[set(30),set(35)]},
   {name:row.name,sets:[set(25),set(25)]},
   {name:'Lat Pulldown',unilateral:true,attachment:'handle',sets:[set(25),set(20)]},
   {name:'Lat Pulldown',unilateral:true,attachment:'rope',sets:[set(75),set(70)]},
 ]}]};
 const original = structuredClone(logs);
 const stats = strengthStats(logs, weights, workouts, '2026-01-03', {0:'Pull'});
 const find = name => stats.exercises.filter(lift => lift.name === name);
 expect(find(row.name)).toHaveLength(1);
 expect(find(row.name)[0].bestSet).toMatchObject({w:30,paired:true});
 expect(find('Plate-Loaded Row')[0]).toMatchObject({active:false,best:150,rank:null});
 expect(find(pulldown.name).find(lift => lift.attachment === 'rope').rank).toBeNull();
 expect(find(pulldown.name).find(lift => lift.attachment === 'handle').bestSet).toMatchObject({w:20,paired:true});
 expect(bodyRegions(stats).filter(region => region.rank).map(region => region.id)).toEqual(['traps','midback','lats']);
 expect(sharedRankSnapshot(stats).exercises.map(lift => lift.name).sort()).toEqual([pulldown.name,row.name]);
 expect(logs).toEqual(original);
});

it('ranks high-rep one-arm pulldowns, preserving the weaker side’s actual reps', () => {
 const name = 'Single-Arm Plate-Loaded Pulldown';
 const sets = [{w:40,r:15,done:true},{w:30,r:16,done:true}];
 const stats = strengthStats({'2026-01-02':[{exercises:[{name,sets}]}]}, weights,
   {Pull:[{name}]}, '2026-01-04', {0:'Pull'});
 const lift = stats.exercises[0];
 expect(lift.rank.score).toBe(rankSet(name,30,12,80).score);
 expect(lift.bestSet).toMatchObject({w:30,r:16,paired:true});
 expect(bodyRegions(stats).find(region => region.id === 'lats').rank.score).toBe(lift.rank.score);
 expect(sharedRankStats(sharedRankSnapshot(stats)).exercises[0].bestSet.r).toBe(16);
});

it('gives every setup in the split a Training rank while counting each active day once', () => {
 const hang = {name:'Dead Hang',target:'30 s'};
 const pulldown = {name:'Single-Arm Plate-Loaded Pulldown',target:'8'};
 const squat = {name:'Back Squat',target:'8'};
 const curl = {name:'Cable Curl',target:'8'};
 const completed = (exercise, r) => ({...exercise,sets:[{w:0,r,done:true}]});
 const logs = {
   '2026-01-01':[{exercises:[completed(hang,31),completed(pulldown,8),completed(curl,8)]},
     {exercises:[completed(hang,35)]}],
   '2026-01-02':[{exercises:[completed(hang,33),{...squat,warmups:[{w:100,r:8,done:true}]}]}],
 };
 const stats = strengthStats(logs, [], {Pull:[hang,pulldown,squat], Old:[curl]}, '2026-01-05', {0:'Pull'});
 const lifts = Object.fromEntries(stats.exercises.map(lift => [lift.name,lift]));
 expect(lifts[hang.name]).toMatchObject({trainingDays:2,trainingRank:{name:'Iron 4',lp:8},bestSeconds:35});
 expect(lifts[pulldown.name].trainingRank).toMatchObject({name:'Iron 4',lp:4});
 expect(lifts[squat.name]).toMatchObject({sets:0,trainingRank:{name:'Iron 4',lp:0}});
 expect(lifts[curl.name].trainingRank).toBeUndefined();
 expect(stats.overall).toBeNull();
 expect(bodyRegions(stats).find(region => region.id === 'lats')).toMatchObject({training:true,rank:{name:'Iron 4'}});
 expect(bodyRegions(stats).find(region => region.id === 'quads').rank).toBeNull();
});

it('uses the same fixed targets for machines, free weights and bodyweight lifts', () => {
  for (const [name, weight] of [['Hip Abduction',75],['Hip Abduction Machine',75],['Cable Hip Abduction',50],['Barbell Bench Press',80],['Pull-up',0]]) {
    const expected = rankSet(name, weight, 8, 80);
    for (const bodyweight of [undefined, 55, 115]) {
      expect(rankSet(name, weight, 8, bodyweight)).toEqual(expected);
    }
  }
  const name = 'Single-Arm Plate-Loaded Pulldown';
  const set = w => ({w,r:8,done:true});
  const logs = {'2026-01-02':[{exercises:[{name,sets:[set(45),set(40)]}]}]};
  for (const weighIns of [[], weights, [{date:'2026-01-03',weight:100}]]) {
    const stats = strengthStats(logs, weighIns, {Pull:[{name}]}, '2026-01-04', {0:'Pull'});
    expect(stats.exercises[0]).toMatchObject({rank:{name:'Gold 1',lp:20}, bestSet:{w:40,r:8,paired:true}});
    expect(stats.exercises[0].estimatedRank).toBeUndefined();
    expect(sharedRankSnapshot(stats).exercises[0].fixedReferenceKg).toBe(80);
  }
});

it('normalizes each one-sided round without joining it to another round', () => {
 const name = 'Single-Arm Plate-Loaded Pulldown';
 const blank = {w:'',r:'',done:false};
 const set = w => ({w,r:8,done:true});
 const logs = {'2026-01-02':[{exercises:[{name,sets:[set(40),blank,blank,set(35)]}]}]};
 const stats = strengthStats(logs, weights, {Pull:[{name}]}, '2026-01-04', {0:'Pull'});
 const {estimatedRank, estimatedBestSet} = stats.exercises[0];
 expect(estimatedRank.score).toBe(rankSet('Plate-Loaded Pulldown',80,8,80).score);
 expect(stats.exercises[0]).toMatchObject({pairedSets:0,unpairedSets:2,rankSession:[
   {round:1,w:40,side:'left',singleSide:true},{round:2,w:35,side:'right',singleSide:true},
 ]});
 expect(estimatedBestSet).toMatchObject({w:40,singleSide:true,side:'left'});
 expect(stats.overall).toBeNull();
});

it('evaluates the second working set and uses a one-arm estimate only when the latest session is incomplete', () => {
 const one = 'Single-Arm Plate-Loaded Pulldown', both = 'Plate-Loaded Pulldown';
 const done = w => ({w,r:10,done:true});
 const exercise = (name,sets) => ({name,sets,warmups:[done(160),done(160)]});
 const paired = exercise(one,[done(20),done(22),done(45),done(40)]);
 const bilateral = exercise(both,[done(40),done(80)]);
 const partial = exercise(one,[done(50)]);
 for (const sessions of [[partial,paired,bilateral],[paired,bilateral,partial]]) {
   const latestIsPartial = sessions.at(-1) === partial;
   const stats = strengthStats({'2026-01-02':sessions.map(e => ({exercises:[e]}))},weights);
   const lift = stats.exercises.find(e => e.name === one);
   expect(lift.rank).toMatchObject({score:400,name:'Platinum 4'});
   expect(lift.rank.score).toBe(stats.exercises.find(e => e.name === both).rank.score);
   expect(lift.bestSet).toMatchObject({round:2,w:40,paired:true});
   expect(lift.confirmedRankSession.map(e=>e.score)).toEqual([200,400]);
   expect(lift.estimatedRank?.score).toBe(latestIsPartial ? 500 : undefined);
   expect(lift.rankSession.map(e => e.score)).toEqual(latestIsPartial ? [500] : [200,400]);
   expect(bodyRegions(stats).find(r => r.id === 'lats')).toMatchObject({estimated:latestIsPartial,rank:{score:latestIsPartial ? 500 : 400},confirmedRank:{score:400}});
   expect(sharedRankSnapshot(stats).exercises.find(e => e.name === one).score).toBe(400);
   expect(stats.overall.score).toBe(400);
 }
});

it('matches older explicit one-leg set rows to their reviewed split variation', () => {
 const one = 'Single-Leg Extension', name = 'Leg Extension', set = {w:20,r:8,done:true};
 const logs = {'2026-01-02':[{exercises:[{name,sets:[{...set,w:100}]},{name,sides:'both',sets:[set,set]}]}]};
 const stats = strengthStats(logs,weights,{Legs:[{name:one}]},'2026-01-04',{0:'Legs'});
 expect(stats.exercises.find(e=>e.name===one)).toMatchObject({rank:{score:rankSet(one,20,8,80).score},bestSet:{paired:true}});
 expect(stats.exercises.find(e=>e.name===name).active).toBe(false);
});

it('ranks the latest completed session per setup and keeps the earlier personal best', () => {
  const name = 'Barbell Bench Press';
  const date = '2026-01-03';
  const session = (time, loads) => ({time, exercises:[{name,sets:loads.map(w=>({w,r:8,done:true}))}]});
  const logs = {
    '2026-01-02':[session('2026-01-02T17:00:00Z',[100])],
    [date]:[
      session(date+'T17:00:00Z',[50,60]),
      {...session(date+'T19:00:00Z',[90]), performedAt: date+'T08:00:00Z'},
    ],
  };
  const before = structuredClone(logs);
  const stats = strengthStats(logs, weights, {Push:[{name}]}, date, {0:'Push'});
  const latest = rankSet(name,60,8,80).score;
  expect(stats.exercises[0]).toMatchObject({best:100,rank:{score:latest},bestSet:{w:60,r:8,date,round:2}});
  expect(stats.exercises[0].max).toBeCloseTo(126.667, 2);
  expect(stats.overall.score).toBe(latest);
  expect(stats.history.map(point => point.w)).toEqual([rankSet(name,100,8,80).score,latest]);
  expect(sharedRankSnapshot(stats).exercises[0]).toMatchObject({score:latest,w:60,date});
  expect(logs).toEqual(before);
});
