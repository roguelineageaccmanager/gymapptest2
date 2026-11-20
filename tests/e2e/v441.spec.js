import {test,expect,open,tab,createWorkout,scheduleToday,startTodayWorkout} from './helpers.js';

test('warm-ups sit above working controls and full-width workout actions never overlap',async({page})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={};'}));
 await open(page);await createWorkout(page,'Push',['Barbell Bench Press']);await page.locator('[data-edit=Push]').click();await page.getByRole('checkbox',{name:'Warm-up sets for Barbell Bench Press',exact:true}).check();
 const warm=await page.locator('.warmup-count').boundingBox(),work=await page.locator('.ex-edit-fields').boundingBox();expect(warm.y+warm.height).toBeLessThanOrEqual(work.y);
 await page.locator('[data-close-editor]').click();await scheduleToday(page,'Push');await tab(page,'today');await startTodayWorkout(page);
 for(const width of [320,412]){await page.setViewportSize({width,height:839});const a=await page.locator('#sessionMain').boundingBox(),b=await page.locator('#sessionCancel').boundingBox();expect(Math.abs(a.width-b.width)).toBeLessThan(1);expect(Math.abs(a.x-b.x)).toBeLessThan(1);expect(b.y-a.y-a.height).toBeGreaterThanOrEqual(7);expect(b.x+b.width).toBeLessThanOrEqual(width);}
 await page.screenshot({path:test.info().outputPath('workout-actions.png'),animations:'disabled'});
});

test('the floating workout header stays centered and visible while logging sets', async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.GYM_CLOUD_CONFIG={};',
  }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 600 });
  const name = 'Saturday Full Body Workout';
  await open(page);
  await createWorkout(page, name, ['Barbell Bench Press', 'Smith Machine Incline Bench Press', 'Seated Leg Curl']);
  await scheduleToday(page, name);
  await tab(page, 'today');
  await startTodayWorkout(page);

  const header = page.locator('.session-top');
  const list = page.locator('#sessionList');
  await expect(header).toHaveCSS('border-radius', '22px');
  const initial = await header.boundingBox();
  expect(initial.y).toBeGreaterThanOrEqual(8);
  expect(initial.x).toBeGreaterThan(0);
  expect(initial.x * 2 + initial.width).toBeCloseTo(320, 0);
  expect(await list.evaluate(el => {
    el.scrollTop = el.scrollHeight;
    return el.scrollTop;
  })).toBeGreaterThan(0);
  expect(await header.boundingBox()).toEqual(initial);
  await expect(header.getByRole('button', { name: 'Close workout' })).toBeInViewport();
  await expect(header.getByRole('button', { name: 'Edit plan' })).toBeInViewport();
  await expect(header.locator('#sessionClock')).toBeInViewport();
  await expect(header.getByRole('progressbar', { name: 'Sets done' })).toHaveAttribute('aria-valuenow', '0');

  const workoutTitle = header.getByRole('heading', { name });
  const exerciseTitle = list.getByRole('heading', { name: 'Smith Machine Incline Bench Press' });
  for (const title of [workoutTitle, exerciseTitle]) {
    expect(await title.evaluate(el => el.clientHeight > parseFloat(getComputedStyle(el).lineHeight))).toBe(true);
    expect(await title.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true);
  }
  const titleBox = await workoutTitle.boundingBox();
  const editBox = await header.getByRole('button', { name: 'Edit plan' }).boundingBox();
  expect(editBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
  expect(await list.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 1000, height: 760 });
  const wide = await header.boundingBox();
  expect(wide.width).toBeLessThanOrEqual(640);
  expect(wide.x * 2 + wide.width).toBeCloseTo(1000, 0);

  const weight = list.getByRole('spinbutton', { name: 'Barbell Bench Press, set 1, weight in kg', exact: true });
  await page.setViewportSize({ width: 320, height: 360 });
  await weight.fill('40');
  await expect(weight).toBeInViewport();
  await expect(header).toBeInViewport({ ratio: 1 });
});

test('workout motion starts on open and a set logs with either motion preference', async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.GYM_CLOUD_CONFIG={};',
  }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  await createWorkout(page, 'Push', ['Barbell Bench Press']);
  await scheduleToday(page, 'Push');
  await tab(page, 'today');
  await startTodayWorkout(page);
  const header = page.locator('.session-top');
  await expect(header).toHaveCSS('animation-name', 'workout-header-arrive');

  const rows = page.locator('#sessionList .work-sets tbody tr');
  const first = rows.first();
  await first.locator('.w').fill('40');
  await first.locator('.r').fill('10');
  expect(await first.locator('.d').evaluate(checkbox => {
    checkbox.click();
    return checkbox.closest('.ex-card').querySelector('.ex-count').getAnimations().filter(animation => animation.constructor === Animation).length;
  })).toBe(1);
  await expect(header.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(header).toHaveCSS('animation-name', 'none');
  await expect.poll(() => page.locator('#sessionList .ex-count').evaluate(node => node.getAnimations().length)).toBe(0);
  const second = rows.nth(1);
  await second.locator('.w').fill('40');
  await second.locator('.r').fill('9');
  expect(await second.locator('.d').evaluate(checkbox => {
    checkbox.click();
    return checkbox.closest('.ex-card').querySelector('.ex-count').getAnimations().filter(animation => animation.constructor === Animation).length;
  })).toBe(0);
  await expect(header.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const session = page.locator('#session');
  expect(await session.evaluate(root => {
    root.querySelector('#sessionBack').click();
    return root.hidden && root.inert &&
      root.getAnimations().some(animation => animation.transitionProperty === 'opacity');
  })).toBe(true);
  await expect(session).toBeHidden();
  await page.locator('#activeBar button').click();
  await expect(rows.first().locator('.d')).toBeChecked();
  await expect(rows.nth(1).locator('.d')).toBeChecked();
});

test('flat page headers leave room for a pinned update banner', async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.GYM_CLOUD_CONFIG={};',
  }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 620 });
  await open(page);
  for (const name of ['today', 'calendar', 'stats', 'crew', 'plan']) {
    await tab(page, name);
    const header = page.locator('.page.active .top');
    await expect(header).toHaveCSS('border-radius', '0px');
    const box = await header.boundingBox();
    expect(box.x).toBeGreaterThan(0);
    expect(box.x + box.width).toBeLessThan(320);
  }

  await createWorkout(page, 'A long workout name', ['Barbell Bench Press', 'Leg Extension']);
  await page.locator('[data-edit="A long workout name"]').click();
  const banner = page.locator('#updateBanner');
  const editor = page.locator('.page.active .editor-top');
  await banner.evaluate(node => { node.hidden = false; });
  await page.evaluate(() => window.scrollTo(0, 240));
  await expect.poll(async () => {
    const [panel, update] = await Promise.all([editor.boundingBox(), banner.boundingBox()]);
    return panel.y - (update.y + update.height);
  }).toBeGreaterThanOrEqual(7);
  for (const panel of [editor, banner]) {
    await expect(panel).toHaveCSS('position', 'sticky');
    await expect(panel).toHaveCSS('border-radius', '0px');
  }

  await banner.evaluate(node => { node.hidden = true; });
  await expect.poll(async () => (await editor.boundingBox()).y).toBeCloseTo(10, 0);
  await expect(editor.getByRole('button', { name: 'Back to my plan' })).toBeInViewport();
});
