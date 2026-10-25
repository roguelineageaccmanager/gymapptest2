import { test, expect, open, tab, createWorkout, scheduleToday } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {};' }));
});

test('future previews cannot change drafts or a running workout; today starts directly', async ({ page }) => {
  await open(page);
  await createWorkout(page, 'Push', ['Dips']);
  await scheduleToday(page, 'Push');
  for (let day = 0; day < 7; day++) {
    await page.locator(`[data-day="${day}"]`).click();
    await page.locator('.sheet-backdrop.open [data-choose="Push"]').click();
  }
  await tab(page, 'today');
  await page.locator('#startToday').click();
  await expect(page.locator('#sessionMain')).toHaveText('Finish workout');
  await expect(page.locator('#sessionClockLabel')).toHaveText('In gym');
  await page.locator('#sessionBack').click();
  const before = await page.evaluate(() => ({ active: localStorage.getItem('gymActive'), drafts: localStorage.getItem('gymDrafts'), logs: localStorage.getItem('gymLogs') }));
  expect(before.active).toBeTruthy();
  await page.locator('[data-preview]').first().click();
  await expect(page.locator('#sessionMain')).toBeHidden();
  await expect(page.locator('#session')).toHaveClass(/session-preview/);
  for (const control of await page.locator('#sessionList input, #sessionList button').all()) await expect(control).toBeDisabled();
  await page.locator('#sessionBack').click();
  expect(await page.evaluate(() => ({ active: localStorage.getItem('gymActive'), drafts: localStorage.getItem('gymDrafts'), logs: localStorage.getItem('gymLogs') }))).toEqual(before);
  await page.locator('#activeBar button').click();
  await expect(page.locator('#sessionMain')).toBeVisible();
  await expect(page.locator('#sessionMain')).toHaveText('Finish workout');
});

test('an edited workout badge survives reload and rename', async ({ page }) => {
  await open(page);
  await createWorkout(page, 'Push', ['Dips']);
  await page.locator('[data-edit="Push"]').click();
  await page.locator('[data-workout-badge]').fill('PU');
  await page.locator('[data-workout-badge]').press('Tab');
  await page.locator('[data-rename]').click();
  await page.locator('.sheet-backdrop.open input[name=value]').fill('Upper');
  await page.locator('.sheet-backdrop.open [type=submit]').click();
  await expect(page.locator('[data-workout-badge]')).toHaveValue('PU');
  await page.locator('[data-close-editor]').click();
  await scheduleToday(page, 'Upper');
  await tab(page, 'today');
  await expect(page.locator('.week-day.today .wd-workout')).toHaveText('PU');
  await page.reload();
  await expect(page.locator('.week-day.today .wd-workout')).toHaveText('PU');
});

test('chart selection moves one white ring without a floating box', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bodyWeightLogs', JSON.stringify([{ date: '2026-10-01', weight: 70 }, { date: '2026-10-05', weight: 72 }, { date: '2026-10-10', weight: 71 }]));
  });
  await open(page);
  await tab(page, 'stats');
  const chart = page.locator('#weightCard .chart-wrap');
  await expect(chart.locator('.g-selected')).toHaveCount(1);
  await expect(chart.locator('.g-selected')).toHaveAttribute('r', '4');
  const first = chart.locator('[data-chart-point]').first();
  const x = await first.getAttribute('cx');
  await first.click();
  await expect(chart.locator('.g-selected')).toHaveAttribute('cx', String(Number(x)));
  await expect(chart.locator('.g-select-bg, .g-best')).toHaveCount(0);
  await expect(chart.locator('[data-chart-selection-output]')).toContainText('70 kg');
  await expect(first).toHaveCSS('outline-style', 'none');
  await expect(page.locator('#weightCard [data-chart-value]')).toHaveText('70');
  await expect(page.locator('#weightCard [data-chart-date]')).toHaveText('1 Oct');
  await first.focus();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(first).toHaveCSS('outline-style', 'none');
});

