import { test, expect, open, tab } from './helpers.js';

test.use({ isMobile: true, hasTouch: true, viewport: { width: 393, height: 851 } });

test.beforeEach(async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={};' }));
  await page.addInitScript(() => {
    if (localStorage.getItem('editorUxSeeded')) return;
    localStorage.setItem('editorUxSeeded', '1');
    localStorage.setItem('gymCustomWorkouts', JSON.stringify({ Test: [{ name: 'Dead Hang', cat: 'back', sets: 2, target: '45 s', rest: 135, note: '' }] }));
  });
  await open(page); await tab(page, 'plan');
  await page.locator('[data-edit=Test]').click();
});

const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('adding exercises by touch keeps the tapped search result at the same screen position', async ({ page }) => {
  await page.locator('#exSearch').fill('dip');
  for (let i = 0; i < 3; i++) {
    const pick = page.locator('#exResults [data-add]:not([aria-disabled=true])').first();
    await pick.scrollIntoViewIfNeeded(); await settle(page);
    const name = await pick.getAttribute('data-add');
    const before = await pick.evaluate(el => el.getBoundingClientRect().top);
    await pick.tap(); await expect(page.locator(`[data-ex="${name}"]`)).toHaveCount(1);
    await settle(page);
    const samePick = page.locator(`[data-add="${name}"]`);
    expect(Math.abs(await samePick.evaluate(el => el.getBoundingClientRect().top) - before)).toBeLessThanOrEqual(2);
    await expect(samePick).toBeFocused();
    await expect(page.locator('#exSearch')).toHaveValue('dip');
  }
});

test('keeping a remotely deleted routine preserves a focused rest choice and typed timed target', async ({ page }) => {
  async function deleteAndKeep() {
    await page.evaluate(async () => {
      delete (await import('/js/state.js')).state.workouts.Test;
      (await import('/js/ui/plan.js')).renderPlan();
    });
    await expect(page.locator('#toast')).toContainText('Test was deleted or renamed');
    await page.locator('#toast .toast-action').click();
    await expect(page.locator('#page-plan h1')).toHaveText('Test');
  }
  await page.locator('[data-field=rest]').focus();
  await deleteAndKeep();
  await expect(page.locator('[data-field=rest]')).toHaveText('2:15');
  await page.locator('[data-field=target]').fill('60');
  await deleteAndKeep();
  const ex = await page.evaluate(() => JSON.parse(localStorage.getItem('gymCustomWorkouts')).Test[0]);
  expect(ex).toMatchObject({ target: '60 s', rest: 135 });
});

test('the first exercise keeps an empty routine picker and its scrolled results anchored', async ({ page }) => {
  await page.evaluate(async () => {
    const { state, savePlan } = await import('/js/state.js');
    state.workouts.Test = []; savePlan();
  });
  const pick = page.locator('#exResults [data-add]').nth(8);
  // Centre it inside the nested results as well as the page, so the tap does
  // not first have to reveal a row covered by the fixed bottom navigation.
  await pick.evaluate(el => el.scrollIntoView({ block: 'center' })); await settle(page);
  const name = await pick.getAttribute('data-add');
  const before = await pick.evaluate(el => ({ top: el.getBoundingClientRect().top, inner: el.closest('.picks').scrollTop }));
  await pick.tap(); await expect(page.locator(`[data-ex="${name}"]`)).toHaveCount(1); await settle(page);
  const after = await page.locator(`[data-add="${name}"]`).evaluate(el => ({ top: el.getBoundingClientRect().top, inner: el.closest('.picks').scrollTop }));
  expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.inner - before.inner)).toBeLessThanOrEqual(2);
});

test('a background routine addition does not move the focused search or clear its query', async ({ page }) => {
  const search = page.locator('#exSearch');
  await search.fill('cable'); await search.scrollIntoViewIfNeeded(); await settle(page);
  const top = await search.evaluate(el => el.getBoundingClientRect().top);
  await page.evaluate(async () => {
    const { state, savePlan } = await import('/js/state.js');
    state.workouts.Test.push({ name: 'JM Press', cat: 'arms', sets: 2, target: '8–12', rest: 90, note: '' });
    savePlan();
  });
  await settle(page);
  expect(Math.abs(await search.evaluate(el => el.getBoundingClientRect().top) - top)).toBeLessThanOrEqual(2);
  await expect(search).toHaveValue('cable'); await expect(search).toBeFocused();
});

