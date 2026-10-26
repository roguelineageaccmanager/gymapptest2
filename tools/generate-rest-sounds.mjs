// Original short sine-tone alerts, shared with the in-app preview.
import { mkdirSync, writeFileSync } from 'node:fs';
import { REST_SOUNDS } from '../js/domain/rest-sounds.js';
mkdirSync('js/audio', { recursive: true });
for (const sound of REST_SOUNDS.filter(s => s.notes.length)) {
  const rate = 22050, samples = Math.ceil(Math.max(...sound.notes.map(([, delay, duration]) => delay + duration)) * rate);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const value = sound.notes.reduce((sum, [frequency, delay, duration]) => {
      const time = i / rate - delay;
      return time >= 0 && time < duration ? sum + Math.sin(2 * Math.PI * frequency * time) * .22 * Math.min(1, time / .01) * Math.exp(-5 * time / duration) : sum;
    }, 0);
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2);
  }
  writeFileSync('js/audio/rest_' + sound.id + '.wav', wav);
}
