import {exerciseId,exerciseDisplayName,matchesExerciseName} from '../domain/exercises.js';
import {exerciseFamily,sideLabel,variantAlreadyIn} from '../domain/exercise-families.js';
import {equipmentOptions,equipmentLabel,movementVersions,searchMovements,hasExplicitEquipment,movementFor,pickerMovement} from '../domain/movement-groups.js';
import {defaultTarget,isTimedCardioExercise} from '../domain/measurement.js';
import {DEFAULT_REST,DEFAULT_SETS,REST_DEFAULTS} from '../domain/plan.js';
import {CATALOG} from '../domain/catalog.js';
import {html,render} from '../core/dom.js';
import {chooseOption} from './choice.js';
import {openSheet} from './sheet.js';

export function defaultExerciseSetup(entry) {
  const {name, cat, unilateral} = entry;
  return {
    name, cat, sets: unilateral ? DEFAULT_SETS * 2 : DEFAULT_SETS,
    target: defaultTarget(name), rest: isTimedCardioExercise(name) ? 0 : REST_DEFAULTS[name] ?? REST_DEFAULTS[exerciseFamily(name)?.name] ?? DEFAULT_REST,
    note: '', ...(unilateral ? {unilateral: true, sides: 'both'} : {}),
  };
}

// Keep historical identities addressable while removing a confusing setup
// from the list of exercises that can be added to new sessions or routines.
export const canAddExercise = (entry) => !(entry.equipment === 'smith machine' && movementFor(entry.name)?.id === 'leg press');

export function addableMovements(query, group, equipment) {
  return searchMovements(query, group, equipment, canAddExercise);
}

export function recentExerciseEntries(lastUsed) {
  const entries = new Map(CATALOG.map(entry => [exerciseId(entry.name), entry]));
  return Object.entries(lastUsed).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
    .map(([name]) => entries.get(exerciseId(name))).filter(entry => entry && canAddExercise(entry)).slice(0, 5);
}

export function pickWorkoutExercise(exercises, lastUsed) {
  const allowed = entry => canAddExercise(entry) && !variantAlreadyIn(exercises, entry);
  const button = (entry, label, description, exact = false) => html`<button type="button" class="row row-btn" data-quick-pick="${entry.name}"${exact ? html` data-quick-exact` : ''}>
    <span class="row-main"><b>${label}</b><small>${description}</small></span></button>`;
  const options = query => {
    const recent = query.trim() ? [] : recentExerciseEntries(lastUsed).filter(allowed);
    const results = addableMovements(query).filter(item => matchesExerciseName(item.name,query) ? allowed(item) : item.movement.variants.some(allowed)).slice(0, 30);
    return html`${recent.length ? html`<p class="muted small">Recent</p>${recent.map(entry => button(entry, exerciseDisplayName(entry.name), equipmentLabel(entry.equipment), true))}` : ''}
      ${results.length ? results.map(entry => matchesExerciseName(entry.name,query)
        ? button(entry, exerciseDisplayName(entry.name), equipmentLabel(entry.equipment))
        : button(entry, entry.displayName, equipmentOptions(entry.movement).map(value=>equipmentLabel(value,entry.movement)).join(' / '))) : html`<p class="muted">No matching exercises.</p>`}`;
  };
  return openSheet({
    title: 'Add exercise', className: 'quick-exercise-sheet', settleHistory: true,
    body: html`<label class="field"><span>Search exercises</span><input class="input" type="search" autocomplete="off"></label><div class="list" data-quick-results>${options('')}</div>`,
    onMount(sheet, close) {
      const search = sheet.querySelector('input'), results = sheet.querySelector('[data-quick-results]');
      search.addEventListener('input', () => render(results, options(search.value)));
      results.addEventListener('click', async event => {
        const trigger = event.target.closest('[data-quick-pick]');
        if (!trigger) return;
        const entry = CATALOG.find(item => item.name === trigger.dataset.quickPick);
        if (trigger.hasAttribute('data-quick-exact')) { close(entry); return; }
        const movement = pickerMovement(entry.name, search.value);
        const exact = matchesExerciseName(entry.name, search.value);
        const choice = await chooseMovementVersion(trigger, movement, entry, !exact && !hasExplicitEquipment(search.value, entry), undefined, allowed);
        if (choice && trigger.isConnected) close(choice);
      });
    },
  });
}

// Only existing, compatible catalogue setups are offered; no synthesized lifts.
export async function chooseMovementVersion(trigger,movement,preferred,chooseEquipment,filter='All equipment',allowed=()=>true,chooseVersion=chooseEquipment){
 if(!movement||!preferred)return null;
 movement={...movement,variants:movement.variants.filter(allowed)};
 if(!movement.variants.length)return null;
 if(movement.id==='t bar row'&&movement.variants.length===1)return movement.variants[0];
 if(movement.variants.length===1&&isTimedCardioExercise(movement.variants[0].name))return movement.variants[0];
 let equip=filter!=='All equipment'?filter:preferred.equipment;
 if (chooseEquipment) {
  const options = equipmentOptions(movement);
  equip = options.length === 1 ? options[0] : await chooseOption({
    trigger, title: 'Equipment', selected: equip,
    options: options.map(value => ({ value, label: equipmentLabel(value, movement) })),
  });
  if (!equip || !trigger.isConnected) return null;
 }
 let versions=movementVersions(movement,equip);
 if(!versions.length)return null;
 let entry=versions.find(v=>v.name===preferred.name||exerciseFamily(v.name)?.members.includes(exerciseId(preferred.name)))||versions[0];
 if(chooseVersion&&versions.length>1){
  const name=await chooseOption({trigger,title:'Exercise version',subtitle:movement.name,selected:entry.name,options:versions.map(v=>({value:v.name,label:exerciseFamily(v.name)?.name||exerciseDisplayName(v.name)}))});
  if(!name||!trigger.isConnected)return null;
  entry=versions.find(v=>v.name===name);
 }
 const knownFamily=exerciseFamily(entry.name),family=knownFamily?{...knownFamily,variants:knownFamily.variants.filter(allowed)}:null;
 if(knownFamily?.variants.length>1){
  const selected=await chooseOption({trigger,title:family.name,subtitle:equipmentLabel(entry.equipment),selected:family.variants.find(v=>v.name===preferred.name)?.name||entry.name,options:family.variants.map(v=>({value:v.name,label:sideLabel(v,family),description:v.unilateral&&v.equipment==='plate-loaded machine'?(family.limb==='leg'?'Machine must support single-leg use':'Independent arms required'):''}))});
  if(!selected)return null;
  entry=family.variants.find(v=>v.name===selected);
 }else if(family?.variants.length===1)entry=family.variants[0];
 return entry;
}

