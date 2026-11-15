import { it, expect } from 'vitest';
import { CATALOG } from '../../js/domain/catalog.js';
import { RANK_MODELS, rankModel } from '../../js/domain/rank-models.js';
import { rankSet, strengthStats } from '../../js/domain/ranks.js';
import { EXERCISE_FAMILIES, searchExerciseFamilies } from '../../js/domain/exercise-families.js';
import { bodyRegions } from '../../js/domain/body-regions.js';

it('assigns every catalogue identity an explicit load convention or exclusion reason', () => {
  expect(RANK_MODELS.size).toBe(1033);
  for (const entry of CATALOG) {
    const m = rankModel(entry.name);
    if (m.mode === 'unrated') { expect(m.reason,entry.name).toBeTruthy(); expect(m.reference).toBeNull(); }
    else { expect(m.reference,entry.name).toBeGreaterThan(0); expect([1,2]).toContain(m.multiplier); expect(m.rule).toBeTruthy(); expect(m.unit).toMatch(/^kg/); }
  }
  expect(rankModel('not a known movement').reason).toBe('unknown-movement');
});
it('uses equivalent total resistance for every reviewed one/both-side pair', () => {
  for (const family of EXERCISE_FAMILIES.filter(f => f.variants.length === 2)) {
    const [both,one] = family.variants, a=rankModel(both.name), b=rankModel(one.name);
    if (a.mode === 'unrated' || b.mode === 'unrated') continue;
    expect(a.reference, family.name).toBe(b.reference);
    expect(rankSet(one.name,30,8,80).score, family.name).toBe(rankSet(both.name,30*b.multiplier/a.multiplier,8,80).score);
  }
  expect(rankSet('Single-Arm Plate-Loaded Pulldown',30,8,80).score).toBe(rankSet('Plate-Loaded Pulldown',60,8,80).score);
  expect(rankSet('Single-Arm Dumbbell Lateral Raise',15,8,80).score).toBe(rankSet('Dumbbell Lateral Raise',15,8,80).score);
  expect(rankModel('Goblet Squat').multiplier).toBe(1);
  expect(rankModel('Dumbbell Overhead Triceps Extension').multiplier).toBe(1);
});
const rows=(w,r=8,done=true)=>({w:String(w),r:String(r),done});
const statsFor=(sets,name='Single-Arm Plate-Loaded Pulldown')=>strengthStats({'2026-01-02':[{exercises:[{name,target:'8',sets,warmups:[rows(999,1)]}]}]},[{date:'2026-01-01',weight:80}]);
it('ranks completed L/R working pairs using the weaker side and keeps raw history intact', () => {
  const sets=[rows(30),rows(30)], before=structuredClone(sets);
  const one=statsFor(sets), both=statsFor([rows(60)],'Plate-Loaded Pulldown');
  expect(one.exercises[0].rank.score).toBe(both.exercises[0].rank.score);
  expect(one.exercises[0].max).toBe(both.exercises[0].max);
  expect(one.volume).toBe(both.volume);
  expect(one.sets).toBe(2); expect(one.exercises[0].bestSet.paired).toBe(true);
  expect(sets).toEqual(before);
  expect(statsFor([rows(50),rows(20)]).exercises[0].rank.score).toBe(rankSet('Plate-Loaded Pulldown',40,8,80).score);
  expect(statsFor([rows(30)]).overall).toBeNull();
  expect(statsFor([rows(30),rows(30,8,false)]).overall).toBeNull();
  expect(statsFor([rows(200,8,false),rows(200),rows(20),rows(20)]).exercises[0].rank.score).toBe(rankSet('Plate-Loaded Pulldown',40,8,80).score);
});
it('shares row/crunch regional contributions without duplicating overall score or inactive lifts', () => {
  const stats={overall:{score:300},muscles:[{id:'back',name:'Back'},{id:'abs',name:'Abs'}],exercises:[
    {name:'Plate-Loaded Row',muscle:'back',active:true,rank:{score:310}},
    {name:'Abdominal Crunch Machine',muscle:'abs',active:true,rank:{score:280}},
    {name:'Shrug',muscle:'back',active:false,rank:{score:900}},
  ]}, before=structuredClone(stats), regions=bodyRegions(stats);
  for (const id of ['midback','traps']) expect(regions.find(r=>r.id===id).rank.score).toBe(310);
  for (const id of ['abs','obliques']) expect(regions.find(r=>r.id===id).rank.score).toBe(280);
  expect(stats).toEqual(before);
});
it('keeps side-specific searches but removes side prefixes from movement result labels', () => {
  for (const term of ['single arm','one arm','single leg']) {
    const results=searchExerciseFamilies(term);
    expect(results.length).toBeGreaterThan(0);
    for (const item of results.filter(x=>x.unilateral)) expect(item.displayName).not.toMatch(/\b(?:single|one)[ -](?:arm|leg)/i);
  }
});

it('retains unilateral row positions and execution metadata through save/sync cleaning',async()=>{
  const {loggedWorkingSets,sanitizeLogs,mergeLogs}=await import('../../js/domain/logs.js');
  const empty={w:'',r:'',done:false}, source=[empty,rows(50),rows(20),rows(20),empty,empty];
  const saved=loggedWorkingSets(source,true);
  expect(saved).toHaveLength(4);expect(saved[0]).toEqual(empty);expect(saved[1].w).toBe('50');
  const logs={'2026-01-02':[{id:'pair',day:'Pull',exercises:[{name:'Plate-Loaded Pulldown',unilateral:true,target:'8',sets:saved}]}]};
  const cleaned=sanitizeLogs(logs),merged=mergeLogs(cleaned,{});
  expect(merged['2026-01-02'][0].exercises[0]).toMatchObject({unilateral:true,sets:saved});
  expect(strengthStats(merged,[{date:'2026-01-01',weight:80}]).overall.score).toBe(rankSet('Plate-Loaded Pulldown',40,8,80).score);
  expect(loggedWorkingSets([empty,empty],true)).toEqual([]);
});

it('keeps custom lift ranks tied to explicit routine settings',()=>{
 const workouts={Custom:[{name:'My chest machine',cat:'chest',unilateral:true}]};
 expect(rankSet('My chest machine',30,8,80,workouts).score).toBe(rankSet('Barbell Bench Press',60,8,80).score);
 expect(rankSet('My chest machine',30,8,80)).toBeNull();
});
