import { test, expect, open, tab, sheetAction } from './helpers.js';
test.beforeEach(async ({ page }) => { await page.route('**/cloud-config.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:"",anonKey:""};' })); });
async function seed(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bodyWeightLogs', JSON.stringify([{ date: '2026-01-01', weight: 80 }, { date: '2026-02-01', weight: 81 }]));
    const moves = [['Barbell Bench Press', 80], ['Barbell Row', 80], ['Overhead Press', 48], ['Barbell Curl', 32], ['Triceps Pushdown', 40], ['Meow Curls', 20], ['Back Squat', 120], ['Romanian Deadlift', 80], ['Standing Calf Raise', 80], ['Hip Thrust', 120], ['Cable Crunch', 32], ['Good Morning', 64]];
    localStorage.setItem('gymLogs', JSON.stringify({ '2026-01-05': [{ day: 'Push', exercises: [{ name: 'Barbell Bench Press', sets: [{ w: '70', r: '6', done: true }] }] }], '2026-01-10': [{ day: 'Strength', time: '2026-01-10T12:00:00Z', duration: 3600, exercises: moves.map(([name, w]) => ({ name, sets: [{ w: String(w), r: '8', done: true }] })) }] }));
  });
}
test('ranked bodygraph opens muscle and exercise history, with real ranks and keyboard access', async ({ page }) => {
  await seed(page); await open(page); await tab(page, 'stats');
  await expect(page.locator('[data-rank-muscle=chest] summary')).toContainText('Gold');
  await expect(page.locator('.rank-body')).toHaveCount(2); await expect(page.locator('.muscle-rank-card')).toHaveCount(12);
  await page.screenshot({ path: test.info().outputPath('bodygraph.png'), animations: 'disabled', fullPage: true });
  await page.screenshot({ path: test.info().outputPath('bodygraph-phone.png'), animations: 'disabled' });
  await page.locator('[data-stats-tab=rank]').click(); await expect(page.locator('.strength-hero h2')).toContainText('Gold');
  await page.screenshot({ path: test.info().outputPath('your-rank.png'), animations: 'disabled' });
  await page.locator('[data-stats-tab=stats]').click();
  await page.locator('.rank-body [data-muscle=chest]').first().focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-rank-muscle=chest]')).toHaveAttribute('open', '');
  await page.locator('[data-rank-muscle=chest] [data-strength-lift]').click();
  await expect(page.locator('.strength-detail')).toContainText('Barbell Bench Press');
  await expect(page.locator('.strength-detail')).toContainText('101.3');
  const firstPoint = page.locator('.strength-detail [data-chart-point]').first(); await firstPoint.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.strength-detail [data-chart-selection-output]')).toContainText('84 kg');
  await sheetAction(page, 'Done');
  await page.locator('[data-stats-tab=analytics]').click(); await expect(page.locator('#weightInput')).toBeVisible();
  await page.locator('#strengthSearch').fill('Meow'); await expect(page.locator('.strength-lift-list [data-strength-lift]')).toHaveCount(1);
  await page.locator('[data-stats-metric=sets]').click(); await expect(page.locator('.analytics-total b')).toHaveText('13');
  await page.screenshot({ path: test.info().outputPath('analytics.png'), animations: 'disabled', fullPage: true });
});
test('calculator does not write history and custom rank colors and finish survive reload', async ({ page }) => {
  await seed(page); await open(page); await tab(page, 'stats');
  await page.locator('[data-rank-colors]').click();
  await page.locator('[name=rank-gold]').fill('#ff3344'); await page.locator('[name=metallic]').uncheck(); await sheetAction(page, 'Save');
  await expect(page.locator('.muscle-rank-card').first()).toHaveClass(/flat/);
  await page.reload(); await page.locator('#loadingScreen').waitFor({ state: 'detached' }); await tab(page, 'stats');
  await expect(page.locator('[data-rank-muscle=chest]')).toHaveCSS('--rank-color', '#ff3344');
  await page.locator('[data-stats-tab=calculator]').click();
  const before = await page.evaluate(() => localStorage.getItem('gymLogs'));
  await page.locator('[data-pick-rank-exercise]').click(); await page.locator('#rankExerciseSearch').fill('Barbell Bench'); await page.locator('[data-rank-choice="Barbell Bench Press"]').click();
  await page.locator('#rankCalculator [name=bodyweight]').fill('80'); await page.locator('#rankCalculator [name=weight]').fill('80');
  await page.getByRole('button', { name: 'Calculate rank', exact: true }).click();
  await expect(page.locator('#rankCalculatorResult')).toContainText('Gold');
  expect(await page.evaluate(() => localStorage.getItem('gymLogs'))).toBe(before);
  await page.screenshot({ path: test.info().outputPath('calculator.png'), animations: 'disabled' });
});
test('empty state and light customized surfaces stay usable at narrow phone widths', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gymSettings', JSON.stringify({ theme: { base: 'light', preset: 'ocean' }, buttonColor: '#ddeeff', textColor: '#112233', buttonTextColor: '#223344', selectedColor: '#aaccff', selectedTextColor: '#112233' })));
  await open(page); await tab(page, 'stats'); await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.locator('.muscle-rank-card').first()).toContainText('Unranked');
  await expect(page.locator('.muscle-rank-card').first()).toHaveCSS('background-color', 'rgb(221, 238, 255)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-stats-tab=calculator]').click(); await expect(page.locator('#rankCalculator')).toBeVisible();
});
