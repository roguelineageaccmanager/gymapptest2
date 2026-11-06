// Real machine variants missing from the pinned dataset. Original instructions;
// no manufacturer names or borrowed illustrations of different machines.
export const PLATE_LOADED_EXERCISES = [
  ['Leg Press', 'quads', ['plate loaded sled press', '45 degree leg press'], [
    'Load the plate pegs evenly and adjust the seat so your hips stay against the pad throughout the movement.',
    'Place your feet securely on the platform. Release the safety stops and lower the sled through a comfortable range without lifting your pelvis.',
    'Press the platform away without snapping your knees straight. Re-engage the stops before leaving the machine.',
  ]],
  ['Hack Squat', 'quads', ['plate loaded hack squat machine'], [
    'Load the pegs evenly, set the safety stops and position your shoulders and back against the pads.',
    'Release the handles and bend your knees and hips while keeping your heels supported and knees following your toes.',
    'Push through your feet to stand without locking the knees forcefully. Secure the carriage before stepping out.',
  ]],
  ['Pendulum Squat', 'quads', ['plate loaded pendulum squat machine'], [
    'Load the machine evenly, adjust its stops and settle your shoulders and back securely against the pads.',
    'Release the latch and squat with control along the pendulum arc, keeping your feet planted.',
    'Drive back up through your feet without bouncing at the bottom. Re-engage the latch before stepping away.',
  ]],
  ['Belt Squat', 'quads', ['plate loaded lever belt squat'], [
    'Load the lever and attach the squat belt around your hips according to the machine’s instructions.',
    'Stand securely on the platform and release the support while keeping the belt connection centred.',
    'Squat through a comfortable range with your knees following your toes, then stand and secure the lever before unhooking.',
  ]],
  ['Hip Thrust', 'hips', ['plate loaded glute drive', 'plate loaded hip thrust machine'], [
    'Load both pegs evenly. Place your upper back against the support and secure the padded belt or lap pad across your hips.',
    'Keep your feet planted and drive your hips upward while keeping your ribs down.',
    'Pause with your torso and thighs aligned, then lower slowly without arching your lower back.',
  ]],
  ['Leg Extension', 'quads', ['plate loaded knee extension'], [
    'Align your knees with the machine’s pivot, set the shin pad just above your ankles and load the plate peg.',
    'Keep your hips against the seat and extend your knees with a smooth motion.',
    'Pause without snapping the knees straight, then lower the lever slowly.',
  ]],
  ['Seated Leg Curl', 'hamstrings', ['plate loaded seated hamstring curl'], [
    'Align your knees with the pivot, position the lower pad behind your ankles and secure the thigh pad.',
    'Curl the lever down and back by bending your knees while keeping your hips in the seat.',
    'Return slowly without letting the plates crash or the lever pull your knees past a comfortable extension.',
  ]],
  ['Lying Leg Curl', 'hamstrings', ['plate loaded prone leg curl'], [
    'Load the peg, lie face down and adjust the lower-leg pad to sit just above the back of your heels.',
    'Keep your hips against the bench and curl your heels toward your glutes without lifting your pelvis.',
    'Lower slowly to a comfortable knee extension, keeping tension on the lever.',
  ]],
  ['Seated Calf Raise', 'calves', ['plate loaded seated calf machine'], [
    'Place the balls of your feet on the platform, adjust the thigh pads and load the plate peg.',
    'Raise your heels to release the support, then lower them gently through a comfortable ankle range.',
    'Press through the balls of your feet, pause at the top and lower slowly. Re-engage the support before getting up.',
  ]],
  ['Standing Calf Raise', 'calves', ['plate loaded standing calf machine'], [
    'Adjust the shoulder pads and safety stops, load the pegs and stand with the balls of your feet on the platform.',
    'Keep your knees slightly soft and your torso stable while lowering your heels gently.',
    'Raise your heels as high as comfortable without bouncing, then return under control and secure the machine.',
  ]],
  ['Triceps Dip', 'triceps', ['plate loaded seated dip', 'plate loaded dip machine'], [
    'Sit securely, set the seat so the handles are beside your torso, and load the lever pegs evenly.',
    'Keep your shoulders down and elbows close as you press the handles downward by extending your elbows.',
    'Return slowly without shrugging. Log the machine’s added plate load; your body is supported by the seat.',
  ]],
  ['Preacher Curl', 'biceps', ['plate loaded preacher machine', 'plate loaded biceps curl'], [
    'Load the lever, adjust the seat and rest your upper arms on the preacher pad with elbows aligned to the pivot.',
    'Grip the handles and curl upward while keeping your upper arms supported and shoulders still.',
    'Lower slowly without forcing the elbows into a locked position.',
  ]],
  ['Lateral Raise', 'shoulders', ['plate loaded side raise machine'], [
    'Adjust the seat so the machine’s pivot and pads fit your shoulders and upper arms, then load the levers evenly.',
    'Lift your arms outward along the lever path with a soft elbow bend, keeping your shoulders away from your ears.',
    'Pause near shoulder height and lower slowly without bouncing the plates.',
  ]],
  ['Rear Delt Fly', 'shoulders', ['plate loaded reverse fly', 'plate loaded rear deltoid machine'], [
    'Adjust the seat and chest pad so the handles are near shoulder height and load both levers evenly.',
    'Keep your chest supported and a slight bend in your elbows as you open your arms outward and back.',
    'Return slowly without twisting your torso or forcing the shoulders beyond a comfortable range.',
  ]],
  ['Pullover', 'back', ['plate loaded pullover machine', 'plate loaded lat pullover'], [
    'Load the peg and adjust the seat and restraint so you sit securely with the upper-arm pads aligned.',
    'Use the entry lever if supplied, then pull the padded lever down in an arc while keeping your trunk against the seat.',
    'Return slowly to a comfortable overhead position. Use the entry lever to unload the arm pads before getting out.',
  ]],
  ['Abdominal Crunch', 'abs', ['plate loaded ab crunch machine', 'plate loaded abdominal machine'], [
    'Load the peg, adjust the seat and secure your feet and torso against the machine’s supports.',
    'Bring your ribs toward your pelvis by shortening your abdominal muscles, following the machine’s path.',
    'Return slowly without pulling with your neck or bouncing the lever.',
  ]],
].map(([name, cat, aliases, instructions]) => ({
  name: 'Plate-Loaded ' + name, cat, aliases, instructions,
  equipment: 'plate-loaded machine', kind: 'strength', images: [],
}));
