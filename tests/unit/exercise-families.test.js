import { describe, it, expect } from 'vitest';
import { CATALOG } from '../../js/domain/catalog.js';
import { EXERCISE_FAMILIES, exerciseFamily, searchExerciseFamilies, changeExerciseVariant, variantAlreadyIn } from '../../js/domain/exercise-families.js';
import { bodyRegions } from '../../js/domain/body-regions.js';
import { BODY_GEOMETRY } from '../../js/ui/body-geometry.js';
import { exerciseId, sameExercise } from '../../js/domain/exercises.js';

describe('movement families and explicit versions',()=>{
 it('validates reviewed families without merging exercise identities or equipment',()=>{
  const members=EXERCISE_FAMILIES.flatMap(f=>f.members);
  expect(new Set(members).size).toBe(members.length);
  for(const f of EXERCISE_FAMILIES){expect(f.variants.every(Boolean)).toBe(true);expect(new Set(f.variants.map(v=>v.equipment)).size).toBe(1);}
  expect(sameExercise('Plate-Loaded Pulldown','Single-Arm Plate-Loaded Pulldown')).toBe(false);
  expect(exerciseFamily('Barbell Bench Press')).toBeUndefined();
 });
 it('shows one selectable movement for side duplicates while preserving all source entries',()=>{
  expect(searchExerciseFamilies('cable lateral raise').filter(x=>x.family?.name==='Cable Lateral Raise')).toHaveLength(1);
  expect(searchExerciseFamilies('single arm cable lateral raise')).toHaveLength(1);
  expect(searchExerciseFamilies('plate loaded pulldown','Back','plate-loaded machine')).toHaveLength(1);
  expect(searchExerciseFamilies('plate loaded pulldown','Back','cable')).toHaveLength(0);
  expect(exerciseFamily('Plate-Loaded Row')).not.toBe(exerciseFamily('Plate-Loaded Low Row'));
  expect(exerciseFamily('Plate-Loaded Pulldown')).not.toBe(exerciseFamily('Lat Pulldown'));
  expect(new Set(CATALOG.map(x=>exerciseId(x.name))).size).toBe(1043);
 });
 it('preserves per-side working/warm-up counts, targets, notes and input data on live changes',()=>{
  const old={name:'Plate-Loaded Pulldown',cat:'back',sets:3,warmupSets:2,target:'8–12',rest:135,note:'Seat 3'};
  const list=[old],before=JSON.stringify(list);
  const one=changeExerciseVariant(old,'Single-Arm Plate-Loaded Pulldown',list).exercise;
  expect(one).toMatchObject({...old,name:'Single-Arm Plate-Loaded Pulldown',sets:6,warmupSets:4,unilateral:true});
  expect(JSON.stringify(list)).toBe(before);
  const both=changeExerciseVariant(one,'Plate-Loaded Pulldown',[one]).exercise;
  expect(both).toMatchObject(old);expect(both.unilateral).toBe(false);
 });
 it('refuses duplicate destinations, unrelated moves and destructive set clamping',()=>{
  const old={name:'Cable Curl',cat:'biceps',sets:2,warmupSets:1};
  expect(changeExerciseVariant(old,'Single-Arm Cable Curl',[old,{name:'Single-Arm Cable Curl'}]).error).toBeTruthy();
  expect(changeExerciseVariant(old,'Barbell Curl',[old]).error).toBeTruthy();
  expect(changeExerciseVariant({...old,warmupSets:12},'Single-Arm Cable Curl',[old]).error).toBeTruthy();
  expect(variantAlreadyIn([{name:'Single-Arm Machine Chest Press'}],exerciseFamily('Chest Press Machine').variants[1])).toBe(true);
 });
 it('adds no mismatched demonstration images for reviewed machine execution versions',()=>{
  const variants=CATALOG.filter(x=>x.modeVariantOf);expect(variants).toHaveLength(19);
  expect(variants.every(x=>x.unilateral&&x.images.length===0)).toBe(true);
 });
});
describe('bodygraph drill-downs',()=>{
 it('separates back regions and groups core exercises without changing overall scores',()=>{
  const rows=[['back','Shrug','traps',420],['back','Barbell Row','midback',350],['back','Lat Pulldown','lats',310],['abs','Cable Crunch','abs',300],['abs','Dumbbell Side Bend','abs',300]];
  const stats={overall:{score:333},muscles:[{id:'back',name:'Back'},{id:'abs',name:'Abs'}],exercises:rows.map(([muscle,name,,score])=>({muscle,name,active:true,rank:{score}}))};
  const before=JSON.stringify(stats),regions=bodyRegions(stats);
  for(const [,,id,score]of rows)expect(regions.find(x=>x.id===id).rank.score).toBe(score);
  expect(JSON.stringify(stats)).toBe(before);
  stats.exercises[0].active=false;expect(bodyRegions(stats).find(x=>x.id==='traps').rank.score).toBe(350);
 });
 it('uses six visual ab sections and separate flank/back geometry',()=>{
  expect(BODY_GEOMETRY.front.find(x=>x.muscle==='abs').points).toHaveLength(6);
  expect(BODY_GEOMETRY.front.some(x=>x.muscle==='serratus')).toBe(false);
  expect(BODY_GEOMETRY.front.find(x=>x.muscle==='brachialis').points).toHaveLength(2);
  expect(BODY_GEOMETRY.front.find(x=>x.muscle==='quadriceps').points).toHaveLength(6);
  for (const side of ['front','back']) { expect(BODY_GEOMETRY[side].find(x=>x.muscle==='brachioradialis').points).toHaveLength(2); expect(BODY_GEOMETRY[side].find(x=>x.muscle==='forearm').points).toHaveLength(2); }
  expect(BODY_GEOMETRY.back.some(x=>x.muscle==='mid-back')).toBe(true);
  for(const parts of Object.values(BODY_GEOMETRY))for(const part of parts)for(const points of part.points){const n=points.split(/\s+/).map(Number);expect(n.length%2).toBe(0);expect(n.every(Number.isFinite)).toBe(true);}
 });
});
