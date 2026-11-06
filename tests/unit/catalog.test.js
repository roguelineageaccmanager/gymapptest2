import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CATALOG, CATEGORIES, searchCatalog } from '../../js/domain/catalog.js';
import { exerciseId, sameExercise } from '../../js/domain/exercises.js';
import { DEFAULT_SETS, sanitizeExercise } from '../../js/domain/plan.js';

const before = JSON.parse(readFileSync('tests/unit/catalog-before.json', 'utf8'));
const required = ['single-arm cable lateral raise', 'single-arm cable rear delt fly', 'Smith Machine Shoulder Press', 'Smith Machine Incline Bench Press', 'Chest Press Machine', 'Plate-Loaded Row', 'Plate-Loaded Low Row', 'Plate-Loaded Pulldown', 'Seated Lumbar Extension Machine', '45° back extension', 'Preacher Curl', 'Supinating Dumbbell Curl', 'reverse cable biceps curl', 'single-arm cable triceps extension', 'Rope Overhead Cable Triceps Extension', 'Cable Wrist Flexion', 'Cable Wrist Extension', 'JM Press', 'Leg Press', 'Seated Leg Curl', 'Leg Extension', 'hip abduction machine', 'hip adduction machine', 'Standing Calf Raise', 'leg-press calf raise', 'Abdominal Crunch Machine'];

describe('expanded exercise catalogue', () => {
  it('retains every historical name, identity, muscle and unilateral default', () => {
    for (const old of before) {
      const current = CATALOG.find(x => x.name === old.name);
      expect(current).toMatchObject(old);
      expect(exerciseId(current.name)).toBe(exerciseId(old.name));
    }
    const oldIds = new Set(before.map(x => exerciseId(x.name)));
    expect(searchCatalog('').filter(x => !oldIds.has(exerciseId(x.name)))).toHaveLength(97);
  });
  it('finds every requested movement with instructions and valid muscle metadata', () => {
    for (const query of required) {
      const found = searchCatalog(query);
      expect(found.length, query).toBeGreaterThan(0);
      expect(found.some(x => x.instructions.length > 0), query).toBe(true);
    }
    for (const x of CATALOG) {
      expect(CATEGORIES[x.cat], x.name).toBeTruthy();
      for (const cat of [...x.primaryMuscles, ...x.secondaryMuscles]) expect(CATEGORIES[cat], x.name).toBeTruthy();
      expect(x.name).not.toMatch(/technogym/i);
    }
  });
  it('keeps lever rows, cable rows, pulldowns and triceps arm positions distinct', () => {
    const names = ['Plate-Loaded Row', 'Plate-Loaded Low Row', 'Plate-Loaded Pulldown', 'Seated Cable Row', 'Lat Pulldown', 'Single-Arm Tricep Pushdowns', 'Single-Arm Overhead Cable Extension', 'Rope Overhead Cable Triceps Extension'];
    expect(new Set(names.map(exerciseId)).size).toBe(names.length);
    expect(searchCatalog('row', 'Back', 'plate-loaded machine').map(x => x.name)).toEqual(['Plate-Loaded Row', 'Plate-Loaded Low Row']);
    expect(searchCatalog('row', 'Back', 'cable').some(x => x.name === 'Seated Cable Row')).toBe(true);
    expect(searchCatalog('row', 'Chest', 'cable')).toHaveLength(0);
  });
  it('uses search aliases without changing identity or working/warm-up set storage', () => {
    expect(sameExercise('Cable Wrist Flexion', 'Wrist Curl')).toBe(false);
    expect(searchCatalog('cable wrist curl').some(x => x.name === 'Cable Wrist Flexion')).toBe(true);
    expect(DEFAULT_SETS).toBe(2);
    for (const x of CATALOG) {
      const ex = { name: x.name, cat: x.cat, sets: x.unilateral ? DEFAULT_SETS * 2 : DEFAULT_SETS, ...(x.unilateral ? { unilateral: true, sides: 'both' } : {}), warmupSets: x.unilateral ? 2 : 1 };
      const copy = sanitizeExercise(ex);
      expect(copy.sets).toBe(x.unilateral ? 4 : 2);
      expect(copy.warmupSets).toBe(ex.warmupSets);
    }
  });
  it('only links pinned source images, with placeholders for unmatched variants', () => {
    for (const x of CATALOG) for (const image of x.images) expect(image).toMatch(/^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5\/exercises\/[^/]+\/[01]\.jpg$/);
    for (const name of ['Plate-Loaded Low Row', 'Plate-Loaded Pulldown', 'Supinating Dumbbell Curl', 'Seated Lumbar Extension Machine', 'Cable Wrist Extension']) expect(searchCatalog(name).find(x => x.name === name).images).toEqual([]);
  });
});
