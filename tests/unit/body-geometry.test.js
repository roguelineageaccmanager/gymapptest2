import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BODY_GEOMETRY, BACK_ANCHORS } from '../../js/ui/body-geometry.js';
const before = JSON.parse(readFileSync('tests/unit/body-calves-before.json','utf8'));
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area = p => p.reduce((sum,a,i) => { const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1]; },0)/2;
const points = (s,side) => {
 const a=s.split(/\s+/).map(Number);
 return Array.from({length:a.length/2},(_,i)=>{
  const x=a[2*i],y=a[2*i+1];if(side==='front')return[x,y];
  const end=Math.max(1,BACK_ANCHORS.findIndex(p=>p[0]>=y)),lo=BACK_ANCHORS[end-1],hi=BACK_ANCHORS[end];
  return[x,lo[1]+(y-lo[0])*(hi[1]-lo[1])/(hi[0]-lo[0])];
 });
};
function triangles(poly) {
 const p=area(poly)>0?[...poly]:[...poly].reverse(),out=[];
 for(let loop=0;p.length>3&&loop<500;loop++){
  const i=p.findIndex((b,i)=>{const a=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length];return cross(a,b,c)>1e-8&&!p.some(v=>v!==a&&v!==b&&v!==c&&cross(a,b,v)>=-1e-8&&cross(b,c,v)>=-1e-8&&cross(c,a,v)>=-1e-8);});
  if(i<0)throw Error('Invalid muscle polygon');
  out.push([p[(i+p.length-1)%p.length],p[i],p[(i+1)%p.length]]);p.splice(i,1);
 }
 if(p.length===3)out.push(p);return out;
}
function intersection(a,b) {
 let out=a;
 for(let i=0;i<3&&out.length;i++){
  const start=b[i],end=b[(i+1)%3],input=out;out=[];
  for(let j=0;j<input.length;j++){
   const p=input[j],q=input[(j+1)%input.length],d=cross(start,end,p),e=cross(start,end,q);
   if(d>=-1e-8)out.push(p);
   if((d>=-1e-8)!==(e>=-1e-8)){const t=d/(d-e);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
  }
 }
 return out.length>2?Math.abs(area(out)):0;
}
describe('bodygraph boundaries',()=>{
 it('retains the original split calves and naturally shaped quads',()=>{
  for(const side of ['front','back'])expect(BODY_GEOMETRY[side].find(p=>p.muscle==='calves').points).toEqual(before[side]);
  const quads=BODY_GEOMETRY.front.find(p=>p.muscle==='quadriceps').points;
  expect(quads).toHaveLength(6);
  expect(Math.max(...quads.flatMap(s=>s.split(/\s+/).map(Number).filter((_,i)=>i%2)))).toBeGreaterThan(1460);
 });
 it('does not overlap adjacent muscles in either rendered view',()=>{
  for(const side of ['front','back']){
   const regions=BODY_GEOMETRY[side].filter(p=>p.muscle!=='head').flatMap(p=>p.points.map(s=>({name:p.muscle,triangles:triangles(points(s,side))})));
   for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){
    const a=regions[i],b=regions[j];if(a.name===b.name)continue;
    const overlap=a.triangles.reduce((n,t)=>n+b.triangles.reduce((m,u)=>m+intersection(t,u),0),0);
    expect(overlap,`${side}: ${a.name} / ${b.name}`).toBeLessThan(.001);
   }
  }
 });
});
