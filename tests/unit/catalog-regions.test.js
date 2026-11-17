import {it,expect} from 'vitest';
import {CATALOG,GROUP_FILTERS,searchCatalog,catalogueRegionLabels,categoryLabel} from '../../js/domain/catalog.js';
import {BODY_REGION_GROUPS,liftBodyRegions,bodyRegions} from '../../js/domain/body-regions.js';
import {rankModel} from '../../js/domain/rank-models.js';
import {MUSCLES} from '../../js/domain/ranks.js';
it('uses the same regional names and catalogue classification as the ranked bodygraph',()=>{
 expect(new Set(BODY_REGION_GROUPS.map(([,name])=>name))).toEqual(new Set(bodyRegions({muscles:MUSCLES,exercises:[]}).map(m=>m.name)));
 const names=new Map(BODY_REGION_GROUPS);
 for(const entry of CATALOG){
  const expected=liftBodyRegions({name:entry.name,muscle:rankModel(entry.name).muscle}).map(id=>names.get(id)||categoryLabel(id));
  expect(catalogueRegionLabels(entry),entry.name).toEqual(expected);
 }
 expect(GROUP_FILTERS).toContain('Obliques');expect(GROUP_FILTERS).not.toContain('Arms');
});
it('splits pulling/core/hip filters while preserving deliberate shared contributions',()=>{
 const has=(group,name)=>searchCatalog(name,group).some(e=>e.name===name);
 expect(has('Lats','Plate-Loaded Pulldown')).toBe(true);
 expect(has('Mid-back','Plate-Loaded Pulldown')).toBe(false);
 expect(has('Traps','Plate-Loaded Row')).toBe(true);
 expect(has('Mid-back','Plate-Loaded Row')).toBe(true);
 expect(has('Abs','Abdominal Crunch Machine')).toBe(true);
 expect(has('Obliques','Abdominal Crunch Machine')).toBe(true);
 expect(has('Adductors','Hip Adduction')).toBe(true);
 expect(has('Abductors','Hip Abduction')).toBe(true);
 expect(has('Glutes','Hip Abduction')).toBe(false);
 expect(has('Glutes','Hip Adduction')).toBe(false);
 expect(searchCatalog('mid back').length).toBeGreaterThan(0);
});
