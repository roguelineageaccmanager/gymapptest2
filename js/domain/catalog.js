import { PLATE_SIDE_BASES, LEG_SIDE_BASES, SIDE_VARIANTS } from './side-variants.js';
import { BODY_REGION_GROUPS, liftBodyRegions } from './body-regions.js';
import { IMPORTED_EXERCISES, CURATED_EXERCISES } from './catalog-details.js';
import { exerciseDisplayName, exerciseId, exerciseName } from './exercises.js';
import { CARDIO_MACHINE_ALIASES, isTimedCardioExercise } from './measurement.js';
// Original exercise identities plus the pinned offline catalogue expansion.

export const CATEGORIES = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', triceps: 'Triceps', biceps: 'Biceps',
  forearms: 'Forearms', quads: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves', abs: 'Abs',
  lowerback: 'Lower back', hips: 'Hips & glutes', conditioning: 'Conditioning', other: 'Other',
};

export function categoryLabel(cat) {
  return CATEGORIES[cat] || (cat ? String(cat) : 'Other');
}

const LIST = {
  quads: [
    "Barbell Back Squat",
    "Front Squat",
    "Goblet Squat",
    "Bulgarian Split Squat",
    "Walking Lunge",
    "Reverse Lunge",
    "Leg Press",
    "Hack Squat",
    "Leg Extension",
    "Step-up",
    "Sissy Squat",
    "Back Squat",
    "High-Bar Back Squat",
    "Low-Bar Back Squat",
    "Pause Squat",
    "Box Squat",
    "Safety Bar Squat",
    "Zercher Squat",
    "Landmine Squat",
    "Belt Squat",
    "Smith Machine Squat",
    "Smith Machine Hack Squat",
    "Pendulum Squat",
    "V-Squat Machine",
    "Single-Leg Press",
    "Narrow-Stance Leg Press",
    "Wide-Stance Leg Press",
    "Single-Leg Extension",
    "Spanish Squat",
    "Cyclist Squat",
    "Heels-Elevated Goblet Squat",
    "Front-Foot Elevated Split Squat",
    "Rear-Foot Elevated Split Squat",
    "Single-Leg Box Step-Up",
    "Lateral Lunge",
    "Curtsy Lunge",
    "Cossack Squat",
    "Reverse Nordic Curl",
    "Sled Push",
    "Sled Drag",
  ],
  hamstrings: [
    "Romanian Deadlift",
    "Sumo Deadlift",
    "Leg Curl",
    "Seated Leg Curl",
    "Good Morning",
    "Stiff-Leg Deadlift",
    "Dumbbell Romanian Deadlift",
    "Single-Leg Romanian Deadlift",
    "Single-Leg Dumbbell RDL",
    "Single-Leg Cable RDL",
    "Barbell Good Morning",
    "Seated Good Morning",
    "Nordic Hamstring Curl",
    "Glute-Ham Raise",
    "Lying Leg Curl",
    "Standing Leg Curl",
    "Single-Leg Seated Leg Curl",
    "Single-Leg Lying Leg Curl",
    "Cable Pull-Through",
    "Kettlebell Swing",
    "Reverse Hyperextension",
  ],
  back: [
    "Conventional Deadlift",
    "Back Extension",
    "Pull-up",
    "Chin-up",
    "Lat Pulldown",
    "Close-grip Lat Pulldown",
    "Barbell Row",
    "One-arm Dumbbell Row",
    "Seated Cable Row",
    "Chest-supported Row",
    "T-Bar Row",
    "Straight-arm Pulldown",
    "Shrug",
    "Pendlay Row",
    "Seal Row",
    "Meadows Row",
    "Single-Arm Cable Row",
    "Single-Arm Machine Row",
    "Single-Arm Lat Pulldown",
    "Single-Arm Straight-Arm Pulldown",
    "Wide-Grip Lat Pulldown",
    "Neutral-Grip Lat Pulldown",
    "Underhand Lat Pulldown",
    "Assisted Pull-Up",
    "Weighted Pull-Up",
    "Wide-Grip Pull-Up",
    "Neutral-Grip Pull-Up",
    "Inverted Row",
    "TRX Row",
    "Machine High Row",
    "Plate-Loaded Row",
    "Iso-Lateral Row Machine",
    "Cable Face Pull",
    "Dumbbell Pullover",
    "Cable Pullover",
    "Rack Pull",
    "Snatch-Grip Deadlift",
    "Deficit Deadlift",
    "Trap-Bar Deadlift",
    "Single-Arm Dumbbell Row",
    "Single-Arm Landmine Row",
    "Single-Arm Chest-Supported Row",
    "Single-Arm Kneeling Lat Pulldown",
    "Single-Arm Reverse Fly",
    "Single-Arm Face Pull",
    "Single-Arm Shrug",
    "Assisted Pull-Ups",
  ],
  hips: [
    "Hip Thrust",
    "Glute Bridge",
    "Hip Abduction",
    "Hip Adduction",
    "Single-Leg Hip Thrust",
    "Barbell Glute Bridge",
    "Cable Glute Kickback",
    "Single-Leg Cable Kickback",
    "Hip Thrust Machine",
    "Frog Pump",
    "Clamshell",
    "Banded Lateral Walk",
    "Cable Hip Abduction",
    "Cable Hip Adduction",
    "Hip Abduction Machine",
    "Hip Adduction Machine",
  ],
  calves: [
    "Standing Calf Raise",
    "Seated Calf Raise",
    "Single-Leg Calf Raise",
    "Leg Press Calf Raise",
    "Donkey Calf Raise",
    "Tibialis Raise",
    "Seated Tibialis Raise",
  ],
  chest: [
    "Barbell Bench Press",
    "Incline Barbell Press",
    "Incline Dumbbell Press",
    "Dumbbell Floor Press",
    "Push-up",
    "Cable Fly",
    "Pec Deck",
    "Chest Press Machine",
    "Dips",
    "Flat Dumbbell Bench Press",
    "Decline Barbell Bench Press",
    "Decline Dumbbell Press",
    "Smith Machine Bench Press",
    "Smith Machine Incline Bench Press",
    "Smith Machine Decline Press",
    "Machine Incline Chest Press",
    "Machine Decline Chest Press",
    "Single-Arm Chest Press Machine",
    "Single-Arm Cable Fly",
    "Low-to-High Cable Fly",
    "High-to-Low Cable Fly",
    "Cable Crossover",
    "Dumbbell Fly",
    "Incline Dumbbell Fly",
    "Decline Dumbbell Fly",
    "Svend Press",
    "Landmine Press",
    "Deficit Push-up",
    "Incline Push-up",
    "Decline Push-up",
    "Diamond Push-up",
    "Wide Push-up",
    "Weighted Push-up",
    "Assisted Dip",
    "Ring Dip",
    "Single-Arm Machine Chest Press",
  ],
  shoulders: [
    "Overhead Press",
    "Dumbbell Lateral Raise",
    "Cable Lateral Raise",
    "Face Pull",
    "Rear Delt Fly",
    "Arnold Press",
    "Upright Row",
    "Dumbbell Shoulder Press",
    "Seated Dumbbell Shoulder Press",
    "Machine Shoulder Press",
    "Shoulder Press Machine",
    "Push Press",
    "Z Press",
    "Seated Barbell Press",
    "Smith Machine Shoulder Press",
    "Cable Front Raise",
    "Dumbbell Front Raise",
    "Plate Front Raise",
    "Lean-Away Lateral Raise",
    "Machine Lateral Raise",
    "Single-Arm Cable Lateral Raises",
    "Single-Arm Dumbbell Lateral Raise",
    "Single-Arm Machine Lateral Raise",
    "Bent-Over Rear Delt Raise",
    "Reverse Pec Deck",
    "Cable Rear Delt Fly",
    "Single-Arm Cable Rear Delt Fly",
    "Y Raise",
    "Lu Raise",
    "Upright Cable Row",
    "Cable External Rotation",
    "Dumbbell External Rotation",
    "Reverse Chest Fly Machine",
  ],
  biceps: [
    "Dumbbell Curl",
    "Hammer Curl",
    "Preacher Curl",
    "Cable Curl",
    "Concentration Curl",
    "Spider Curl",
    "Bayesian Cable Curl",
    "Incline Dumbbell Curl",
    "EZ-Bar Curl",
    "Drag Curl",
    "Zottman Curl",
    "Rope Hammer Curl",
    "Machine Biceps Curl",
    "Single-Arm Cable Curl",
    "Single-Arm Preacher Curl",
    "Single-Arm Concentration Curl",
  ],
  triceps: [
    "Triceps Pushdown",
    "Overhead Triceps Extension",
    "Skull Crusher",
    "Close-grip Bench Press",
    "Rope Triceps Pushdown",
    "Straight-Bar Triceps Pushdown",
    "V-Bar Triceps Pushdown",
    "Single-Arm Tricep Pushdowns",
    "Single-Arm Reverse-Grip Pushdown",
    "Single-Arm Overhead Cable Extension",
    "Cable Overhead Triceps Extension",
    "Dumbbell Overhead Triceps Extension",
    "Single-Arm Dumbbell Triceps Extension",
    "EZ-Bar Skull Crusher",
    "Dumbbell Skull Crusher",
    "JM Press",
    "Triceps Kickback",
    "Single-Arm Cable Kickback",
    "Bench Dip",
    "Close-Grip Push-up",
    "Assisted Triceps Dip",
    "Machine Triceps Extension",
  ],
  abs: [
    "Plank",
    "Side Plank",
    "Hanging Leg Raise",
    "Cable Crunch",
    "Ab Wheel Rollout",
    "Pallof Press",
    "Russian Twist",
    "Decline Sit-Up",
    "Weighted Crunch",
    "Machine Crunch",
    "Abdominal Crunch Machine",
    "Reverse Crunch",
    "V-Up",
    "L-Sit",
    "Hollow Body Hold",
    "Dead Bug",
    "Bird Dog",
    "Bicycle Crunch",
    "Wood Chop",
    "Cable Wood Chop",
    "Single-Arm Cable Wood Chop",
    "Landmine Rotation",
    "Hanging Knee Raise",
    "Captain’s Chair Knee Raise",
    "Dragon Flag",
    "Stability Ball Rollout",
    "Barbell Rollout",
  ],
  forearms: [
    "Meow Curls",
    "Farmer Carry",
    "Reverse Curl",
    "Wrist Curl",
    "Reverse Wrist Curl",
    "Wrist Roller",
    "Plate Pinch",
    "Dead Hang",
    "Suitcase Carry",
    "Single-Arm Farmer Carry",
    "Reverse Cable Bicep Curls",
  ],
  conditioning: [
    "Jump Rope",
    "Burpee",
    "Mountain Climber",
    "Treadmill Run",
    "Cycling",
    "Elliptical",
    "Rowing Machine",
    "Stair Climber",
    "Ski Erg",
    "Air Bike",
    "Assault Bike",
    "Incline Treadmill Walk",
    "Outdoor Run",
    "Sled Sprint",
    "Battle Ropes",
    "Box Jump",
    "Jumping Jack",
    "High Knees",
    "Burpee Broad Jump",
    "Bear Crawl",
    "Kettlebell Clean and Press",
    "Turkish Get-Up",
    "Single-Arm Kettlebell Swing",
  ],
  lowerback: [
    "45-Degree Back Extension",
  ],
};

