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
  const first = chart.locator('[data-chart-point]').first();
  const x = await first.getAttribute('cx');
  await first.click();
  await expect(chart.locator('.g-selected')).toHaveAttribute('cx', String(Number(x)));
  await expect(chart.locator('.g-select-bg, .g-best')).toHaveCount(0);
  await expect(chart.locator('[data-chart-selection-output]')).toContainText('70 kg');
});

test('podium rows and the custom leaderboard picker use the selected category', async ({ page }) => {
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:location.origin,anonKey:"mock-key"};' }));
  await page.route('**/rest/v1/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  const rows = [
    { user_id: '00000000-0000-4000-8000-000000000001', username: 'avery', total_seconds: 3600, volume_kg_reps: 100, best_streak: 2, workouts_count: 3 },
    { user_id: '00000000-0000-4000-8000-000000000002', username: 'blake', total_seconds: 2400, volume_kg_reps: 300, best_streak: 4, workouts_count: 3 },
    { user_id: '00000000-0000-4000-8000-000000000003', username: 'casey', total_seconds: 1200, volume_kg_reps: 200, best_streak: 3, workouts_count: 3 },
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
  await expect(page.locator('.leaderboard-row.gold')).toContainText('@avery');
  await expect(page.locator('.leaderboard-row.silver')).toContainText('@blake');
  await expect(page.locator('.leaderboard-row.bronze')).toContainText('@casey');
  await expect(page.locator('.leaderboard-row.me')).toHaveCSS('outline-style', 'solid');
  await page.locator('[data-leaderboard-picker]').click();
  await expect(page.locator('.board-sheet select')).toHaveCount(0);
  await page.getByRole('option', { name: /Weight lifted/ }).click();
  await expect(page.locator('[data-leaderboard-picker]')).toContainText('Weight lifted');
  await expect(page.locator('.leaderboard-row.gold')).toContainText('@blake');
  await expect(page.locator('[data-leaderboard-picker]')).toBeFocused();
});
