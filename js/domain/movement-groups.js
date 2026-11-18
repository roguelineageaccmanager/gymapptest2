// Reviewed picker groups, never identity/rank aliases. Different angles, grips,
// assistance and machine types remain concrete selectable versions underneath.
import { CATALOG, searchCatalog } from './catalog.js';
import { exerciseId } from './exercises.js';
import { exerciseFamily, changeExerciseVariant, variantAlreadyIn } from './exercise-families.js';
import { attachmentFor } from './attachments.js';

const definitions = [
 ['Lateral raise',['Dumbbell Lateral Raise','Cable Lateral Raise','Machine Lateral Raise','Plate-Loaded Lateral Raise','Lean-Away Lateral Raise','Cable Seated Lateral Raise','Seated Side Lateral Raise','Lateral Raise - With Bands']],
 ['Rear delt fly',['Rear Delt Fly','Cable Rear Delt Fly','Reverse Pec Deck','Plate-Loaded Rear Delt Fly','Bent-Over Rear Delt Raise','Reverse Flyes','Dumbbell Lying Rear Lateral Raise','Lying Rear Delt Raise','Seated Dumbbell Rear Delt Raise','Band Reverse Fly']],
 ['Front raise',['Cable Front Raise','Dumbbell Front Raise','Plate Front Raise','Front Two-Dumbbell Raise','Single Dumbbell Raise']],
 ['Shoulder press',['Overhead Press','Dumbbell Shoulder Press','Seated Dumbbell Shoulder Press','Machine Shoulder Press','Smith Machine Shoulder Press','Seated Barbell Press','Cable Shoulder Press','Seated Cable Shoulder Press','Standing Dumbbell Shoulder Press','Two-Arm Kettlebell Military Press','Kettlebell Seated Press','Plate-Loaded Shoulder Press','Standing Palms-In Dumbbell Press','Shoulder Press - With Bands']],
 ['Arnold press',['Arnold Press','Kettlebell Arnold Press']],
 ['Upright row',['Upright Row','Dumbbell Upright Row','Upright Cable Row','Smith Machine Upright Row','Upright Row - With Bands']],
 ['Face pull',['Face Pull','Cable Face Pull']],
 ['Chest press',['Barbell Bench Press','Flat Dumbbell Bench Press','Chest Press Machine','Smith Machine Bench Press','Plate-Loaded Chest Press','Cable Chest Press','Standing Cable Chest Press','Dumbbell Bench Press with Neutral Grip','Wide-Grip Barbell Bench Press','Bench Press - With Bands']],
 ['Incline chest press',['Incline Barbell Press','Incline Dumbbell Press','Smith Machine Incline Bench Press','Machine Incline Chest Press','Plate-Loaded Incline Chest Press','Incline Cable Chest Press','Neutral-Grip Incline Dumbbell Bench Press']],
 ['Decline chest press',['Decline Barbell Bench Press','Decline Dumbbell Press','Smith Machine Decline Press','Machine Decline Chest Press','Plate-Loaded Decline Chest Press','Wide-Grip Decline Barbell Bench Press']],
 ['Floor press',['Dumbbell Floor Press','Alternating Floor Press','Barbell Floor Press','One Arm Floor Press','One-Arm Kettlebell Floor Press','Leg-Over Floor Press','Extended Range One-Arm Kettlebell Floor Press','Floor Press with Chains']],
 ['Chest fly',['Cable Fly','Dumbbell Fly','Pec Deck','Cable Crossover','Flat Bench Cable Flyes','Low-to-High Cable Fly','High-to-Low Cable Fly','Low Cable Crossover','Incline Dumbbell Fly','Incline Dumbbell Flyes','Incline Cable Flye','Decline Dumbbell Fly','Bodyweight Flyes']],
 ['Push-up',['Push-up','Deficit Push-up','Incline Push-up','Decline Push-up','Diamond Push-up','Wide Push-up','Weighted Push-up','Close-Grip Push-up','Suspended Push-Up']],
 ['Dip',['Dips','Triceps Dip','Parallel Bar Dip','Assisted Dip','Assisted Triceps Dip','Ring Dip','Bench Dip','Weighted Bench Dip','Seated Triceps Dip Machine','Plate-Loaded Triceps Dip']],
 ['Pulldown',['Lat Pulldown','Close-grip Lat Pulldown','Wide-Grip Lat Pulldown','Neutral-Grip Lat Pulldown','Underhand Lat Pulldown','Plate-Loaded Pulldown','V-Bar Pulldown','Close-Grip Front Lat Pulldown','Single-Arm Kneeling Lat Pulldown','Wide-Grip Pulldown Behind The Neck']],
 ['Straight-arm pulldown',['Straight-arm Pulldown','Rope Straight-Arm Pulldown']],
 ['Pull-up',['Pull-up','Weighted Pull-Up','Assisted Pull-Up','Assisted Pull-Ups','Wide-Grip Pull-Up','Neutral-Grip Pull-Up','Band Assisted Pull-Up']],
 ['Chin-up',['Chin-up','Mixed Grip Chin','One Arm Chin-Up','Gironda Sternum Chins']],
 ['Row',['Barbell Row','Single-Arm Dumbbell Row','Seated Cable Row','Single-Arm Seated Cable Row','Single-Arm Machine Row','Chest-supported Row','T-Bar Row','Pendlay Row','Seal Row','Meadows Row','Machine High Row','Plate-Loaded Row','Plate-Loaded Low Row','Iso-Lateral Row Machine','Single-Arm Landmine Row','Bent Over Two-Dumbbell Row','Bent Over Two-Dumbbell Row With Palms In','Dumbbell Incline Bench Row','Lying T-Bar Row','Smith Machine Bent Over Row','Two-Arm Kettlebell Row','One-Arm Kettlebell Row','Alternating Kettlebell Row','Kneeling High Pulley Row','Shotgun Row','Reverse Grip Bent-Over Rows']],
 ['Inverted row',['Inverted Row','TRX Row','Suspension Row','Suspension Inverted Row','Bodyweight Mid Row']],
 ['Shrug',['Shrug','Dumbbell Shrug','Cable Shrug','Single-Arm Shrug','Barbell Shrug Behind The Back','Smith Machine Behind the Back Shrug','Leverage Shrug']],
 ['Pullover',['Dumbbell Pullover','Cable Pullover','Plate-Loaded Pullover','Bent-Arm Dumbbell Pullover','Straight-Arm Dumbbell Pullover','Bent-Arm Barbell Pullover']],
 ['Biceps curl',['Dumbbell Curl','Barbell Curl','EZ-Bar Curl','Cable Curl','Machine Biceps Curl','Supinating Dumbbell Curl','Seated Dumbbell Curl','Close-Grip EZ Bar Curl','Close-Grip Standing Barbell Curl','Wide-Grip Standing Barbell Curl','Standing Inner-Biceps Curl']],
 ['Hammer curl',['Hammer Curl','Rope Hammer Curl','Cross Body Hammer Curl','Incline Hammer Curls']],
 ['Preacher curl',['Preacher Curl','Single-Arm Preacher Curl','Cable Preacher Curl','Machine Preacher Curls','Two-Arm Dumbbell Preacher Curl','Plate-Loaded Preacher Curl','Preacher Hammer Dumbbell Curl']],
 ['Incline curl',['Incline Dumbbell Curl','Incline Inner Biceps Curl','Flexor Incline Dumbbell Curls']],
 ['Concentration curl',['Concentration Curl','Single-Arm Concentration Curl','Standing Concentration Curl','Seated Close-Grip Concentration Barbell Curl']],
 ['Spider curl',['Spider Curl','Incline Bench Spider Curl','Standing Dumbbell Curl Over Incline Bench']],
 ['Reverse curl',['Reverse Curl','Reverse Cable Bicep Curls','Barbell Reverse Curl','Standing Dumbbell Reverse Curl','Reverse Plate Curls']],
 ['Triceps pushdown',['Triceps Pushdown','Rope Triceps Pushdown','Straight-Bar Triceps Pushdown','V-Bar Triceps Pushdown','Reverse-Grip Triceps Pushdown']],
 ['Overhead triceps extension',['Overhead Triceps Extension','Cable Overhead Triceps Extension','Rope Overhead Cable Triceps Extension','Dumbbell Overhead Triceps Extension','Kettlebell Overhead Triceps Extension','Standing Overhead Barbell Triceps Extension','Seated Triceps Press']],
 ['Lying triceps extension',['Skull Crusher','EZ-Bar Skull Crusher','Dumbbell Skull Crusher','Cable Lying Triceps Extension','Lying Triceps Press','Band Skull Crusher']],
 ['Triceps kickback',['Triceps Kickback','Single-Arm Cable Kickback','Seated Bent-Over Two-Arm Dumbbell Triceps Extension','Standing Bent-Over Two-Arm Dumbbell Triceps Extension']],
 ['Squat',['Barbell Back Squat','Back Squat','High-Bar Back Squat','Low-Bar Back Squat','Front Squat','Goblet Squat','Smith Machine Squat','Dumbbell Squat','Bodyweight Squat','Safety Bar Squat','Zercher Squat','Landmine Squat','Belt Squat','Plate-Loaded Belt Squat','Front Squats With Two Kettlebells','Plie Dumbbell Squat','Box Squat','Pause Squat','Overhead Squat']],
 ['Hack squat',['Hack Squat','Smith Machine Hack Squat','Barbell Hack Squat','Plate-Loaded Hack Squat','Narrow Stance Hack Squats']],
 ['Pendulum squat',['Pendulum Squat','Plate-Loaded Pendulum Squat']],
 ['Leg press',['Leg Press','Plate-Loaded Leg Press','Narrow-Stance Leg Press','Wide-Stance Leg Press','Smith Machine Leg Press']],
 ['Leg extension',['Leg Extension','Plate-Loaded Leg Extension']],
 ['Split squat',['Bulgarian Split Squat','Front-Foot Elevated Split Squat','Rear-Foot Elevated Split Squat','Split Squat with Dumbbells','Smith Single-Leg Split Squat','Suspended Split Squat']],
 ['Lunge',['Walking Lunge','Barbell Walking Lunge','Barbell Lunge','Dumbbell Lunges','Reverse Lunge','Dumbbell Reverse Lunge','Lateral Lunge','Curtsy Lunge']],
 ['Step-up',['Step-up','Barbell Step-Up','Dumbbell Step Ups','Single-Leg Box Step-Up','Step-up with Knee Raise']],
 ['Deadlift',['Conventional Deadlift','Sumo Deadlift','Trap-Bar Deadlift','Snatch-Grip Deadlift','Deficit Deadlift','Rack Pull','Frame Deadlift','Leverage Deadlift']],
 ['Romanian deadlift',['Romanian Deadlift','Dumbbell Romanian Deadlift','Single-Leg Romanian Deadlift','Single-Leg Dumbbell RDL','Single-Leg Cable RDL','Romanian Deadlift from Deficit','Kettlebell One-Legged Deadlift']],
 ['Stiff-leg deadlift',['Stiff-Leg Deadlift','Dumbbell Stiff-Leg Deadlift','Smith Machine Stiff-Legged Deadlift','Wide Stance Stiff Legs']],
 ['Good morning',['Good Morning','Barbell Good Morning','Seated Good Morning','Band Good Morning','Good Morning off Pins']],
 ['Leg curl',['Leg Curl','Seated Leg Curl','Lying Leg Curl','Standing Leg Curl','Plate-Loaded Seated Leg Curl','Plate-Loaded Lying Leg Curl','Ball Leg Curl','Seated Band Hamstring Curl']],
 ['Hip thrust',['Hip Thrust','Single-Leg Hip Thrust','Hip Thrust Machine','Plate-Loaded Hip Thrust']],
 ['Glute bridge',['Glute Bridge','Barbell Glute Bridge','Physioball Hip Bridge']],
 ['Hip abduction',['Hip Abduction','Cable Hip Abduction','Clamshell']],
 ['Hip adduction',['Hip Adduction','Cable Hip Adduction','Band Hip Adductions']],
 ['Glute kickback',['Cable Glute Kickback','Single-Leg Cable Kickback','Glute Kickback','Hip Extension with Bands']],
 ['Standing calf raise',['Standing Calf Raise','Single-Leg Calf Raise','Standing Dumbbell Calf Raise','Standing Barbell Calf Raise','Smith Machine Calf Raise','Plate-Loaded Standing Calf Raise','Calf Raises - With Bands']],
 ['Seated calf raise',['Seated Calf Raise','Barbell Seated Calf Raise','Dumbbell Seated One-Leg Calf Raise','Plate-Loaded Seated Calf Raise']],
 ['Calf press',['Leg Press Calf Raise','Calf Press Machine']],
 ['Crunch',['Cable Crunch','Rope Crunch','Standing Cable Rope Crunch','Cable Seated Crunch','Machine Crunch','Abdominal Crunch Machine','Plate-Loaded Abdominal Crunch','Weighted Crunch','Crunches','Decline Crunch','Exercise Ball Crunch']],
 ['Back extension',['Back Extension','45-Degree Back Extension','Seated Lumbar Extension Machine','Hyperextensions (Back Extensions)','Weighted Ball Hyperextension']],
 ['Wrist flexion',['Wrist Curl','Cable Wrist Flexion','Seated Dumbbell Palms-Up Wrist Curl','Seated Palm-Up Barbell Wrist Curl','Seated Two-Arm Palms-Up Low-Pulley Wrist Curl','Palms-Up Dumbbell Wrist Curl Over A Bench','Palms-Up Barbell Wrist Curl Over A Bench']],
 ['Wrist extension',['Reverse Wrist Curl','Cable Wrist Extension','Seated Dumbbell Palms-Down Wrist Curl','Seated Palms-Down Barbell Wrist Curl','Palms-Down Dumbbell Wrist Curl Over A Bench','Palms-Down Wrist Curl Over A Bench']],
 ['Wood chop',['Wood Chop','Cable Wood Chop','Standing Cable Wood Chop']],
 ['Farmer carry',['Farmer Carry','Suitcase Carry','Frame Carry']],
];
const entries=new Map(CATALOG.map(e=>[exerciseId(e.name),e]));
const indexed=new Map();
export const MOVEMENTS=[];
for(const [name,names] of definitions){
 const members=new Set(names.flatMap(n=>exerciseFamily(n)?.members||[exerciseId(n)]));
 const variants=[...members].map(id=>entries.get(id)).filter(Boolean);
 const movement={id:exerciseId(name),name,variants};
 MOVEMENTS.push(movement);
 for(const e of variants){
  if(indexed.has(exerciseId(e.name))) throw new Error('Exercise in two movement groups: '+e.name);
  indexed.set(exerciseId(e.name),movement);
 }
}
// Remaining specialist movements stay searchable. Side families still collapse.
for(const e of CATALOG){
 if(indexed.has(exerciseId(e.name))) continue;
 const family=exerciseFamily(e.name);
 const variants=family ? family.members.map(id=>entries.get(id)).filter(Boolean) : [e];
 const movement={id:family?.id||exerciseId(e.name),name:family?.name||e.name,variants};
 MOVEMENTS.push(movement);
 for(const v of variants)indexed.set(exerciseId(v.name),movement);
}
export const movementFor=name=>indexed.get(exerciseId(name));
export const equipmentLabel=value=>({'body only':'Bodyweight','plate-loaded machine':'Plate-loaded machine','smith machine':'Smith machine',kettlebells:'Kettlebell',dumbbell:'Dumbbell',barbell:'Barbell',cable:'Cable',machine:'Machine',bands:'Resistance band',other:'Other equipment'}[value]||value);
export const equipmentOptions=movement=>[...new Set(movement.variants.map(e=>e.equipment))];
export function movementVersions(movement,equipment){
 const seen=new Set();
 return movement.variants.filter(e=>!equipment||e.equipment===equipment).filter(e=>{
  const id=exerciseFamily(e.name)?.id||exerciseId(e.name);
  if(seen.has(id))return false;
  seen.add(id);return true;
 });
}
export function searchMovements(query,group,equipment,allowed=null){
 const seen=new Set();
 // Prefer an exact identity/alias before broader token matches.
 const found=searchCatalog(query,group,equipment).filter(e=>!allowed||allowed(e)).sort((a,b)=>Number(exerciseId(b.name)===exerciseId(query))-Number(exerciseId(a.name)===exerciseId(query)));
 return found.flatMap(e=>{
  const group=movementFor(e.name);
  const movement=allowed?{...group,variants:group.variants.filter(allowed)}:group;
  if(seen.has(movement.id))return [];
  seen.add(movement.id);
  const smith=/\bsmith\b/.test(exerciseId(query))||equipment==='smith machine';
  const setupName=exerciseFamily(e.name)?.name||e.name;
  return [{...e,movement,displayName:smith?setupName.replace(/^Smith (?!Machine)/,'Smith Machine '):movement.name}];
 });
}
export function changeMovement(exercise,name,routine){
 const movement=movementFor(exercise.name), next=movement?.variants.find(e=>exerciseId(e.name)===exerciseId(name));
 if(!next)return {error:'That equipment or version is not available.'};
 if(variantAlreadyIn(routine,next,exercise))return {error:'That version is already in this workout.'};
 // Reuse side count/warm-up bounds without changing the identity grouping API.
 const seed={...exercise,name:next.name};
 const family=exerciseFamily(next.name);
 const result=family ? changeExerciseVariant(seed,next.name,routine.filter(e=>e!==exercise)) : {exercise:{...seed,cat:next.cat,unilateral:!!next.unilateral,
  sets:(exercise.unilateral ? Math.max(1,Math.round(exercise.sets/2)) : exercise.sets)*(next.unilateral?2:1),
  ...(exercise.warmupSets!==undefined?{warmupSets:(exercise.unilateral?Math.round(exercise.warmupSets/2):exercise.warmupSets)*(next.unilateral?2:1)}:{}),sides:next.unilateral?'both':undefined}};
 if(result.exercise){
  if(result.exercise.sets>40 || result.exercise.warmupSets>12)return {error:'Reduce the set count before switching versions.'};
  const attachment=attachmentFor(result.exercise.name,exercise.attachment);
  if(attachment!==undefined)result.exercise.attachment=attachment;else delete result.exercise.attachment;
 }
 return result;
}

export function hasExplicitEquipment(query,entry){
 const token=entry.equipment==='plate-loaded machine'?'plate loaded':entry.equipment==='kettlebells'?'kettlebell':entry.equipment;
 return exerciseId(query).includes(token);
}
