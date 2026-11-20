import {test, expect, open, sheetAction} from './helpers.js';

for (const glass of [false, true]) {
  test('round set controls in preview and active workouts with glass ' + glass, async ({page}) => {
    await page.route('**/cloud-config.js', route => route.fulfill({contentType:'text/javascript', body:'window.GYM_CLOUD_CONFIG={};'}));
    await page.addInitScript(glass => {
      localStorage.setItem('gymSettings', JSON.stringify({glassSurfaces:glass, clearBackgrounds:glass, surfaceAlpha:glass ? 0 : 100}));
      localStorage.setItem('gymCustomWorkouts', JSON.stringify({Pull:[{name:'Preacher Curl', sets:2, warmupSets:1}]}));
    }, glass);
    await open(page);
    await page.evaluate(async () => (await import('/js/ui/session.js')).openSession('Pull', '2099-01-01'));
    const session = page.locator('#session');
    const rows = [session.locator('.warmup-sets tr').nth(1), session.locator('.work-sets tr').nth(1)];
    for (const row of rows) {
      const checkbox = row.getByRole('checkbox');
      const circle = row.locator('.check > span');
      await expect(checkbox).toBeDisabled();
      await expect(checkbox).toHaveCSS('opacity', '0');
      await expect(circle).toHaveCSS('border-radius', '50%');
      await expect(circle).toHaveCSS('border-width', '2px');
      await expect(circle).not.toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
    }
    await page.goBack();
    await expect(session).toBeHidden();
    await page.evaluate(async () => (await import('/js/ui/session.js')).openSession('Pull'));
    await page.locator('#sessionMain').click();
    await sheetAction(page, 'Start workout');
    for (const row of rows) {
      const checkbox = row.getByRole('checkbox');
      const circle = row.locator('.check > span');
      await row.locator('.r').fill('8');
      await checkbox.check();
      await expect(checkbox).toBeChecked();
      await expect(circle).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(circle).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');
      await checkbox.uncheck();
      await expect(circle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(circle).not.toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
    }
  });
}