test('podium rows and the custom leaderboard picker use the selected category', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gymSettings', JSON.stringify({ buttonColor: '#343456', selectedColor: '#6733aa', selectedTextColor: '#ffffff' })));
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:location.origin,anonKey:"mock-key"};' }));
  await page.route('**/rest/v1/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  const rows = [
    { user_id: '00000000-0000-4000-8000-000000000001', username: 'avery', total_seconds: 3600, volume_kg_reps: 100, best_streak: 2, workouts_count: 3, weight_kg: 70 },
    { user_id: '00000000-0000-4000-8000-000000000002', username: 'blake', total_seconds: 2400, volume_kg_reps: 300, best_streak: 4, workouts_count: 3, weight_kg: 90 },
    { user_id: '00000000-0000-4000-8000-000000000003', username: 'casey', total_seconds: 1200, volume_kg_reps: 200, best_streak: 3, workouts_count: 3, weight_kg: 80 },
  ];
  await page.route('**/rest/v1/rpc/friend_summaries', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(rows) }));
  await open(page);
  await page.evaluate(async () => {
    const { account } = await import('/js/cloud/sync.js');
    account.user = { id: '00000000-0000-4000-8000-000000000001', email: 'local@example.test' };
    account.profile = { username: 'avery' };
    account.ready = true;
  });
  await tab(page, 'crew');
  await page.locator('[data-crew-tab="ranking"]').click();
  await expect(page.locator('[data-crew-tab="friends"]')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  await expect(page.locator('[data-crew-tab="ranking"]')).toHaveCSS('background-color', 'rgb(103, 51, 170)');
  await expect(page.locator('[data-leaderboard-picker]')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  await expect(page.locator('.leaderboard-row.gold')).toContainText('@avery');
  await expect(page.locator('.leaderboard-row.silver')).toContainText('@blake');
  await expect(page.locator('.leaderboard-row.bronze')).toContainText('@casey');
  await expect(page.locator('.leaderboard-row.me')).toHaveCSS('outline-style', 'none');
  await expect(page.locator('.leaderboard-row.me .avatar')).toHaveCSS('outline-width', '1px');
  await page.locator('[data-leaderboard-picker]').click();
  await expect(page.locator('.board-sheet select')).toHaveCount(0);
  await page.locator('.sheet-backdrop.open').getByRole('option', { name: /Weight lifted/ }).click();
  await expect(page.locator('[data-leaderboard-picker]')).toContainText('Weight lifted');
  await expect(page.locator('.leaderboard-row.gold')).toContainText('@blake');
  await expect(page.locator('[data-leaderboard-picker]')).toBeFocused();
  await page.locator('[data-leaderboard-picker]').click();
  await page.locator('.sheet-backdrop.open').getByRole('option', { name: /^Body weight/ }).click();
  await expect(page.locator('.leaderboard-row.gold')).toContainText('@blake');
  await expect(page.locator('.leaderboard-row.gold')).toContainText('90 kg');
  await expect(page.locator('.leaderboard-controls')).toContainText('heaviest first');
  await expect(page.locator('[data-publish]')).toHaveCount(0);
});

