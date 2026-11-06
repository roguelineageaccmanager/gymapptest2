import { test, expect, open, tab } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={};' }));
  await page.addInitScript(() => {
    if (localStorage.getItem('choiceTestSeeded')) return;
    localStorage.setItem('choiceTestSeeded', '1');
    localStorage.setItem('gymCustomWorkouts', JSON.stringify({ Holds: [{ name: 'Dead Hang', cat: 'back', sets: 2, target: '45 s', rest: 135, note: '' }] }));
  });
});

async function editor(page) {
  await open(page); await tab(page, 'plan');
  await page.locator('[data-edit="Holds"]').click();
}

test('themed choices preserve custom targets/rest, cancel safely and save through reload', async ({ page }) => {
  await editor(page);
  const rest = page.locator('[data-field=rest]'), measure = page.locator('[data-field=measurement]');
  await expect(page.locator('select')).toHaveCount(0);
  await expect(rest).toHaveText('2:15');
  await rest.click();
  const current = page.getByRole('option', { name: '2:15 min : sec', exact: true });
  await expect(current).toHaveAttribute('aria-selected', 'true');
  await expect(current).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('option', { name: '5:00 min : sec', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(rest).toBeFocused(); await expect(rest).toHaveText('2:15');
  await expect(rest).toHaveAttribute('aria-expanded', 'false');
  await rest.click(); await page.getByRole('option', { name: 'None No timer', exact: true }).click();
  await expect(rest).toHaveText('None'); await expect(rest).toBeFocused();
  await measure.click(); await page.getByRole('option', { name: 'Seconds Time each hold', exact: true }).click();
  await expect(page.locator('[data-field=target]')).toHaveValue('45');
  await measure.click();
  await expect(page.getByRole('option', { name: 'Seconds Time each hold', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('option', { name: 'Reps Count repetitions', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(measure).toHaveText('Reps'); await expect(measure).toBeFocused();
  await expect(page.locator('[data-field=target]')).toHaveValue('8–12');
  await page.reload(); await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  await tab(page, 'plan'); await page.locator('[data-edit="Holds"]').click();
  await expect(rest).toHaveText('None'); await expect(measure).toHaveText('Reps');
  await rest.click(); await page.goBack();
  await expect(page.locator('.sheet-backdrop.open')).toHaveCount(0);
  await expect(rest).toBeFocused(); await expect(page.locator('[data-close-editor]')).toBeVisible();
});

test('choice sheets fit small screens and use saved field, button and selected colors', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await editor(page);
  await page.evaluate(() => {
    const style = document.documentElement.style;
    for (const [key, value] of Object.entries({ '--field-bg': '#223344', '--control-bg': '#334455', '--button-text': '#aabbcc', '--selected-bg': '#445566', '--selected-ink': '#ddeeff' })) style.setProperty(key, value);
  });
  const rest = page.locator('[data-field=rest]');
  await expect(rest).toHaveCSS('background-color', 'rgb(34, 51, 68)');
  await rest.click();
  await expect(page.locator('.choice-option[aria-selected=true]')).toHaveCSS('background-color', 'rgb(68, 85, 102)');
  await expect(page.locator('.choice-option[aria-selected=true]')).toHaveCSS('color', 'rgb(221, 238, 255)');
  await expect(page.locator('.choice-option[aria-selected=false]').first()).toHaveCSS('background-color', 'rgb(51, 68, 85)');
  await expect(page.locator('.choice-option[aria-selected=false]').first()).toHaveCSS('color', 'rgb(170, 187, 204)');
  const dimensions = await page.locator('.choice-sheet').evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  await page.getByRole('option', { name: '5:00 min : sec', exact: true }).click();
  await expect(rest).toHaveText('5:00');
  await page.locator('#exEquipment').click();
  await page.getByRole('option', { name: 'Plate-loaded machine', exact: true }).click();
  await expect(page.locator('#exEquipment')).toHaveText('plate-loaded machine');
  await expect(page.locator('#exResults [data-add]')).toHaveCount(27);
});
