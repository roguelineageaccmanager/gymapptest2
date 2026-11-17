import {it,expect} from 'vitest';
import {rankSet,strengthStats,movement,rankSetupKey} from '../../js/domain/ranks.js';
import {sharedRankSnapshot,sharedRankStats} from '../../js/domain/shared-ranks.js';
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
