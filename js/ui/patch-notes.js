import { html } from '../core/dom.js';
import { APP_VERSION } from '../version.js';
import { openSheet } from './sheet.js';

export function showPatchNotes() {
  return openSheet({ title: 'Patch notes', className: 'patch-notes-sheet', body: html`
    <section class="release-notes"><h3>v${APP_VERSION}</h3><ul>
      <li>Chat opens first, with profile pictures and tappable profiles.</li>
      <li>Hold messages to reply, copy text or delete your own.</li>
      <li>Cleaner chat bubbles, date separators and smaller timestamps.</li>
      <li>Account settings opens in its own menu.</li>
      <li>Rest-ready notifications and next exercise/workout in the ongoing Android notification.</li>
      <li>Choose a rest sound and vibration in Plan → Rest alert.</li>
      <li>Popups use your saved button and text colors.</li>
    </ul></section>
    <details class="release-notes"><summary>v3.10.0</summary><ul>
      <li>Profile views with shared stats, pictures and image banners.</li>
      <li>Separate picture and banner editors.</li>
      <li>Rest-day pictures moved to Plan.</li>
      <li>Chat stays above the Android keyboard.</li>
    </ul></details>`, actions: [{ label: 'Done', value: true }],
  });
}
