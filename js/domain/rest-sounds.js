export const REST_SOUNDS = [
  { id: 'beep', name: 'Beep', notes: [[880, 0, .22]] },
  { id: 'chime', name: 'Chime', notes: [[660, 0, .18], [880, .2, .28]] },
  { id: 'bell', name: 'Bell', notes: [[1047, 0, .55], [1568, 0, .35]] },
  { id: 'silent', name: 'Silent', notes: [] },
];
export const restSound = value => REST_SOUNDS.find(sound => sound.id === value) || REST_SOUNDS[0];
