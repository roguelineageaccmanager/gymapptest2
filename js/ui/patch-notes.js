import { html } from '../core/dom.js';
import { APP_VERSION } from '../version.js';
import { openSheet } from './sheet.js';

export function showPatchNotes() {
  return openSheet({ title: 'Patch notes', className: 'patch-notes-sheet', body: html`
    <section class="release-notes"><h3>v${APP_VERSION}</h3><ul>
      <li>Stats now matches Friends: shared underline tabs, compact rank rows and neutral cards.</li>
      <li>Smaller overall rank card and subtler rank colors; saved customization still applies.</li>
      <li>Nine original rank badges, from Spark to Zenith, with a new color picker.</li>
      <li>Optional web chat alerts, including installed iPhone and iPad apps on iOS 16.4 or later.</li>
      <li>Improved offline updates and tighter chat/device cleanup.</li>
      <li>Stats keeps your place during background updates and pending sign-in confirmation.</li>
    </ul></section>
    <details class="release-notes"><summary>v4.1.0</summary><ul>
      <li>Rebuilt Stats: ranked front/back bodygraph and expandable muscle cards.</li>
      <li>Nine exercise and muscle ranks, with progress to the next tier.</li>
      <li>Tap a muscle or lift for completed-set records and estimated 1RM history.</li>
      <li>Training analytics with volume, sets, strength and period filters.</li>
      <li>Rank calculator with searchable exercises; previews do not change history.</li>
      <li>Custom rank colors, metallic/flat finish and a new Crimson theme.</li>
      <li>Progress pictures stay in their own Stats tab.</li>
    </ul></details>
    <details class="release-notes"><summary>v4.0.1</summary><ul>
      <li>Friends show their next workout and day beside their name.</li>
      <li>New sound picker with a preview for each sound.</li>
      <li>Progress pictures in Stats, shared only with accepted friends.</li>
      <li>Shared routines moved to Plan; shared themes moved to Settings.</li>
      <li>Simpler workout lists without exercise/set counts.</li>
      <li>Optional Android chat notifications, including when the app is closed. Enable Chat messages in Settings.</li>
    </ul></details>
    <details class="release-notes"><summary>v4.0.0</summary><ul>
      <li>Chat opens first, with profile pictures and tappable profiles.</li>
      <li>Hold messages to reply, copy text or delete your own.</li>
      <li>Cleaner chat bubbles, date separators and smaller timestamps.</li>
      <li>Account settings opens in its own menu.</li>
      <li>Rest-ready notifications and next exercise/workout in the ongoing Android notification.</li>
      <li>Choose a rest sound and vibration in Plan → Rest alert.</li>
      <li>Popups use your saved button and text colors.</li>
    </ul></details>
    <details class="release-notes"><summary>v3.10.0</summary><ul>
      <li>Profile views with shared stats, pictures and image banners.</li>
      <li>Separate picture and banner editors.</li>
      <li>Rest-day pictures moved to Plan.</li>
      <li>Chat stays above the Android keyboard.</li>
    </ul></details>`, actions: [{ label: 'Done', value: true }],
  });
}
