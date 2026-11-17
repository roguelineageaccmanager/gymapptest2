import {exerciseId} from '../domain/exercises.js';
import {exerciseFamily,sideLabel} from '../domain/exercise-families.js';
import {equipmentOptions,equipmentLabel,movementVersions} from '../domain/movement-groups.js';
import {chooseOption} from './choice.js';

// Only existing, compatible catalogue setups are offered; no synthesized lifts.
export async function chooseMovementVersion(trigger,movement,preferred,chooseEquipment,filter='All equipment',allowed=()=>true){
 if(!movement||!preferred)return null;
 movement={...movement,variants:movement.variants.filter(allowed)};
 if(!movement.variants.length)return null;
 let equip=filter!=='All equipment'?filter:preferred.equipment;
 if(chooseEquipment){
  equip=await chooseOption({trigger,title:'Equipment',selected:equip,options:equipmentOptions(movement).map(value=>({value,label:equipmentLabel(value)}))});
  if(!equip||!trigger.isConnected)return null;
 }
 let versions=movementVersions(movement,equip);
 if(!versions.length)return null;
 let entry=versions.find(v=>v.name===preferred.name||exerciseFamily(v.name)?.members.includes(exerciseId(preferred.name)))||versions[0];
 if(chooseEquipment&&versions.length>1){
  const name=await chooseOption({trigger,title:'Exercise version',subtitle:movement.name,selected:entry.name,options:versions.map(v=>({value:v.name,label:exerciseFamily(v.name)?.name||v.name}))});
  if(!name||!trigger.isConnected)return null;
  entry=versions.find(v=>v.name===name);
 }
 const knownFamily=exerciseFamily(entry.name),family=knownFamily?{...knownFamily,variants:knownFamily.variants.filter(allowed)}:null;
 if(knownFamily?.variants.length>1){
  const selected=await chooseOption({trigger,title:family.name,selected:family.variants.find(v=>v.name===preferred.name)?.name||entry.name,options:family.variants.map(v=>({value:v.name,label:sideLabel(v,family),description:v.unilateral&&v.equipment==='plate-loaded machine'?'Independent arms required':''}))});
  if(!selected)return null;
  entry=family.variants.find(v=>v.name===selected);
 }else if(family?.variants.length===1)entry=family.variants[0];
 return entry;
}