test('compact controls and custom button text persist without a dedicated Train anyway background', async ({ page }) => {
  await open(page);
  await createWorkout(page, 'Upper', ['Dips']);
  await tab(page, 'today');
  await expect(page.locator('[data-log-any]')).toHaveCSS('min-height', '34px');
  await page.locator('.page.active [data-open-settings]').click();
  await expect(page.locator('[data-train-color]')).toHaveCount(0);
  await page.locator('[data-button-text-color]').evaluate(el => { el.value = '#ff88cc'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(page.locator('[data-pick-image]')).toHaveCSS('color', 'rgb(255, 136, 204)');
  await page.locator('[data-close-settings]').click();
  await expect(page.locator('[data-log-any]')).toHaveCSS('color', 'rgb(255, 136, 204)');
  await page.reload();
  await expect(page.locator('[data-log-any]')).toHaveCSS('color', 'rgb(255, 136, 204)');
});

test('shared appearance colors cover icon buttons, selected controls, fields and workout badges', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gymSettings', JSON.stringify({ buttonColor: '#343456', selectedColor: '#6733aa', selectedTextColor: '#ffffff', inputColor: '#223344', badgeColor: '#aa6644', textColor: '#eeeeee' })));
  await open(page);
  await expect(page.locator('.page.active [data-open-settings]')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  await page.locator('.page.active [data-open-settings]').click();
  await expect(page.locator('[data-base="dark"]')).toHaveCSS('background-color', 'rgb(103, 51, 170)');
  await expect(page.locator('[data-base="dark"]')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.locator('[data-close-settings]').click();
  await tab(page, 'stats');
  await expect(page.locator('#weightInput')).toHaveCSS('background-color', 'rgb(34, 51, 68)');
  await createWorkout(page, 'Upper', ['Dips']);
  await expect(page.locator('[data-edit="Upper"] .routine-mark')).toHaveCSS('background-color', 'rgb(170, 102, 68)');
  await page.evaluate(async () => { const { account } = await import('/js/cloud/sync.js'); account.user = { id: '00000000-0000-4000-8000-000000000001' }; });
  await page.locator('[data-edit="Upper"]').click();
  await expect(page.locator('#page-plan .editor-top .eyebrow')).toHaveCount(0);
  await expect(page.locator('#page-plan .editor-top h1')).toHaveText('Upper');
  for (const selector of ['[data-rename]', '[data-share]']) await expect(page.locator(selector)).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  for (const selector of ['[data-field="target"]', '[data-field="note"]', '[data-field="rest"]', '.stepper']) await expect(page.locator('[data-ex="Dips"] ' + selector)).toHaveCSS('background-color', 'rgb(34, 51, 68)');
  await page.reload();
  await expect(page.locator('.page.active [data-open-settings]')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
});

test('the loading text uses the saved text color before app initialization', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gymSettings', JSON.stringify({ textColor: '#aabbcc', backgroundColor: '#101020' })));
  await page.route('**/js/main.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto('/');
  await expect(page.locator('#loadingScreen')).toBeVisible();
  await expect(page.locator('.loading-label')).toHaveCSS('color', 'rgb(170, 187, 204)');
  await expect(page.locator('#loadingScreen')).toHaveCSS('background-color', 'rgb(16, 16, 32)');
});

test('streaks, workout icons and visible navigation use shared colors', async ({ page }) => {
  await open(page);
  await createWorkout(page, 'Upper', ['Dips']);
  await page.locator('.page.active [data-open-settings]').click();
  for (const [selector, color] of [['[data-button-color]', '#343456'], ['[data-selected-color]', '#6733aa']]) {
    await page.locator(selector).evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }, color);
  }
  await page.locator('[data-close-settings]').click();
  await expect(page.locator('.routine-mark')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  for (const name of ['today', 'plan', 'calendar', 'stats', 'crew']) {
    await tab(page, name);
    await expect(page.locator('.nav-btn.active')).toHaveCSS('background-color', 'rgb(103, 51, 170)');
    if (name !== 'today') await expect(page.locator('.page.active .top .streak')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  }
  await page.locator('.page.active [data-open-settings]').click();
  await page.locator('[data-streak-color]').evaluate(el => { el.value = '#aa6644'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('[data-close-settings]').click();
  await expect(page.locator('.page.active .top .streak')).toHaveCSS('background-color', 'rgb(170, 102, 68)');
});

test('account caches separate settings and preserve offline edits and resets', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const s = await import('/js/state.js');
    s.activateAccountSettings('account-a');
    s.state.settings.buttonColor = '#112233'; s.saveSettings();
    s.deactivateAccountSettings();
    s.activateAccountSettings('account-b');
    const b = s.state.settings.buttonColor;
    s.state.settings.buttonColor = '#445566'; s.saveSettings();
    s.activateAccountSettings('account-a');
    const a = s.state.settings.buttonColor;
    const pending = s.accountPreferences('account-a');
    delete s.state.settings.buttonColor; s.saveSettings();
    s.applyAccountPreferences('account-a', pending);
    const reset = s.state.settings.buttonColor;
    s.applyAccountPreferences('account-b', { values: { buttonColor: '#ffffff' }, times: { buttonColor: Date.now() + 1000 } });
    const unchanged = s.state.settings.buttonColor;
    s.activateAccountSettings('account-b');
    return { a, b, reset, unchanged, bAgain: s.state.settings.buttonColor };
  });
  expect(result).toEqual({ a: '#112233', b: undefined, reset: undefined, unchanged: undefined, bAgain: '#445566' });
});

test('preference requests keep the original account token during an account switch', async ({ page }) => {
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:location.origin,anonKey:"mock-key"};' }));
  let stored, authorization;
  await page.route('**/auth/v1/user', async route => {
    authorization = route.request().headers().authorization;
    if (route.request().method() === 'PUT') stored = route.request().postDataJSON().data.tracker_preferences;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'account-a', user_metadata: { tracker_preferences: stored } }) });
  });
  await open(page);
  const returned = await page.evaluate(async () => {
    const { requestAccountPreferences } = await import('/js/cloud/client.js');
    const s = await import('/js/state.js');
    s.activateAccountSettings('account-a');
    s.state.settings.textColor = '#aabbcc'; s.saveSettings();
    const originalSession = { user: { id: 'account-a' }, access_token: 'original-account-token' };
    const writing = requestAccountPreferences(originalSession, s.accountPreferences('account-a'));
    s.activateAccountSettings('account-b');
    const remote = await writing;
    s.applyAccountPreferences('account-a', remote);
    return { remote, bColor: s.state.settings.textColor };
  });
  expect(authorization).toBe('Bearer original-account-token');
  expect(returned.remote.values.textColor).toBe('#aabbcc');
  expect(returned.bColor).toBeUndefined();
});

