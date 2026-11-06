import { test, expect, open, tab, fillPrompt } from './helpers.js';

test('catalogue variants save and reopen with two working sets per side and separate warm-ups', async ({ page }) => {
  await open(page);
  await tab(page, 'plan');
  await page.getByRole('button', { name: 'New workout', exact: true }).click();
  await fillPrompt(page, 'Catalogue test');
  const names = ['Single-Arm Cable Lateral Raises', 'Single-Arm Tricep Pushdowns', 'Plate-Loaded Row', 'Plate-Loaded Low Row', 'Plate-Loaded Pulldown', 'JM Press'];
  for (const name of names) {
    await page.locator('#exSearch').fill(name);
    await page.locator(`[data-add="${name}"]`).click();
    await expect(page.locator(`[data-ex="${name}"] .stepper output`).first()).toHaveText('2');
  }
  const lateral = page.locator('[data-ex="Single-Arm Cable Lateral Raises"]');
  await lateral.locator('[data-field="warmup"]').check();
  await expect(lateral.locator('.warmup-count output')).toHaveText('1');
  await expect(lateral.locator('.ex-edit-fields .stepper output')).toHaveText('2');
  await page.locator('#exSearch').fill('plate loaded');
  await page.locator('#exEquipment').selectOption('plate-loaded machine');
  await expect(page.locator('#exResults [data-add]')).toHaveCount(7);
  await page.getByRole('button', { name: 'Details for Plate-Loaded Low Row', exact: true }).click();
  await expect(page.locator('.sheet-backdrop.open .exercise-instructions')).toContainText('chest supported');
  await expect(page.locator('.sheet-backdrop.open .exercise-placeholder')).toBeVisible();
  await page.locator('.sheet-backdrop.open [data-sheet-close]').first().click();
  await page.locator('[data-close-editor]').click();
  await page.reload();
  await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  await tab(page, 'plan');
  await page.locator('[data-edit="Catalogue test"]').click();
  await expect(page.locator('.ex-edit')).toHaveCount(names.length);
  for (const name of names) await expect(page.locator(`[data-ex="${name}"] .ex-edit-fields .stepper output`)).toHaveText('2');
  await expect(lateral.locator('.warmup-count output')).toHaveText('1');
});


test('large catalogue searches specialised movements, aliases and neck metadata', async ({ page }) => {
  await open(page);
  await tab(page, 'plan');
  await page.getByRole('button', { name: 'New workout', exact: true }).click();
  await fillPrompt(page, 'Expanded library');
  const names = ['Alternating Cable Shoulder Press', '90/90 Hamstring', 'One-Arm Kettlebell Clean and Jerk', 'Neck-SMR', 'Kettlebell Halo with Overhead Extension'];
  for (const name of names) {
    await page.locator('#exSearch').fill(name);
    await page.locator(`[data-add="${name}"]`).click();
    await expect(page.locator(`[data-ex="${name}"] .ex-edit-fields .stepper output`)).toHaveText('2');
  }
  await expect(page.locator('[data-ex="Alternating Cable Shoulder Press"] [data-field="unilateral"]')).toBeChecked();
  await page.locator('#exSearch').fill('Bosu Ball Cable Crunch With Side Bends');
  await expect(page.locator('[data-add="Balance Trainer Cable Crunch With Side Bends"]')).toBeVisible();
  await page.locator('#exSearch').fill('Kettlebell Halo with Overhead Extension');
  await page.getByRole('button', { name: 'Details for Kettlebell Halo with Overhead Extension', exact: true }).click();
  await expect(page.locator('.sheet-backdrop.open .exercise-instructions li').first()).toBeVisible();
  await expect(page.locator('.sheet-backdrop.open .exercise-placeholder')).toBeVisible();
  await page.locator('.sheet-backdrop.open [data-sheet-close]').first().click();
  await page.locator('[data-close-editor]').click();
  await page.locator('[data-edit="Expanded library"]').click();
  await expect(page.locator('.ex-edit')).toHaveCount(5);
});
