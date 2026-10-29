import { html } from '../core/dom.js';
import { APP_VERSION } from '../version.js';
import { openSheet } from './sheet.js';

export function showPatchNotes() {
  return openSheet({ title: 'Patch notes', className: 'patch-notes-sheet', body: html`
    <section class="release-notes"><h3>v${APP_VERSION}</h3><ul>
      <li>Leaderboard opens first in Friends.</li>
      <li>Choose a display name for chat in Account settings.</li>
      <li>Chat notifications show the sender’s profile picture.</li>
      <li>Smoother page transitions and no automatic Calendar jump.</li>
    </ul></section><details class="release-notes"><summary>v4.4.4</summary><ul>
      <li>Remove exercises from Stats and restore them later.</li>
      <li>Ouroboros notification symbol using the existing GitHub artwork.</li>
      <li>Neighboring pages appear while swiping between tabs.</li>
    </ul></details><details class="release-notes"><summary>v4.4.3</summary><ul>
      <li>Chat swipes no longer drag the whole page or switch tabs.</li>
    </ul></details><details class="release-notes"><summary>v4.4.2</summary><ul>
      <li>Original bodygraph restored with corrected back proportions.</li>
      <li>Improved five-finger hands.</li>
      <li>Customizable body color and coordinated theme presets; fixed rank colors stay unchanged.</li>
      <li>Front traps and outer upper arms use their existing Back and Biceps ranks.</li>
      <li>Only exercises in the current weekly split count toward ranks; old logs stay saved.</li>
      <li>Smoother moving rank highlights, including the selected ladder tier.</li>
      <li>Chat reactions, owned-message editing and contained swipe replies.</li>
      <li>Food and drink controls removed for now.</li>
    </ul></details><details class="release-notes"><summary>v4.4.1</summary><ul>
      <li>Compact weekly schedule without the extra heading; warm-up controls above working sets.</li>
      <li>Repaired the full body silhouette and softened muscle outlines.</li>
      <li>Moving rank gradients and simpler Stats headers.</li>
      <li>Strength rank replaces Weight lifted and opens first on the leaderboard.</li>
      <li>Swipe left on a chat message to reply.</li>
      <li>Full-width Cancel workout button with clear spacing.</li>
    </ul></details><details class="release-notes"><summary>v4.4.0</summary><ul>
      <li>Chat hold animation, cleaner taps and keyboard-safe typing with long histories.</li>
      <li>Removed Gym Dates and refreshed first-use and account screens.</li>
      <li>Full emoji picker with search, categories and keyboard emoji support.</li>
      <li>Friends-only comments on progress pictures.</li>
      <li>Cleaner weekly plan and exercise controls.</li>
      <li>Equal leaderboard rows and profile-picture sizes.</li>
      <li>Cleaner bodygraph outlines with five fingers on each hand.</li>
    </ul></details>
    <details class="release-notes"><summary>v4.3.1</summary><ul>
      <li>Shinier fixed-color gradients on rank cards and badges.</li>
      <li>Simpler Analytics: body weight and exercise records, without Training analytics.</li>
      <li>Consecutive chat messages share an avatar and name, with a slimmer themed scrollbar.</li>
    </ul></details>
    <details class="release-notes"><summary>v4.3.0</summary><ul>
      <li>Stats opens on Your rank, with fixed Iron-to-Challenger tiers and brighter badges.</li>
      <li>Bodygraph has a compact rank-order guide; removed rank color customization.</li>
      <li>Compact chat rows, a smaller composer and contained scrolling that opens at the latest messages.</li>
      <li>Automatic score sharing, with sharing controls in Settings.</li>
      <li>Optional warm-up sets, separate from working sets and strength records.</li>
      <li>Discord-style reactions on friends-only progress pictures.</li>
      <li>Fixed square fills escaping the rounded sets controls.</li>
    </ul></details>
    <details class="release-notes"><summary>v4.2.1</summary><ul>
      <li>Saved routines are preserved when upgrading.</li>
      <li>Unexpected exercise removals stop syncing instead of replacing a fuller plan.</li>
      <li>Automatic private plan recovery copies before changes.</li>
      <li>Common exercise name variants share one history and leaderboard result.</li>
      <li>Corrected calf and rear-delt muscle ranks.</li>
    </ul></details>
    <details class="release-notes"><summary>v4.2.0</summary><ul>
      <li>Stats now matches Friends: shared underline tabs, compact rank rows and neutral cards.</li>
      <li>Smaller overall rank card and subtler rank colors; saved customization still applies.</li>
      <li>Nine original rank badges, from Spark to Zenith, with a new color picker.</li>
      <li>Optional web chat alerts, including installed iPhone and iPad apps on iOS 16.4 or later.</li>
      <li>Improved offline updates and tighter chat/device cleanup.</li>
      <li>Stats keeps your place during background updates and pending sign-in confirmation.</li>
    </ul></details>
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
