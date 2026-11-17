// Reproducible policy audit for every offline catalogue identity.
import { writeFileSync } from 'node:fs';
import { CATALOG } from '../js/domain/catalog.js';
import { rankModel } from '../js/domain/rank-models.js';
import { exerciseId } from '../js/domain/exercises.js';
const rows = new Map(CATALOG.map(entry => [exerciseId(entry.name), {entry,model:rankModel(entry.name)}]));
const counts = {};
const csv = [['exercise','muscle','mode','reference','load multiplier','input unit','paired sides','rule or reason','calibration','source']];
for (const {entry,model:m} of rows.values()) {
  const reason=m.reason || m.rule;counts[reason]=(counts[reason]||0)+1;
  csv.push([entry.name,m.muscle,m.mode,m.reference ?? '',m.multiplier,m.unit,m.unilateral,reason,m.calibration||'unrated',m.source||'']);
}
writeFileSync('docs/RANK_MODELS.csv',csv.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
console.log(JSON.stringify({identities:rows.size,ranked:[...rows.values()].filter(x=>x.model.reference).length,policies:counts},null,2));
