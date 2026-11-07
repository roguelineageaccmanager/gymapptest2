import { html, on, render } from '../core/dom.js';
import { listen } from '../core/store.js';
import { fmtShort } from '../core/dates.js';
import { go, currentPage } from '../core/router.js';
import { streaks } from '../state.js';
import { account } from '../cloud/sync.js';
import { openSheet } from './sheet.js';
import { icons } from './icons.js';

export function streakBadge() {
  const { current } = streaks();
  return html`<button type="button" class="streak" data-open-streak aria-haspopup="dialog" aria-label="Training streak: ${current} ${current === 1 ? 'day' : 'days'}. View streak details">${icons.flame} ${current}</button>`;
}

function detail() {
  const s = streaks();
  return html`<div class="streak-summary"><div><strong>${s.current}</strong><span>${s.current === 1 ? 'day' : 'days'} in your streak</span></div><div><b>${s.best}</b><span>Best streak</span></div></div>
    ${s.start ? html`<p class="muted">Since ${fmtShort(s.start)} ${s.start.slice(0, 4)}</p>` : html`<p class="muted">Log a workout to start a new streak.</p>`}
    ${s.current ? html`<div class="streak-breakdown"><span><b>${s.trained}</b> gym ${s.trained === 1 ? 'day' : 'days'}</span><span><b>${s.rested}</b> rest ${s.rested === 1 ? 'day' : 'days'}</span>${s.bypassed ? html`<span><b>${s.bypassed}</b> bypass ${s.bypassed === 1 ? 'day' : 'days'}</span>` : ''}</div>` : ''}
    ${s.pendingToday && s.current ? html`<p class="streak-pending">Today's workout is still pending. Your streak stays safe until this day ends.</p>` : ''}
    <ul class="plain streak-rules"><li>Gym days and bypass days start or continue a streak.</li><li>Planned rest days add to an active streak.</li><li>${s.hasPlan ? 'A missed scheduled workout breaks it after that day ends.' : 'Without a weekly plan, a day without a workout or bypass breaks it after that day ends.'}</li></ul>
    <p class="hint">${s.hasPlan ? 'Rest days follow your current weekly plan.' : 'Add workouts to your weekly plan to let planned rest days count too.'}</p>`;
}

export function initStreak() {
  on(document.body, 'click', '[data-open-streak]', async () => {
    const owner = account.user?.id || null;
    const stops = [];
    const action = await openSheet({ title: 'Your streak', className: 'streak-sheet', settleHistory: true,
      body: html`<div data-streak-detail>${detail()}</div>`,
      actions: [...(currentPage() !== 'calendar' ? [{ label: 'View calendar', value: 'calendar', tone: 'primary' }] : []), { label: 'Done', value: null, tone: 'ghost' }],
      onMount(sheet, close) {
        for (const event of ['gym:day-changed', 'gym:logs-updated', 'gym:plan-updated']) stops.push(listen(event, () => render(sheet.querySelector('[data-streak-detail]'), detail())));
        stops.push(listen('gym:account', () => { if ((account.user?.id || null) !== owner) close(null); }));
      },
    });
    stops.forEach(stop => stop());
    if (action === 'calendar' && (account.user?.id || null) === owner) go('calendar');
  });
}