// Same rule as the original app: these names are trained one side at a time.
export const UNILATERAL_PATTERN = /single[- ]arm|one[- ]arm|single[- ]leg|one[- ]leg|unilateral/i;
const EXTRA_UNILATERAL = ['Bulgarian Split Squat', 'Concentration Curl', 'Reverse Chest Fly Machine'];

export function looksUnilateral(name) {
  return UNILATERAL_PATTERN.test(name || '') || EXTRA_UNILATERAL.includes(name);
}

const inferEquipment = name => /smith/i.test(name) ? 'smith machine' : /plate.loaded/i.test(name) ? 'plate-loaded machine' : /cable|pulldown|pushdown|face pull/i.test(name) ? 'cable' : /machine|pec deck|leg press|leg extension|leg curl|hip abduction|hip adduction/i.test(name) ? 'machine' : /dumbbell/i.test(name) ? 'dumbbell' : /barbell|ez.bar|jm press/i.test(name) ? 'barbell' : /kettlebell/i.test(name) ? 'kettlebells' : /band/i.test(name) ? 'bands' : 'other';
const base = Object.entries(LIST).flatMap(([cat, names]) => names.map(name => ({ name, cat, unilateral: looksUnilateral(name), equipment: inferEquipment(name) })));
const details = new Map(IMPORTED_EXERCISES.map(x => [exerciseId(x.name), x]));
for (const x of CURATED_EXERCISES) {
  const source = x.sourceMatch ? IMPORTED_EXERCISES.find(y => y.sourceId === x.sourceMatch) : null;
  details.set(exerciseId(x.name), { ...source, ...x });
}
const known = new Set(base.map(x => exerciseId(x.name)));
const extraSearchAliases = new Map([
  ['Cable Shrug', ['standing cable shrug']],
  ['Cable Curl', ['cable biceps curl']],
  ['Cable Wrist Flexion', ['supported cable wrist flexion']],
  ['Cable Wrist Extension', ['supported cable wrist extension']],
  ['JM Press', ['JM bench press', 'JM triceps press', 'smith jm press', 'smith machine jm press']],
  ['Lying T-Bar Row', ['chest supported t bar row', 'wide grip chest supported t bar row', 'plate loaded t bar row']],
]);
for (const x of [...IMPORTED_EXERCISES, ...CURATED_EXERCISES]) {
  const id = exerciseId(x.name);
  if (!known.has(id)) { base.push({ ...x, unilateral: x.unilateral ?? looksUnilateral(x.name) }); known.add(id); }
}
export const CATALOG = base.map(x => {
  const detail = details.get(exerciseId(x.name));
  const equipment = x.name === 'Lying T-Bar Row' ? 'plate-loaded machine' : detail?.equipment || x.equipment;
  return { ...detail, ...x, equipment: isTimedCardioExercise(x.name) ? 'machine' : equipment,
    aliases: [...(detail?.aliases || []), ...(detail?.sourceName ? [detail.sourceName] : []), ...(CARDIO_MACHINE_ALIASES[x.name] || []), ...(extraSearchAliases.get(x.name) || [])],
    instructions: detail?.instructions || [], images: detail?.images || [],
    primaryMuscles: detail?.primaryMuscles || [x.cat], secondaryMuscles: detail?.secondaryMuscles || [],
  };
});
// These versions are for independent-arm machines; no borrowed two-arm media.
for (const name of PLATE_SIDE_BASES) {
  const source = CATALOG.find(x => x.name === name);
  CATALOG.push({ name: 'Single-Arm ' + name, modeVariantOf: name, cat: source.cat, equipment: source.equipment,
    unilateral: true, aliases: ['one arm ' + name, 'independent arm ' + name],
    primaryMuscles: [...source.primaryMuscles], secondaryMuscles: [...source.secondaryMuscles],
    images: [], instructions: [],
  });
}
// Curated execution variants use their own IDs; do not borrow bilateral media.
for(const name of LEG_SIDE_BASES){
 const source=CATALOG.find(e=>e.name===name);
 CATALOG.push({...source,name:'Single-Leg '+name,modeVariantOf:name,unilateral:true,
  aliases:['one leg '+name,'single legged '+name],images:[],
  instructions:['Use a machine that supports single-leg execution. Keep your hips supported, move through a controlled range without bouncing, and repeat the same working sets on each leg.']});
}
export const EQUIPMENT_FILTERS = ['All equipment', ...new Set(CATALOG.map(x => x.equipment))];

