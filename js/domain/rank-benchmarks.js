// Relative difficulty anchors checked 2026-11-17. See docs/RANK_CALIBRATION.md.
// Small factual observations, not a copied standards dataset or percentiles.
import {exerciseId} from './exercises.js';
const observations=[
 ['bench-press',1.25,.75,1,['Barbell Bench Press']],
 ['dumbbell-bench-press',.5,.3,2,['Flat Dumbbell Bench Press','Dumbbell Bench Press']],
 ['incline-bench-press',1,.65,1,['Incline Barbell Press']],
 ['incline-dumbbell-bench-press',.5,.3,2,['Incline Dumbbell Press']],
 ['smith-machine-bench-press',1.25,.7,1,['Smith Machine Bench Press']],
 ['shoulder-press',.8,.5,1,['Overhead Press']],
 ['dumbbell-shoulder-press',.4,.25,2,['Dumbbell Shoulder Press']],
 ['dumbbell-lateral-raise',.2,.15,2,['Dumbbell Lateral Raise']],
 ['lat-pulldown',1,.75,1,['Lat Pulldown']],
];
export const RANK_BENCHMARKS=new Map(observations.flatMap(([slug,male,female,loads,names])=>names.map(name=>[exerciseId(name),{
 reference:Math.round(((male*loads/1.25+female*loads/.75)/2)*100)/100,
 source:'https://strengthlevel.com/strength-standards/'+slug,
}])));
