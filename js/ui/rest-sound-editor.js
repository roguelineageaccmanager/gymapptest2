import { html } from '../core/dom.js';
import { listen } from '../core/store.js';
import { account } from '../cloud/sync.js';
import { state, saveSettings } from '../state.js';
import { REST_SOUNDS, restSound } from '../domain/rest-sounds.js';
import { openSheet } from './sheet.js';

let audio;
export function unlockRestAudio() {
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume()?.catch(() => {}); } catch { /* No audio device. */ }
}
export function playRestSound(value = state.settings.restSound) {
  unlockRestAudio();
  if (!audio) return;
  for (const [frequency, delay, duration] of restSound(value).notes) {
    const oscillator = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime + delay;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.001, start); gain.gain.exponentialRampToValueAtTime(.15, start + .01);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
export async function editRestSound() {
  const id = account.user?.id;
  let remove;
  try {
    await openSheet({ title: 'Rest alert', body: html`<div class="rest-sound-options" role="radiogroup" aria-label="Rest sound">${REST_SOUNDS.map(sound => html`<label class="check-row"><input type="radio" name="restSound" value="${sound.id}"${restSound(state.settings.restSound).id === sound.id ? ' checked' : ''}><span>${sound.name}</span></label>`)}</div><button type="button" class="btn btn-soft btn-block" data-preview-rest>Preview sound</button><label class="check-row"><input type="checkbox" data-rest-vibration${state.settings.restVibration !== false ? ' checked' : ''}><span>Vibrate</span></label>`, actions: [{ label: 'Done', value: true }],
      onMount(sheet, close) {
        remove = listen('gym:account', () => { if (account.user?.id !== id) close(); });
        sheet.addEventListener('change', event => {
          if (account.user?.id !== id) return;
          if (event.target.name === 'restSound') state.settings.restSound = restSound(event.target.value).id;
          else if (event.target.matches('[data-rest-vibration]')) state.settings.restVibration = event.target.checked;
          else return;
          saveSettings();
        });
        sheet.querySelector('[data-preview-rest]').onclick = () => playRestSound();
      },
    });
  } finally { remove?.(); }
}