// Legacy broad search terms remain supported; visible filters follow the bodygraph.
export const MUSCLE_GROUPS = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', triceps: 'Arms', biceps: 'Arms', forearms: 'Arms',
  quads: 'Legs', hamstrings: 'Legs', calves: 'Legs', hips: 'Legs', abs: 'Core', lowerback: 'Core', conditioning: 'Conditioning',
};
export const GROUP_FILTERS = ['All', ...BODY_REGION_GROUPS.map(([,label])=>label), 'Conditioning'];
const regionNames=new Map(BODY_REGION_GROUPS);
const entriesById=new Map(CATALOG.map(e=>[exerciseId(e.name),e]));
const sideBases=new Map(SIDE_VARIANTS.flatMap(([both,one,,aliases=[]])=>[both,one,...aliases].map(name=>[exerciseId(name),both])));
export function catalogueRegionLabels(entry){
 const id=exerciseId(entry.name),base=entriesById.get(exerciseId(sideBases.get(id)||entry.name))||entry;
 const muscle=/upright[ -]row|rear[ -]delt[ -]fly/i.test(entry.name)?'shoulders':exerciseId(base.name)==='two arm kettlebell clean'?'hamstrings':base.cat;
 return liftBodyRegions({name:entry.name,muscle}).map(id=>regionNames.get(id)||categoryLabel(id));
}

