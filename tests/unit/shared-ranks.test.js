import{it,expect}from'vitest';
import{strengthStats,rankSet}from'../../js/domain/ranks.js';
import{sharedRankSnapshot,sharedRankStats}from'../../js/domain/shared-ranks.js';
import{bodyRegions}from'../../js/domain/body-regions.js';
const logs={'2026-01-02':[{exercises:[{name:'Single-Arm Plate-Loaded Row',target:'8',unilateral:true,sets:[{w:'30',r:'8',done:true},{w:'25',r:'8',done:true}],warmups:[{w:'999',r:'1',done:true}]},{name:'Abdominal Crunch Machine',target:'8',sets:[{w:'40',r:'8',done:true}]},{name:'Pull-up',target:'8',sets:[{w:'10',r:'8',done:true}]}]}]};
const weights=[{date:'2026-01-01',weight:80}];
it('shares the exact qualifying ranks and regional body graph without logs or private body weight',()=>{
 const stats=strengthStats(logs,weights),snapshot=sharedRankSnapshot(stats),back=sharedRankStats(snapshot);
 expect(back.exercises).toHaveLength(3);expect(back.overall.score).toBe(stats.overall.score);
 expect(bodyRegions(back).map(m=>[m.id,m.rank?.score])).toEqual(bodyRegions(stats).map(m=>[m.id,m.rank?.score]));
 const row=snapshot.exercises.find(e=>e.name==='Single-Arm Plate-Loaded Row');
 expect(row).toMatchObject({w:25,r:8,paired:true,score:rankSet('Single-Arm Plate-Loaded Row',25,8,80).score});
 expect(JSON.stringify(snapshot)).not.toContain('warmups');
 for(const e of snapshot.exercises)expect(e).not.toHaveProperty('bodyweight');
 expect(snapshot.exercises.find(e=>e.name==='Pull-up')).not.toHaveProperty('max');
 expect(sharedRankSnapshot(stats,true).exercises.find(e=>e.name==='Pull-up')).toMatchObject({bodyweight:80,max:stats.exercises.find(e=>e.name==='Pull-up').rank.max});
});
it('omits hidden/inactive, incomplete-side and timed ranks rather than inventing calculations',()=>{
 const stats=strengthStats(logs,weights,{},'2026-01-02',{},['Abdominal Crunch Machine']);
 expect(sharedRankSnapshot(stats).exercises).toEqual([]);
 const partial=strengthStats({'2026-01-02':[{exercises:[{name:'Single-Arm Plate-Loaded Row',unilateral:true,sets:[{w:'30',r:'8',done:true}]}]}]},weights);
 expect(sharedRankSnapshot(partial).exercises).toEqual([]);
});
it('bounds untrusted shared payloads and derives overall and muscle scores from valid exercises',()=>{
 expect(sharedRankStats({version:99,exercises:[]})).toBeNull();
 const snapshot=sharedRankSnapshot(strengthStats(logs,weights));
 const good=snapshot.exercises[0];
 snapshot.overall=999;snapshot.exercises.push({...good},{...good,name:'invalid',score:NaN},{...good,name:'bad muscle',muscle:'madeup'},{...good,name:'bad unit',unit:'<script>'});
 const result=sharedRankStats(snapshot);
 expect(result.exercises).toHaveLength(3);expect(result.overall.score).toBe(strengthStats(logs,weights).overall.score);
});
