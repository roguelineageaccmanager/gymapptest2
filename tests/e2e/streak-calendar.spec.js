import { test, expect, open, tab, sheetAction } from './helpers.js';

test.use({ timezoneId: 'Europe/Vienna', isMobile: true, hasTouch: true, viewport: { width: 393, height: 851 } });
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-07T11:00:00+01:00') });
  await page.route('**/cloud-config.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={};' }));
  await page.addInitScript(() => {
    if (localStorage.getItem('streakCalendarSeeded')) return;
    localStorage.setItem('streakCalendarSeeded', '1');
    localStorage.setItem('gymCustomWorkouts', JSON.stringify({ Push: [{ name: 'Dips', cat: 'triceps', sets: 2, target: '8 reps', rest: 90 }] }));
    localStorage.setItem('gymPlanSchedule', JSON.stringify({ 0: 'Push', 2: 'Push', 4: 'Push' }));
    localStorage.setItem('gymLogs', JSON.stringify(Object.fromEntries(['2024-02-29', '2026-11-04', '2026-11-06'].map(date => [date, [{ id: date, day: 'Push', time: date + 'T10:00:00Z', duration: 600, exercises: [] }]]))));
  });
});

test('streak badges count rest days, open details on every tab and return focus', async ({ page }) => {
  await open(page);
  const before = await page.evaluate(() => localStorage.getItem('gymLogs'));
  for (const name of ['today', 'plan', 'calendar', 'stats', 'crew']) {
    await tab(page, name);
    const badge = page.locator('.page.active [data-open-streak]');
    await expect(badge).toHaveText('4'); await badge.tap();
    await expect(page.locator('.sheet-backdrop.open .streak-summary strong')).toHaveText('4');
    await expect(page.locator('.sheet-backdrop.open .streak-breakdown')).toContainText('2 gym days');
    await expect(page.locator('.sheet-backdrop.open .streak-breakdown')).toContainText('2 rest days');
    await page.keyboard.press('Escape'); await expect(badge).toBeFocused();
  }
  await page.locator('.page.active [data-open-streak]').click();
  await sheetAction(page, 'View calendar');
  await expect(page.locator('#page-calendar')).toHaveClass(/active/);
  await expect(page.locator('[data-jump-today]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('gymLogs'))).toBe(before);
});

test('compact years persist, count only gym dates and retain accessible date/history actions', async ({ page }) => {
  await open(page); await page.locator('.page.active [data-open-settings]').click();
  await page.locator('[data-calendar-view=years]').click();
  await page.locator('[data-close-settings]').click(); await tab(page, 'calendar');
  await expect(page.locator('.activity-year')).toHaveCount(3);
  await expect(page.locator('.activity-head h2')).toHaveText(['2026', '2025', '2024']);
  await expect(page.locator('.activity-year').filter({ has: page.getByRole('heading', { name: '2025', exact: true }) }).locator('.activity-day.trained')).toHaveCount(0);
  await expect(page.locator('.activity-day.trained')).toHaveCount(3);
  await expect(page.locator('[data-day="2026-11-07"]')).not.toHaveClass(/trained/);
  await expect(page.locator('[data-day="2024-02-29"]')).toHaveClass(/trained/);
  await expect(page.locator('[data-day="2026-11-08"]')).toBeDisabled();
  await page.locator('[data-calendar-date="2024"]').click();
  await page.locator('.sheet-backdrop.open input[name=value]').fill('2024-02-29');
  await sheetAction(page, 'Open day');
  await expect(page.locator('.sheet-backdrop.open')).toContainText('1 workout logged');
  await page.locator('.sheet-backdrop.open [data-sheet-close]').click();
  await page.reload(); await page.locator('#loadingScreen').waitFor({ state: 'detached' }); await tab(page, 'calendar');
  await expect(page.locator('.activity-year')).toHaveCount(3);
  await page.locator('.page.active [data-open-settings]').click();
  await expect(page.locator('[data-calendar-view=years]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('[data-calendar-view=months]').click(); await page.locator('[data-close-settings]').click();
  await expect(page.locator('.activity-year')).toHaveCount(0); await expect(page.locator('.cal-month').first()).toBeVisible();
});

test('yearly keyboard movement follows day rows and week columns and preserves its tab stop', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => { const { state, saveSettings } = await import('/js/state.js'); state.settings.calendarView = 'years'; saveSettings(); });
  await tab(page, 'calendar');
  const day = page.locator('[data-day="2024-02-29"]'); await day.focus();
  await page.keyboard.press('ArrowDown'); await expect(page.locator('[data-day="2024-03-01"]')).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(page.locator('[data-day="2024-03-08"]')).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(page.locator('[data-day="2024-03-07"]')).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await expect(day).toBeFocused();
  await page.evaluate(async () => (await import('/js/ui/calendar.js')).renderCalendar());
  await expect(day).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('Home'); await expect(page.locator('[data-day="2024-01-01"]')).toBeFocused();
  await page.keyboard.press('End'); await expect(page.locator('[data-day="2024-12-31"]')).toBeFocused();
});

test('a bypass protects the streak without painting a gym attendance square', async ({ page }) => {
  await open(page); await page.locator('.page.active [data-open-settings]').click();
  await page.locator('[data-calendar-view=years]').click();
  await page.locator('[data-close-settings]').click(); await tab(page, 'calendar');
  await page.locator('[data-calendar-date="2026"]').click();
  await page.locator('.sheet-backdrop.open input[name=value]').fill('2026-11-02');
  await sheetAction(page, 'Open day'); await sheetAction(page, 'Mark as bypass day');
  await expect(page.locator('[data-day="2026-11-02"]')).toHaveClass(/bypass/);
  await expect(page.locator('[data-day="2026-11-02"]')).not.toHaveClass(/trained/);
  await expect(page.locator('.activity-day.trained')).toHaveCount(3);
  await expect(page.locator('.page.active [data-open-streak]')).toHaveText('6');
});

test('midnight credits rest and breaks a missed workout only once its day has ended', async ({ page }) => {
  await open(page); await page.locator('[data-open-streak]').first().click();
  await page.clock.setSystemTime(new Date('2026-11-08T11:00:00+01:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.sheet-backdrop.open .streak-summary strong')).toHaveText('5');
  await page.clock.setSystemTime(new Date('2026-11-09T11:00:00+01:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.sheet-backdrop.open .streak-summary strong')).toHaveText('5');
  await expect(page.locator('.sheet-backdrop.open .streak-pending')).toContainText('until this day ends');
  await page.clock.setSystemTime(new Date('2026-11-10T11:00:00+01:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.sheet-backdrop.open .streak-summary strong')).toHaveText('0');
  await expect(page.locator('.sheet-backdrop.open .streak-summary b')).toHaveText('5');
});

test('an empty history starts at zero on rest days and keeps a previously saved best', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    localStorage.setItem('gymLogs', '{}');
    localStorage.setItem('gymLegacyStats', JSON.stringify({ best_streak: 9 }));
  });
  await page.reload(); await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  await expect(page.locator('.page.active [data-open-streak]')).toHaveText('0');
  await page.locator('.page.active [data-open-streak]').tap();
  await expect(page.locator('.sheet-backdrop.open .streak-summary strong')).toHaveText('0');
  await expect(page.locator('.sheet-backdrop.open .streak-summary b')).toHaveText('9');
  await expect(page.locator('.sheet-backdrop.open')).toContainText('Log a workout to start');
});