const canonicalEntries = new Map(CATALOG.map(x => [x.name, x]));
const searchText = value => String(value || '').normalize('NFKD').toLowerCase()
  .replace(/\p{M}+/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\b(t) (bar)\b|\b(pull|push|chin) (ups?|downs?)\b/g, part => part.replace(' ', ''))
  .trim();

const termsOf = phrases => [...new Set(phrases.filter(Boolean).flatMap(phrase => phrase.split(' ')))];
const searchIndex = CATALOG.map(entry => {
  const title = searchText(entry.name);
  const groups = [...catalogueRegionLabels(entry), MUSCLE_GROUPS[entry.cat]];
  const tags = [entry.kind, ...groups, ...[entry.cat, ...entry.primaryMuscles, ...entry.secondaryMuscles]
    .flatMap(muscle => [muscle, categoryLabel(muscle), MUSCLE_GROUPS[muscle]])].map(searchText);
  const aliases = [...new Set([exerciseDisplayName(entry.name), ...entry.aliases].map(searchText))]
    .filter(alias => alias && alias !== title && !tags.includes(alias));
  const names = termsOf([title, ...aliases]);
  return { entry, id: exerciseId(entry.name), groups, title, aliases, names, terms: termsOf([...names, searchText(entry.equipment), ...tags]) };
});
const searchNames = new Map(searchIndex.map(({ entry, title, aliases }) => [entry.name, [title, ...aliases]]));

