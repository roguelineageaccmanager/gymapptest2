import {it,expect} from 'vitest';
import {CATALOG} from '../../js/domain/catalog.js';
import {exerciseId} from '../../js/domain/exercises.js';
import {MOVEMENTS,movementFor,searchMovements,changeMovement,equipmentOptions} from '../../js/domain/movement-groups.js';
import {attachmentFor,attachmentOptions} from '../../js/domain/attachments.js';
import {sanitizeWorkout,mergePlans} from '../../js/domain/plan.js';
import {sanitizeLogs,mergeLogs} from '../../js/domain/logs.js';
import {rankModel} from '../../js/domain/rank-models.js';

it('represents every original identity once without merging rank/history identities',()=>{
 const ids=MOVEMENTS.flatMap(m=>m.variants.map(e=>exerciseId(e.name)));
 expect(new Set(ids).size).toBe(1045);expect(ids.length).toBe(1045);
 expect(MOVEMENTS.length).toBeLessThan(700);
 for(const entry of CATALOG)expect(movementFor(entry.name).variants.some(v=>exerciseId(v.name)===exerciseId(entry.name)),entry.name).toBe(true);
 expect(movementFor('Single-Arm Plate-Loaded Low Row')).toBe(movementFor('Seated Cable Row'));
 expect(rankModel('Plate-Loaded Low Row')).not.toBe(rankModel('Seated Cable Row'));
 expect(movementFor('Triceps Pushdown')).not.toBe(movementFor('Cable Overhead Triceps Extension'));
});
it('collapses equipment duplicates while preserving filtered searches and exact matches',()=>{
 for(const query of ['lateral raise','pulldown','preacher curl']){
  const results=searchMovements(query);
  expect(new Set(results.map(x=>x.movement.id)).size).toBe(results.length);
 }
 expect(searchMovements('Single-Arm Cable Lateral Raises')[0].name).toBe('Single-Arm Cable Lateral Raises');
 expect(searchMovements('plate loaded pulldown','Back','cable')).toHaveLength(0);
 expect(equipmentOptions(movementFor('Cable Lateral Raise'))).toEqual(expect.arrayContaining(['cable','dumbbell','machine','plate-loaded machine']));
});
it('switches equipment explicitly and preserves per-side counts, notes, warm-ups and raw input',()=>{
 const old={name:'Single-Arm Cable Lateral Raises',cat:'shoulders',unilateral:true,sets:4,warmupSets:2,target:'8',rest:75,note:'Seat 3',attachment:'cuff'};
 const history=structuredClone(old);
 const switched=changeMovement(old,'Dumbbell Lateral Raise',[old]);
 expect(switched.exercise).toMatchObject({name:'Dumbbell Lateral Raise',sets:2,warmupSets:1,target:'8',rest:75,note:'Seat 3',unilateral:false});
 expect(switched.exercise.attachment).toBeUndefined();expect(old).toEqual(history);
 expect(changeMovement(old,old.name,[old]).error).toBeUndefined();
 expect(changeMovement(old,'Dumbbell Lateral Raise',[old,{name:'Dumbbell Lateral Raise'}]).error).toMatch(/already/);
 expect(changeMovement(old,'Barbell Bench Press',[old]).error).toMatch(/not available/);
});
it('offers only compatible attachments, sanitizes them and uses explicit none to clear',()=>{
 expect(attachmentOptions('Single-Arm Cable Lateral Raises')).toContain('cuff');
 expect(attachmentOptions('Single-Leg Cable Kickback')).toContain('ankle');
 expect(attachmentOptions('Barbell Bench Press')).toEqual([]);
 expect(attachmentOptions('Rope Triceps Pushdown')).not.toContain('bar');
 expect(attachmentFor('Cable Lateral Raise','<script>')).toBeUndefined();
 expect(sanitizeWorkout([{name:'Cable Lateral Raise',sets:2,attachment:'cuff'}])[0].attachment).toBe('cuff');
 expect(sanitizeWorkout([{name:'Barbell Bench Press',attachment:'cuff'}])[0].attachment).toBeUndefined();
 const prior={workouts:{Push:[{name:'Cable Lateral Raise',sets:2,attachment:'cuff'}]}};
 const oldClient={workouts:{Push:[{name:'Cable Lateral Raise',sets:3}]}};
 expect(mergePlans(prior,oldClient).workouts.Push[0].attachment).toBe('cuff');
 expect(mergePlans(prior,{workouts:{Push:[{name:'Cable Lateral Raise',sets:3,attachment:'none'}]}}).workouts.Push[0].attachment).toBe('none');
});
it('retains setup in logged sets and older-client merges without altering sets or legacy logs',()=>{
 const e={name:'Single-Arm Cable Lateral Raises',attachment:'cuff',unilateral:true,target:'8',sets:[{w:'10',r:'8',done:true},{w:'10',r:'8',done:true}],warmups:[]};
 const logs={'2026-11-17':[{id:'session',day:'Push',time:'2026-11-17T06:00:00Z',exercises:[e]}]};
 const cleaned=sanitizeLogs(logs);expect(cleaned['2026-11-17'][0].exercises[0]).toEqual(e);
 const older=structuredClone(logs);delete older['2026-11-17'][0].exercises[0].attachment;
 const original=structuredClone(older);
 expect(mergeLogs(logs,older)['2026-11-17'][0].exercises[0].attachment).toBe('cuff');
 expect(sanitizeLogs(older)['2026-11-17'][0].exercises[0]).not.toHaveProperty('attachment');
 expect(older).toEqual(original);
});

it('offers reviewed cuff placements and cable attachments without duplicating exercises',()=>{
 const count=MOVEMENTS.length;
 for(const name of ['Single-Arm Cable Lateral Raises','Single-Arm Cable Rear Delt Fly','Single-Arm Cable Fly']){
  for(const cuff of ['cuff','forearmcuff','upperarmcuff'])expect(attachmentOptions(name),name).toContain(cuff);
 }
 expect(attachmentOptions('Single-Arm Cable Curl')).toContain('cuff');
 expect(attachmentOptions('Single-Arm Tricep Pushdowns')).not.toContain('upperarmcuff');
 expect(attachmentOptions('Rope Overhead Cable Triceps Extension')).toEqual(['none','rope','shortrope','longrope']);
 for(const attachment of ['latbar','neutralhandle','widehandle'])expect(attachmentOptions('Lat Pulldown')).toContain(attachment);
 expect(attachmentOptions('Plate-Loaded Pulldown')).toEqual(['none','liftingstraps']);
 expect(attachmentOptions('Cable Hip Abduction')).toEqual(['none','ankle']);
 expect(attachmentOptions('Cable Wrist Extension')).toEqual(['none','handle','bar','ezbar']);
 expect(attachmentOptions('Cable Wrist Flexion')).toEqual(['none','handle','bar','ezbar']);
 for(const entry of CATALOG.filter(e=>e.equipment==='cable')) {
  expect(attachmentOptions(entry.name).length,entry.name).toBeGreaterThan(1);
 }
 expect(sanitizeWorkout([{name:'Single-Arm Cable Lateral Raises',attachment:'upperarmcuff',sets:4,unilateral:true}])[0].attachment).toBe('upperarmcuff');
 expect(MOVEMENTS.length).toBe(count);
});
