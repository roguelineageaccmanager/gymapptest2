// Share qualifying ranks and their calculation inputs, never full workout logs.
import {MUSCLES,rankFromScore,movement,rankSetupKey,rankAttachment} from './ranks.js';
export function sharedRankSnapshot(stats){
 const snapshot = {version:1,calculated_at:new Date().toISOString(),overall:stats.overall?.score??null,exercises:stats.exercises.filter(e=>e.rank&&e.bestSet).slice(0,2000).map(e=>{
  const r=e.rank,s=e.bestSet,model=movement(e.name);
  return {name:e.name,...(e.attachment?{attachment:e.attachment}:{}),calibration:r.calibration,muscle:e.muscle,score:r.score,reference:r.reference,mode:r.mode,unit:r.unit,multiplier:r.multiplier,
   w:s.w,r:s.r,date:s.date,paired:!!s.paired,
   max:r.max, fixedReferenceKg:r.fixedReferenceKg,
   ...(r.standardBodyLoadKg ? {standardBodyLoadKg:r.standardBodyLoadKg} : {}),
   ...(r.mode==='bodyweight'?{factor:model.factor}:{} )};
 })};
 // Leave room for PostgreSQL JSON formatting under the existing 1 MiB limit.
 const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
 let remainingDetailBytes = 800000 - size(snapshot);
 const bySetup = new Map(stats.exercises.map(e => [rankSetupKey(e),e]));
 for (const entry of snapshot.exercises) {
   const lift = bySetup.get(rankSetupKey(entry));
   const detail = {best:lift.best, rounds:lift.sets - (lift.pairedSets || 0),
     scoringRound:lift.bestSet.round, session:(lift.confirmedRankSession || []).map(({round,w,r,paired,singleSide,side}) => ({round,w,r,paired,singleSide,side})),
     points:lift.points.slice(-60).map(({date,w,singleSide}) => ({date,w,singleSide}))};
   const bytes = size(detail) + 12;
   if (bytes <= remainingDetailBytes) { entry.detail = detail; remainingDetailBytes -= bytes; }
 }
 return snapshot;
}
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export function sharedRankStats(payload){
 if(!payload||payload.version!==1||!Array.isArray(payload.exercises))return null;
 const groups=new Map(),seen=new Set();
 const exercises=[];
 for(const e of payload.exercises.slice(0,2000)){
  if(!e||typeof e.name!=='string'||!e.name.trim()||e.name.length>80||!MUSCLES.some(m=>m.id===e.muscle)||!Number.isInteger(e.score)||!finite(e.score,0,999)||!finite(e.w,0,100000)||!Number.isSafeInteger(e.r)||e.r<1||!finite(e.reference,.01,100)||![1,2].includes(e.multiplier)||!['load','bodyweight'].includes(e.mode)||!['kg total','kg per dumbbell','kg per kettlebell','kg per side'].includes(e.unit)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date||''))continue;
  const attachment=rankAttachment(e),key=rankSetupKey(e);if(seen.has(key))continue;seen.add(key);
  const rank={...rankFromScore(e.score),calibration:e.calibration==='observed-relative'?'observed-relative':'estimated',reference:e.reference,...(finite(e.fixedReferenceKg,.01,10000) ? {fixedReferenceKg:e.fixedReferenceKg} : {}),
   ...(e.mode==='bodyweight' && finite(e.standardBodyLoadKg,.01,10000) ? {standardBodyLoadKg:e.standardBodyLoadKg} : {}),mode:e.mode,unit:e.unit,multiplier:e.multiplier,...(finite(e.max,0,1000000)?{max:e.max}:{})};
  const bestSet={w:e.w,r:e.r,date:e.date,paired:e.paired===true,...(finite(e.bodyweight,20,350)?{bodyweight:e.bodyweight}:{})};
  const lift={name:e.name,attachment,muscle:e.muscle,rank,bestSet,active:true,sets:0,points:[],timedPoints:[]};
  const d = e.detail;
  if (d && finite(d.best,0,100000) && Number.isSafeInteger(d.rounds) && d.rounds > 0 &&
      Array.isArray(d.session) && d.session.length && d.session.length <= 2000 && Array.isArray(d.points)) {
    const session = d.session.filter(set => set && Number.isSafeInteger(set.round) && set.round > 0 &&
      finite(set.w,0,100000) && Number.isSafeInteger(set.r) && set.r > 0).map(set => ({
        round:set.round,w:set.w,r:set.r,paired:set.paired === true,singleSide:set.singleSide === true,
        side:set.side === 'right' ? 'right' : 'left'
      }));
    if (session.some(set => set.round === d.scoringRound && set.w === e.w && set.r === e.r)) {
      lift.bestSet.round = d.scoringRound;
      lift.rankSession = session;
      lift.best = d.best;
      lift.sets = d.rounds;
      lift.points = d.points.slice(-60).filter(p => p && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && finite(p.w,0,1000000))
        .map(p => ({date:p.date,w:p.w,singleSide:p.singleSide === true}));
    }
  }
  exercises.push(lift);
  if(!groups.has(e.muscle)||rank.score>groups.get(e.muscle).score)groups.set(e.muscle,rank);
 }
 const muscles=MUSCLES.map(m=>({...m,rank:groups.get(m.id)||null,exercises:exercises.filter(e=>e.muscle===m.id)}));
 const overall=groups.size?rankFromScore(Math.round([...groups.values()].reduce((n,r)=>n+r.score,0)/groups.size)):null;
 return {exercises,muscles,overall,ranked:exercises.length};
}