test('Order moves exercises by keyboard and touch while preserving their controls and identity', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Reorder Dead Hang', exact: true })).toBeDisabled();
  await page.evaluate(async () => {
    const { state, savePlan } = await import('/js/state.js');
    state.workouts.Test.push(...['Dips', 'Lat Pulldown'].map(name => ({ name, cat: 'back', sets: 2, target: '8–12', rest: 90, note: '' })));
    savePlan();
  });
  const order = page.getByRole('button', { name: 'Reorder Dead Hang', exact: true });
  await order.focus(); await settle(page);
  const top = await order.evaluate(el => el.getBoundingClientRect().top);
  await page.keyboard.press('Enter');
  const down = page.getByRole('option', { name: 'Move down After Dips', exact: true });
  await expect(down).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.locator('.ex-edit-head .row-main > b')).toHaveText(['Dips', 'Dead Hang', 'Lat Pulldown']);
  await expect(order).toBeFocused();
  await settle(page);
  expect(Math.abs(await order.evaluate(el => el.getBoundingClientRect().top) - top)).toBeLessThanOrEqual(2);
  await order.tap(); await page.getByRole('option', { name: 'Move up Before Dips', exact: true }).tap();
  await expect(page.locator('.ex-edit-head .row-main > b')).toHaveText(['Dead Hang', 'Dips', 'Lat Pulldown']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gymCustomWorkouts')).Test[0])).toMatchObject({ name: 'Dead Hang', target: '45 s', rest: 135, sets: 2 });
});

test('Add exercises shortcut reaches search in a long routine without discarding edits', async ({ page }) => {
  await page.evaluate(async () => {
    const { state, savePlan } = await import('/js/state.js');
    state.workouts.Test.push(...Array.from({ length: 8 }, (_, i) => ({ name: 'Custom ' + i, cat: 'other', sets: 2, target: '8–12', rest: 90, note: '' })));
    savePlan();
  });
  await page.locator('[data-ex="Dead Hang"] [data-field=note]').fill('Keep this seat setting');
  await page.locator('[data-jump-exercises]').click();
  await expect(page.locator('#exSearch')).toBeFocused();
  const box = await page.locator('#exSearch').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(80); expect(box.y + box.height).toBeLessThan(760);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gymCustomWorkouts')).Test[0].note)).toBe('Keep this seat setting');
});

test('Undo restores a custom timed target after a measurement change', async ({ page }) => {
  await page.locator('[data-field=measurement]').click();
  await page.getByRole('option', { name: 'Reps Count repetitions', exact: true }).click();
  await expect(page.locator('[data-field=target]')).toHaveValue('8–12');
  await page.locator('#toast .toast-action').click();
  await expect(page.locator('[data-field=measurement]')).toHaveText('Seconds');
  await expect(page.locator('[data-field=target]')).toHaveValue('45');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gymCustomWorkouts')).Test[0].target)).toBe('45 s');
});

test('measurement Undo cannot overwrite a subsequent target edit', async ({ page }) => {
  await page.locator('[data-field=measurement]').click();
  await page.getByRole('option', { name: 'Reps Count repetitions', exact: true }).click();
  await page.locator('[data-field=target]').fill('20');
  await page.locator('[data-field=target]').press('Tab');
  await page.locator('#toast .toast-action').click();
  await expect(page.locator('[data-field=measurement]')).toHaveText('Reps');
  await expect(page.locator('[data-field=target]')).toHaveValue('20');
  await expect(page.locator('#toast')).toContainText('Target changed since then');
});

test('an open Order picker does not overwrite a newer routine order', async ({ page }) => {
  await page.evaluate(async () => {
    const { state, savePlan } = await import('/js/state.js');
    state.workouts.Test.push(...['Dips', 'Lat Pulldown'].map(name => ({ name, cat: 'back', sets: 2, target: '8–12', rest: 90, note: '' })));
    savePlan();
  });
  await page.getByRole('button', { name: 'Reorder Dead Hang', exact: true }).click();
  await page.evaluate(async () => {
    const { state, savePlan } = await import('/js/state.js');
    state.workouts.Test.reverse(); savePlan();
  });
  await page.getByRole('option', { name: 'Move down After Dips', exact: true }).click();
  await expect(page.locator('.ex-edit-head .row-main > b')).toHaveText(['Lat Pulldown', 'Dips', 'Dead Hang']);
  await expect(page.locator('#toast')).toContainText('Routine changed. Choose its order again.');
});

test('custom exercise selection keeps the picker stable when its temporary result disappears', async ({ page }) => {
  await page.locator('#exSearch').fill('Unique seated curl');
  const custom = page.locator('[data-add-custom]');
  await custom.evaluate(el => el.scrollIntoView({ block: 'center' })); await settle(page);
  const top = await page.locator('.add-ex').evaluate(el => el.getBoundingClientRect().top);
  await custom.tap();
  await page.locator('.sheet-backdrop.open [data-cat=biceps]').click();
  await expect(page.locator('[data-ex="Unique seated curl"]')).toHaveCount(1); await settle(page);
  expect(Math.abs(await page.locator('.add-ex').evaluate(el => el.getBoundingClientRect().top) - top)).toBeLessThanOrEqual(2);
});
