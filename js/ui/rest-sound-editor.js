import { html } from '../core/dom.js';
import { listen } from '../core/store.js';
import { account } from '../cloud/sync.js';
import { state, saveSettings } from '../state.js';
import { REST_SOUNDS, restSound } from '../domain/rest-sounds.js';
import { openSheet } from './sheet.js';
import { icons } from './icons.js';

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
    await openSheet({ title: 'Rest alert', className: 'rest-sound-sheet', body: html`<div class="rest-sound-options" role="radiogroup" aria-label="Rest sound">${REST_SOUNDS.map(sound => html`<div class="rest-sound-card"><label class="rest-sound-choice"><input type="radio" name="restSound" value="${sound.id}"${restSound(state.settings.restSound).id === sound.id ? ' checked' : ''}><span class="rest-sound-symbol" aria-hidden="true">${sound.id === 'silent' ? icons.minus : icons.volume}</span><span class="rest-sound-name"><b>${sound.name}</b><small>${{ beep: 'Short tone', chime: 'Two soft tones', bell: 'Bright ring', silent: 'No sound' }[sound.id]}</small></span><span class="rest-sound-check" aria-hidden="true">${icons.check}</span></label>${sound.id !== 'silent' ? html`<button type="button" class="icon-btn" data-preview-rest="${sound.id}" aria-label="Preview ${sound.name}">${icons.play}</button>` : ''}</div>`)}</div><label class="rest-vibration-row toggle"><span>Vibrate</span><input type="checkbox" data-rest-vibration${state.settings.restVibration !== false ? ' checked' : ''}></label>`, actions: [{ label: 'Done', value: true }],
      onMount(sheet, close) {
        remove = listen('gym:account', () => { if (account.user?.id !== id) close(); });
        sheet.addEventListener('change', event => {
          if (account.user?.id !== id) return;
          if (event.target.name === 'restSound') state.settings.restSound = restSound(event.target.value).id;
          else if (event.target.matches('[data-rest-vibration]')) state.settings.restVibration = event.target.checked;
          else return;
          saveSettings();
        });
        sheet.querySelectorAll('[data-preview-rest]').forEach(button => { button.onclick = () => playRestSound(button.dataset.previewRest); });
      },
    });
  } finally { remove?.(); }
}
