import { test, expect, open, tab, fillPrompt } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:"",anonKey:""};'}));
});

test('plate-loaded equipment is discoverable, saves separately and has working calculator ranks', async ({ page }) => {
  await open(page); await tab(page,'plan');
  await page.getByRole('button',{name:'New workout',exact:true}).click();
  await fillPrompt(page,'Plate machines');
  await page.locator('#exEquipment').selectOption('plate-loaded machine');
  await expect(page.locator('#exResults [data-add]')).toHaveCount(27);
  for (const name of ['Plate-Loaded Leg Press','Plate-Loaded Seated Leg Curl','Plate-Loaded Triceps Dip','Iso-Lateral Row Machine']) {
    await page.locator('#exSearch').fill(name);
    await page.locator(`[data-add="${name}"]`).click();
    await expect(page.locator(`[data-ex="${name}"] .ex-edit-fields .stepper output`)).toHaveText('2');
  }
  await page.locator('#exSearch').fill('plate loaded high row');
  await expect(page.locator('[data-add="Machine High Row"]')).toBeVisible();
  await page.locator('#exSearch').fill('Plate-Loaded Leg Press');
  await page.getByRole('button',{name:'Details for Plate-Loaded Leg Press',exact:true}).click();
  await expect(page.locator('.sheet-backdrop.open')).toContainText('Strength rank and LP');
  await expect(page.locator('.sheet-backdrop.open')).toContainText('Log added plates consistently');
  await expect(page.locator('.exercise-placeholder')).toBeVisible();
  await page.locator('.sheet-backdrop.open [data-sheet-close]').click();
  await page.locator('[data-close-editor]').click();
  await page.reload();await page.locator('#loadingScreen').waitFor({state:'detached'});
  await tab(page,'plan');await page.locator('[data-edit="Plate machines"]').click();
  await expect(page.locator('.ex-edit')).toHaveCount(4);
  await page.locator('[data-close-editor]').click();await tab(page,'stats');
  await page.locator('[data-stats-tab=calculator]').click();
  await page.locator('[data-pick-rank-exercise]').click();
  await page.locator('.sheet-backdrop.open #rankExerciseSearch').fill('plate loaded high row');
  await page.locator('.sheet-backdrop.open [data-rank-choice="Machine High Row"]').click();
  await page.locator('#rankCalculator [name=bodyweight]').fill('80');
  await page.locator('#rankCalculator [name=weight]').fill('80');
  await page.locator('#rankCalculator [name=reps]').fill('1');
  await page.getByRole('button',{name:'Calculate rank',exact:true}).click();
  await expect(page.locator('#rankCalculatorResult')).toContainText('Gold 4');
  await page.locator('[data-pick-rank-exercise]').click();
  await page.locator('.sheet-backdrop.open #rankExerciseSearch').fill('Plate-Loaded Triceps Dip');
  await page.locator('.sheet-backdrop.open [data-rank-choice="Plate-Loaded Triceps Dip"]').click();
  await page.locator('#rankCalculator [name=weight]').fill('40');
  await page.getByRole('button',{name:'Calculate rank',exact:true}).click();
  await expect(page.locator('#rankCalculatorResult')).toContainText('40 kg estimated 1RM');
  await expect(page.locator('#rankCalculatorResult')).toContainText('Gold 4');
});
