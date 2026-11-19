import { test, expect, open, tab, fillPrompt, sheetAction, createWorkout, scheduleToday, startTodayWorkout } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/cloud-config.js', r => r.fulfill({
    contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={};',
  }));
});

test('quick workout saves without a plan and keeps completed hold times after cancelling', async ({ page }) => {
  await open(page);
  const today = page.locator('#page-today');
  const session = page.locator('#session');
  const seconds = session.locator('.work-sets .r').first();
  const done = session.locator('.work-sets .d').first();
  const addPlank = async () => {
    await session.getByRole('button', { name: 'Add exercise', exact: true }).click();
    const picker = page.locator('.quick-exercise-sheet');
    await picker.getByRole('searchbox').fill('Plank');
    await picker.locator('[data-quick-pick="Plank"]').click();
    await expect(seconds).toBeVisible();
  };
  const start = async () => {
    await session.getByRole('button', { name: 'Start workout', exact: true }).click();
    await sheetAction(page, 'Start workout');
  };

  await today.getByRole('button', { name: 'Start a workout' }).click();
  await addPlank();
  await start();
  await done.click();
  await expect(done).not.toBeChecked();
  await expect(page.locator('#sessionSets')).toHaveText('0/2 sets');
  await expect(page.locator('#restBar')).toBeHidden();

  await seconds.fill('35');
  await done.check();
  await session.getByRole('button', { name: 'Finish workout' }).click();
  await sheetAction(page, 'Save workout');
  await expect(today.locator('.hero-card')).toContainText('Saved on this device');
  await expect(today.locator('.hero-card')).toContainText('1 completed set');
  await page.getByRole('button', { name: 'Save as routine' }).click();
  await fillPrompt(page, 'Core');
  await tab(page, 'plan');
  await expect(page.locator('[data-edit="Core"]')).toBeVisible();
  await tab(page, 'today');
  await today.getByRole('button', { name: 'View or edit' }).click();
  await expect(seconds).toHaveValue('35');
  await session.getByRole('button', { name: 'Close workout' }).click();

  await today.getByRole('button', { name: 'Quick workout', exact: true }).click();
  await addPlank();
  await expect(seconds).toHaveValue('35');
  await start();
  await seconds.fill('90');
  await done.check();
  await page.reload();
  await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  await today.getByRole('button', { name: 'Resume workout' }).click();
  await expect(seconds).toHaveValue('90');
  await session.getByRole('button', { name: 'Cancel workout' }).click();
  await sheetAction(page, 'Cancel workout');

  await today.getByRole('button', { name: 'Quick workout', exact: true }).click();
  await addPlank();
  await expect(seconds).toHaveValue('35');
});

test('compact themes fit on a small screen and a new theme persists', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await open(page);
  await page.locator('.page.active [data-open-settings]').first().click();
  const shortcuts = page.getByRole('navigation', { name: 'Settings sections' });
  await shortcuts.getByRole('button', { name: 'Appearance' }).click();
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeFocused();
  const grid = page.locator('.theme-grid');
  await expect(grid.getByRole('button')).toHaveCount(12);
  const tile = grid.getByRole('button', { name: 'Ember' });
  await tile.click();
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  expect(await grid.evaluate(el => el.scrollWidth === el.clientWidth &&
    [...el.querySelectorAll('button')].every(button => button.offsetHeight <= 56))).toBe(true);
  await page.reload();
  await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  await page.locator('.page.active [data-open-settings]').first().click();
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
});

test('picker hides Smith leg press and saved strength sets explain rank progress', async ({ page }) => {
  await open(page);
  await createWorkout(page, 'Push', ['Barbell Bench Press']);
  await page.locator('[data-edit="Push"]').click();
  await page.locator('#exSearch').fill('Smith Machine Leg Press');
  await expect(page.locator('#exResults')).toContainText('No matching exercises');
  await page.locator('#exSearch').fill('leg press');
  await expect(page.locator('#exResults [data-movement="leg press"]')).toContainText('Machine');
  await expect(page.locator('#exResults [data-movement="leg press"]')).not.toContainText('Smith');
  await page.locator('[data-close-editor]').click();
  await scheduleToday(page, 'Push');
  await page.evaluate(async () => {
    const { ymd } = await import('/js/core/dates.js');
    const { state, saveWeights } = await import('/js/state.js');
    state.weights = [{ date: ymd(), weight: 80 }];
    saveWeights();
  });
  await tab(page, 'today');
  await startTodayWorkout(page);
  await page.locator('.work-sets .w').first().fill('60');
  await page.locator('.work-sets .r').first().fill('8');
  await page.locator('.work-sets .d').first().check();
  await page.locator('#sessionMain').click();
  await sheetAction(page, 'Save workout');
  await expect(page.locator('#toast')).toContainText(/Barbell Bench Press: .+ LP from 60 kg total × 8/);
});

test('cardio machines are searchable by familiar names and save time instead of reps', async ({ page }) => {
  await open(page);
  await tab(page, 'plan');
  await page.getByRole('button', { name: 'New workout' }).click();
  await fillPrompt(page, 'Cardio');
  for (const [alias, name] of [['stairmaster', 'Stair Climber'], ['treadmill incline', 'Incline Treadmill Walk']]) {
    await page.locator('#exSearch').fill(alias);
    await page.locator(`#exResults [data-add="${name}"]`).click();
    const row = page.locator(`[data-ex="${name}"]`);
    await expect(row.locator('[data-field=measurement]')).toHaveText('Seconds');
    await expect(row.locator('[data-field=target]')).toHaveValue('600');
  }
  await page.locator('[data-close-editor]').click();
  await scheduleToday(page, 'Cardio');
  await tab(page, 'today');
  await startTodayWorkout(page);
  await expect(page.locator('.work-sets th').nth(2)).toHaveText('Time (sec)');
  await page.locator('.work-sets .r').first().fill('720');
  await page.locator('.work-sets .d').first().check();
  await page.locator('#sessionMain').click();
  await sheetAction(page, 'Save workout');
  await tab(page, 'stats');
  await page.locator('[data-stats-tab=analytics]').click();
  await page.locator('[data-strength-lift="Stair Climber"]').click();
  await expect(page.locator('.strength-detail')).toContainText('Cardio duration');
  await expect(page.locator('.strength-detail')).toContainText('720 s');
  await expect(page.locator('.strength-detail')).toContainText('4 Training LP');
  await expect(page.locator('.strength-detail')).toContainText('720 s');
});
