import { PLATE_LOADED_EXERCISES } from './plate-loaded-exercises.js';
import { FREE_EXERCISES, SOURCE_COMMIT } from '../../vendor/free-exercise-db.js';

const muscles = { abdominals: 'abs', quadriceps: 'quads', adductors: 'hips', abductors: 'hips', glutes: 'hips', 'middle back': 'back', lats: 'back', traps: 'back', 'lower back': 'lowerback', neck: 'other' };
const muscle = name => muscles[name] || name;
// These source instructions explicitly describe loading weight pins. Keep the
// existing names/identities, but make their plate-loaded equipment searchable.
const PLATE_LOADED_SOURCE_ALIASES = {
  Leverage_High_Row: ['plate-loaded high row', 'plate loaded high row machine'],
  Leverage_Iso_Row: ['plate-loaded iso-lateral row', 'plate loaded independent arm row'],
  Leverage_Deadlift: ['plate-loaded deadlift', 'lever deadlift machine'],
  Leverage_Shrug: ['plate-loaded shrug', 'plate loaded shrug machine'],
};
export const IMPORTED_EXERCISES = FREE_EXERCISES.map(x => ({
  ...x, cat: x.kind === 'cardio' ? 'conditioning' : muscle(x.primaryMuscles[0]),
  unilateral: /single[- ]arm|one[- ]arm|single[- ]leg|one[- ]leg|alternat(?:e|ing)/i.test(x.name),
  primaryMuscles: [...new Set(x.primaryMuscles.map(muscle))],
  secondaryMuscles: [...new Set(x.secondaryMuscles.map(muscle))],
  aliases: [...(PLATE_LOADED_SOURCE_ALIASES[x.sourceId] || []), ...(x.aliases || []), x.sourceName, ...x.primaryMuscles, ...x.secondaryMuscles, x.kind || '', ...(x.name === 'Reverse Cable Bicep Curls' ? ['reverse cable biceps curl'] : [])], equipment: /smith/i.test(x.name) ? 'smith machine' : (/plate-loaded/i.test(x.name) || PLATE_LOADED_SOURCE_ALIASES[x.sourceId]) ? 'plate-loaded machine' : x.equipment || 'other',
  images: x.images.map(path => `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${SOURCE_COMMIT}/exercises/${path}`),
}));

// Explicit equipment/angle variants. Search aliases never change saved identities.
export const CURATED_EXERCISES = [
  { name: 'Plate-Loaded Row', cat: 'back', equipment: 'plate-loaded machine', aliases: ['plate loaded row', 'lever row'], instructions: ['Set the seat so the handles align with the middle of your torso. Keep your chest against the pad.', 'Pull the handles back with elbows moving behind you, without lifting your chest or shrugging.', 'Return slowly until your arms extend comfortably. This horizontal row is separate from a low row or pulldown.'] },
  { name: 'Plate-Loaded Low Row', cat: 'back', equipment: 'plate-loaded machine', aliases: ['low row machine', 'plate loaded low row'], instructions: ['Adjust the seat and chest pad so you can reach the low handles without rounding your back.', 'Keep your chest supported and pull the handles toward your hips with elbows close to your sides.', 'Pause, then return slowly along the machine’s path. Do not replace this with a cable row.'] },
  { name: 'Plate-Loaded Pulldown', cat: 'back', equipment: 'plate-loaded machine', aliases: ['plate loaded lat pulldown', 'lever pulldown'], instructions: ['Adjust the seat and thigh restraint so your feet are supported and you can reach the overhead handles.', 'Keep your torso steady and pull your elbows down toward your sides. Follow the machine’s arc without swinging.', 'Return under control to a comfortable overhead stretch. This uses loaded lever arms rather than a cable stack.'] },
  { name: 'Seated Lumbar Extension Machine', cat: 'lowerback', equipment: 'machine', aliases: ['seated lower back machine', 'lumbar extension', 'lower-back machine'], instructions: ['Adjust the seat, pelvis restraint and back pad according to the machine’s labels. Start with a light load.', 'Keep the pelvis secured and extend your lower back slowly through a comfortable range.', 'Return gently without bouncing or forcing the spine past neutral. Stop if the movement causes pain.'] },
  { name: 'Supinating Dumbbell Curl', cat: 'biceps', equipment: 'dumbbell', aliases: ['supination curl', 'rotating dumbbell curl'], instructions: ['Stand with a dumbbell in each hand, palms facing your thighs and elbows beside your ribs.', 'Curl the weights while gradually turning your palms upward. Keep your upper arms still.', 'Lower slowly while rotating back to the starting grip. A fixed palms-up curl is a different variant.'] },
  { name: 'Rope Overhead Cable Triceps Extension', cat: 'triceps', equipment: 'cable', aliases: ['rope overhead extension', 'overhead rope triceps extension'], instructions: ['Attach a rope to a low pulley and face away, holding the ends above your head with a stable stance.', 'Keep your upper arms beside your head. Bend your elbows to lower the rope behind your head.', 'Extend your elbows without moving your upper arms, then return slowly. This is distinct from an arm-at-side pushdown.'], sourceMatch: 'Cable_Rope_Overhead_Triceps_Extension' },
  { name: 'Cable Wrist Flexion', cat: 'forearms', equipment: 'cable', aliases: ['cable wrist curl', 'wrist flexion cable'], instructions: ['Attach a straight bar to a low cable. Sit with forearms supported on your thighs, palms up and wrists free.', 'Keep your forearms still and curl your hands upward using only the wrists.', 'Lower slowly through a comfortable range without letting the cable pull your wrists sharply.'], sourceMatch: 'Cable_Wrist_Curl' },
  { name: 'Cable Wrist Extension', cat: 'forearms', equipment: 'cable', aliases: ['reverse cable wrist curl', 'wrist extension cable'], instructions: ['Hold a low-cable bar with palms down and support your forearms with wrists free.', 'Keep your forearms supported and lift the backs of your hands by extending the wrists.', 'Lower slowly without swinging your elbows. Use a lighter load than for wrist flexion.'] },
  { name: 'Single-Arm Cable Rear Delt Fly', cat: 'shoulders', equipment: 'cable', unilateral: true, aliases: ['one arm rear delt fly', 'single arm cable reverse fly'], instructions: ['Set a single cable handle near shoulder height and stand sideways to the pulley.', 'Reach across with the far arm, keeping a soft elbow bend. Open the arm out to the side without twisting your torso.', 'Return slowly, then repeat on the other arm.'] },
  { name: 'Single-Arm Tricep Pushdowns', cat: 'triceps', equipment: 'cable', unilateral: true, aliases: ['single arm cable triceps extension', 'arm at side triceps extension', 'upper arm beside ribs', 'one arm pushdown'], instructions: ['Attach a single handle to a high pulley. Keep the working upper arm against your ribs and your torso still.', 'Extend your elbow to bring the hand toward your hip. Do not lift the upper arm overhead or move the shoulder.', 'Return slowly to a bent elbow, then repeat on the other arm.'] },
  { name: '45-Degree Back Extension', cat: 'lowerback', equipment: 'other', aliases: ['45° back extension', '45 degree hyperextension', 'roman chair'], instructions: ['Set the 45-degree bench pad below your hip crease and secure your feet.', 'Brace your trunk and hinge forward at the hips through a comfortable range.', 'Raise your torso until it aligns with your legs. Do not swing or arch past that line.'] },
  ...PLATE_LOADED_EXERCISES,
];
