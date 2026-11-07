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

test('numbered handles reorder by keyboard, retain exercise data and persist after reopening', async ({ page }) => {
  await expect(page.locator('[data-ex-position]')).toHaveText(['1']);
  await expect(page.locator('[data-order], .order-control')).toHaveCount(0);
  await page.evaluate(async () => {
    const { state, savePlan } = await import('/js/state.js');
    state.workouts.Test.push(...['Dips', 'Lat Pulldown'].map(name => ({ name, cat: 'back', sets: 2, target: '8–12', rest: 90, note: '' })));
    savePlan();
  });
  const handle = page.locator('[data-ex="Dead Hang"] [data-drag]');
  await expect(page.locator('[data-ex-position]')).toHaveText(['1', '2', '3']);
  await handle.focus(); await settle(page);
  const top = await handle.evaluate(el => el.getBoundingClientRect().top);
  await handle.press('Alt+ArrowDown');
  await expect(page.locator('.ex-edit-head .row-main > b')).toHaveText(['Dips', 'Dead Hang', 'Lat Pulldown']);
  await expect(page.locator('[data-ex-position]')).toHaveText(['1', '2', '3']);
  await expect(handle).toBeFocused();
  await expect(handle).toHaveAccessibleName(/Exercise 2: Dead Hang/);
  await settle(page);
  expect(Math.abs(await handle.evaluate(el => el.getBoundingClientRect().top) - top)).toBeLessThanOrEqual(2);
  await handle.press('Alt+ArrowUp'); await handle.press('Alt+ArrowUp');
  await expect(page.locator('.ex-edit-head .row-main > b')).toHaveText(['Dead Hang', 'Dips', 'Lat Pulldown']);
  await page.locator('[data-ex="Dips"] [data-remove]').tap();
  await expect(page.locator('[data-ex-position]')).toHaveText(['1', '2']);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gymCustomWorkouts')).Test);
  expect(saved[0]).toMatchObject({ name: 'Dead Hang', target: '45 s', rest: 135, sets: 2 });
  await page.reload(); await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  await tab(page, 'plan'); await page.locator('[data-edit=Test]').tap();
  await expect(page.locator('[data-ex-position]')).toHaveText(['1', '2']);
  await expect(page.locator('.ex-edit-head .row-main > b')).toHaveText(['Dead Hang', 'Lat Pulldown']);
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

test('numbered handles follow an externally changed routine without opening an Order picker', async ({ page }) => {
  await page.evaluate(async () => {
    const { state, savePlan } = await import('/js/state.js');
    state.workouts.Test.push(...['Dips', 'Lat Pulldown'].map(name => ({ name, cat: 'back', sets: 2, target: '8–12', rest: 90, note: '' })));
    savePlan();
  });
  const handle = page.locator('[data-ex="Dead Hang"] [data-drag]');
  await handle.focus();
  await page.evaluate(async () => {
    const { state, savePlan } = await import('/js/state.js');
    state.workouts.Test.reverse(); savePlan();
  });
  await expect(handle).toBeFocused();
  await expect(handle).toHaveAccessibleName(/Exercise 3: Dead Hang/);
  await handle.press('Alt+ArrowUp');
  await expect(page.locator('.ex-edit-head .row-main > b')).toHaveText(['Lat Pulldown', 'Dead Hang', 'Dips']);
  await expect(page.locator('[data-ex-position]')).toHaveText(['1', '2', '3']);
  await expect(page.locator('.sheet-backdrop.open')).toHaveCount(0);
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
