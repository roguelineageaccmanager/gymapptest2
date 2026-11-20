import { exerciseFamily, sideLabel } from '../../js/domain/exercise-families.js';
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
    const family = exerciseFamily(name);
    if (family?.variants.length > 1) await page.locator('.sheet-backdrop.open').getByRole('option', { name: new RegExp('^' + sideLabel(family.variants.find(v => v.name === name), family)) }).click();
    await expect(page.locator(`[data-ex="${name}"] .stepper output`).first()).toHaveText('2');
  }
  const lateral = page.locator('[data-ex="Single-Arm Cable Lateral Raises"]');
  await lateral.locator('[data-field="warmup"]').check();
  await expect(lateral.locator('.warmup-count output')).toHaveText('1');
  await expect(lateral.locator('.ex-edit-fields .stepper output')).toHaveText('2');
  await page.locator('#exSearch').fill('plate loaded');
  await page.locator('#exEquipment').click();
  await page.getByRole('option', { name: 'Plate-loaded machine', exact: true }).click();
  await expect(page.locator('#exResults [data-add]')).toHaveCount(24);
  await expect(page.locator('[data-exercise-details], .exercise-instructions')).toHaveCount(0);
  await page.goBack();
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
    const family = exerciseFamily(name);
    if (family?.variants.length > 1) await page.locator('.sheet-backdrop.open').getByRole('option', { name: new RegExp('^' + sideLabel(family.variants.find(v => v.name === name), family)) }).click();
    await expect(page.locator(`[data-ex="${name}"] .ex-edit-fields .stepper output`)).toHaveText('2');
  }
  await expect(page.locator('[data-ex="Alternating Cable Shoulder Press"] [data-choice=variant]')).toContainText('One arm');
  await page.locator('#exSearch').fill('Bosu Ball Cable Crunch With Side Bends');
  await expect(page.locator('[data-add="Balance Trainer Cable Crunch With Side Bends"]')).toBeVisible();
  await page.locator('#exSearch').fill('Kettlebell Halo with Overhead Extension');
  await expect(page.locator('[data-exercise-details], .exercise-instructions')).toHaveCount(0);
  await page.goBack();
  await page.locator('[data-edit="Expanded library"]').click();
  await expect(page.locator('.ex-edit')).toHaveCount(5);
});


test('version choices support keyboard selection, cancellation and focus without descriptions',async({page})=>{
  await open(page);await tab(page,'plan');
  await page.getByRole('button',{name:'New workout',exact:true}).click();await fillPrompt(page,'Keyboard library');
  await page.locator('#exSearch').fill('Plate-Loaded Low Row');
  const pick=page.locator('[data-add="Plate-Loaded Low Row"]');
  await pick.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.sheet-backdrop.open [role=option]')).toHaveCount(2);
  await page.evaluate(() => {
    const back = history.back;
    history.back = () => {
      history.back = back;
      window.addEventListener('test:resume-history', () => back.call(history), { once: true });
    };
  });
  await page.keyboard.press('Escape');await expect(pick).toBeFocused();
  await page.keyboard.press('Enter');const both=page.getByRole('option',{name:'Both arms',exact:true});await expect(both).toBeFocused();
  await page.evaluate(() => new Promise(resolve => {
    window.addEventListener('popstate', resolve, { once: true });
    window.dispatchEvent(new Event('test:resume-history'));
  }));
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-ex="Plate-Loaded Low Row"]')).toHaveCount(1);
  await expect(page.locator('[data-exercise-details], .exercise-instructions')).toHaveCount(0);
});