test('compact rows fit a narrow phone and filled dates follow saved theme colors', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 650 });
  await page.addInitScript(() => localStorage.setItem('gymSettings', JSON.stringify({ calendarView: 'years', textColor: '#ffeedd', surfaceColor: '#112233', streakColor: '#334455' })));
  await open(page);
  await tab(page, 'calendar');
  await expect(page.locator('.activity-day.trained').first()).toHaveCSS('background-color', 'rgb(255, 238, 221)');
  await expect(page.locator('[data-open-streak]').filter({ visible: true })).toHaveCSS('background-color', 'rgb(51, 68, 85)');
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, heights: [...document.querySelectorAll('.activity-year')].map(row => row.getBoundingClientRect().height) }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  expect(dimensions.heights.every(height => height < 180)).toBe(true);
});

test('long histories load older years in batches and keep the new year reachable', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const { state, saveSettings } = await import('/js/state.js');
    state.logs['1900-01-01'] = [{ id: 'old', day: 'Push', exercises: [] }];
    state.settings.calendarView = 'years'; saveSettings();
  });
  await tab(page, 'calendar'); await expect(page.locator('.activity-year')).toHaveCount(10);
  await page.locator('[data-older-years]').click();
  await expect(page.locator('.activity-year')).toHaveCount(20);
  await expect(page.locator('[data-calendar-date="2016"]')).toBeFocused();
});

test('the compact date chooser keeps its input and Open day action above a keyboard-sized viewport', async ({ page }) => {
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  await page.locator('[data-calendar-view=years]').click();
  await page.locator('[data-close-settings]').click(); await tab(page, 'calendar');
  await page.locator('[data-calendar-date="2026"]').tap();
  const input = page.locator('.sheet-backdrop.open input[name=value]');
  await input.focus(); await page.setViewportSize({ width: 393, height: 400 });
  await input.fill('2026-11-06');
  await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--view-height')))).toBeLessThanOrEqual(400);
  const action = page.locator('.sheet-backdrop.open [type=submit]');
  expect(await input.evaluate(el => el.getBoundingClientRect().bottom <= (visualViewport?.height || innerHeight))).toBe(true);
  expect(await action.evaluate(el => el.getBoundingClientRect().bottom <= (visualViewport?.height || innerHeight))).toBe(true);
  await action.click(); await expect(page.locator('.sheet-backdrop.open')).toContainText('1 workout logged');
});