export function matchesCataloguePhrase(name, query) {
  const phrase = searchText(query);
  return phrase.includes(' ') && (searchNames.get(name) || []).some(title => (' ' + title).includes(' ' + phrase));
}

function matchesTerm(term, word) {
  return term.startsWith(word) || (word.length > 4 && word.endsWith('s') && term === word.slice(0, -1));
}

function searchScore(item, query, words) {
  if (item.title === query) return 10;
  if (item.title === query + 's' || query === item.title + 's') return 9;
  if (item.aliases.includes(query)) return 8;
  if (item.title.startsWith(query + ' ')) return 7;
  if ((' ' + item.title + ' ').includes(' ' + query + ' ')) return 6;
  if (item.title.startsWith(query)) return 5;
  if ((' ' + item.title).includes(' ' + query)) return 4;
  if (item.aliases.some(alias => (' ' + alias).includes(' ' + query))) return 3;
  if (words.every(word => item.names.some(term => matchesTerm(term, word)))) return 2;
  if (words.every(word => item.terms.some(term => matchesTerm(term, word)))) return 1;
  return 0;
}

// Accept a missing letter, extra letter, substitution or adjacent transposition.
// Restrict this fallback to named exercises and apply it only when search found nothing.
function oneEdit(term, word) {
  if (Math.abs(term.length - word.length) > 1) return false;
  let index = 0;
  while (index < term.length && term[index] === word[index]) index++;
  const a = term.slice(index), b = word.slice(index);
  if (a.length !== b.length) return a.length > b.length ? a.slice(1) === b : b.slice(1) === a;
  return a.slice(1) === b.slice(1) || (a[0] === b[1] && a[1] === b[0] && a.slice(2) === b.slice(2));
}

export function searchCatalog(query, group = 'All', equipment = 'All equipment') {
  const text = searchText(query);
  const words = text ? text.split(' ') : [];
  const eligible = searchIndex.filter(item =>
    (group === 'All' || item.groups.includes(group)) &&
    (equipment === 'All equipment' || item.entry.equipment === equipment));
  let matches = eligible;
  if (words.length) {
    matches = eligible.map(item => ({ item, score: searchScore(item, text, words) }))
      .filter(hit => hit.score > 0).sort((a, b) => b.score - a.score).map(hit => hit.item);
    if (!matches.length && words.some(word => word.length >= 4)) {
      matches = eligible.filter(item => {
        const missing = words.filter(word => !item.terms.some(term => matchesTerm(term, word)));
        return missing.length === 1 && missing[0].length >= 4 && item.names.some(term => oneEdit(term, missing[0]));
      });
    }
  }
  const seen = new Set();
  return matches.filter(item => !seen.has(item.id) && seen.add(item.id))
    .map(({ entry }) => canonicalEntries.get(exerciseName(entry.name)) || { ...entry, name: exerciseName(entry.name) });
}