test('Today week has clear day labels, completed-only white days and no phone overflow', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date(), monday = new Date(now); monday.setDate(now.getDate() - (now.getDay() + 6) % 7);
    const date = monday.getFullYear() + '-' + String(monday.getMonth() + 1).padStart(2, '0') + '-' + String(monday.getDate()).padStart(2, '0');
    localStorage.setItem('gymLogs', JSON.stringify({ [date]: [{ id: 'completed', day: 'Push', time: monday.toISOString(), exercises: [{ name: 'Dips', sets: [{ w: '10', r: '8', done: true }] }] }] }));
  });
  await open(page);
  await expect(page.locator('.week-heading')).toContainText('This week');
  await expect(page.locator('.wd-letter')).toHaveText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  await expect(page.locator('.week-day.done')).toHaveCount(1);
  await expect(page.locator('.week-day.done')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  for (const day of await page.locator('.week-day:not(.done)').all()) await expect(day).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('appearance preview shows live samples without saving unfinished picker changes', async ({ page }) => {
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  const preview = page.locator('.preview-screen');
  await expect(preview).toHaveAttribute('role', 'img');
  await expect(preview.locator('button, input, [tabindex]')).toHaveCount(0);
  const before = await page.evaluate(() => localStorage.getItem('gymSettings'));
  const picker = page.locator('[data-button-color]');
  await picker.focus();
  await picker.evaluate(el => { el.value = '#354678'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  for (const selector of ['.btn', '.preview-badge', '.preview-streak']) await expect(preview.locator(selector)).toHaveCSS('background-color', 'rgb(53, 70, 120)');
  expect(await page.evaluate(() => localStorage.getItem('gymSettings'))).toBe(before);
  await page.locator('[data-text-color]').focus();
  await expect.poll(() => preview.evaluate(el => el.style.length)).toBe(0);
  await expect(preview.locator('.btn')).not.toHaveCSS('background-color', 'rgb(53, 70, 120)');
  await picker.evaluate(el => { el.value = '#354678'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(preview.locator('.btn')).toHaveCSS('background-color', 'rgb(53, 70, 120)');
  await page.reload();
  await page.locator('.page.active [data-open-settings]').click();
  await expect(preview.locator('.btn')).toHaveCSS('background-color', 'rgb(53, 70, 120)');
  await page.locator('[data-reset-background]').click();
  await expect(preview.locator('.btn')).not.toHaveCSS('background-color', 'rgb(53, 70, 120)');
});

test('preview covers each custom color and keeps its navigation separate from real tabs', async ({ page }) => {
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  const preview = page.locator('.preview-screen');
  for (const [field, target, property] of [
    ['background-color', '.preview-screen', 'background-color'], ['surface-color', '.preview-card', 'background-color'],
    ['text-color', '.preview-workout .grow', 'color'], ['border-color', '.preview-card', 'border-top-color'],
    ['button-text-color', '.preview-controls .btn', 'color'], ['button-color', '.preview-controls .btn', 'background-color'],
    ['selected-color', '.preview-tab.active', 'background-color'], ['selected-text-color', '.preview-tab.active', 'color'],
    ['input-color', '.preview-field', 'background-color'], ['badge-color', '.preview-badge', 'background-color'],
    ['streak-color', '.preview-streak', 'background-color'],
  ]) {
    await page.locator(`[data-${field}]`).evaluate(el => { el.value = '#884466'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(page.locator(target)).toHaveCSS(property, 'rgb(136, 68, 102)');
    await preview.evaluate(el => el.removeAttribute('style'));
  }
  await expect(page.locator('.nav-btn')).toHaveCount(5);
  await expect(preview.locator('.preview-tab.active')).toContainText('Today');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('appearance preview stays anchored while scrolling the grouped color controls', async ({ page }) => {
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  await page.locator('[data-button-color]').scrollIntoViewIfNeeded();
  const sample = page.locator('.appearance-preview');
  await expect(sample).toHaveClass(/preview-pinned/);
  const before = await sample.boundingBox();
  await page.evaluate(() => window.scrollBy(0, 120));
  await expect.poll(async () => Math.round((await sample.boundingBox()).y)).toBe(Math.round(before.y));
  await expect(page.locator('.color-group legend')).toHaveText(['Screen', 'Buttons and fields', 'Bottom navigation', 'Workout and streak']);
  await expect(page.locator('#page-settings')).not.toContainText('Button backgrounds also color');
  await expect(page.locator('#page-settings')).not.toContainText('Workout weights are saved exactly');
});

test('dedicated bottom navigation colors affect every real tab and persist', async ({ page }) => {
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  for (const [selector, color] of [['[data-nav-color]', '#884466'], ['[data-nav-text-color]', '#ffffff']]) {
    await page.locator(selector).evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }, color);
  }
  await expect(page.locator('.preview-tab.active')).toHaveCSS('background-color', 'rgb(136, 68, 102)');
  await page.locator('[data-close-settings]').click();
  for (const name of ['today', 'plan', 'calendar', 'stats', 'crew']) {
    await tab(page, name);
    await expect(page.locator('#bottomNav .nav-btn.active')).toHaveCSS('background-color', 'rgb(136, 68, 102)');
    await expect(page.locator('#bottomNav .nav-btn.active')).toHaveCSS('color', 'rgb(255, 255, 255)');
  }
  await page.reload();
  await expect(page.locator('#bottomNav .nav-btn.active')).toHaveCSS('background-color', 'rgb(136, 68, 102)');
});
