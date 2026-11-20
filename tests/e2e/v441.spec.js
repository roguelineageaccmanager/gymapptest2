import {test,expect,open,tab,createWorkout,scheduleToday,startTodayWorkout} from './helpers.js';

test('warm-ups sit above working controls and full-width workout actions never overlap',async({page})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={};'}));
 await open(page);await createWorkout(page,'Push',['Barbell Bench Press']);await page.locator('[data-edit=Push]').click();await page.getByRole('checkbox',{name:'Warm-up sets for Barbell Bench Press',exact:true}).check();
 const warm=await page.locator('.warmup-count').boundingBox(),work=await page.locator('.ex-edit-fields').boundingBox();expect(warm.y+warm.height).toBeLessThanOrEqual(work.y);
 await page.goBack();await scheduleToday(page,'Push');await tab(page,'today');await startTodayWorkout(page);
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
  await page.addInitScript(() => localStorage.setItem('gymSettings', JSON.stringify({ glassSurfaces: true, navOpacity: 85 })));
  const name = 'Saturday Full Body Workout';
  await open(page);
  await createWorkout(page, name, ['Barbell Bench Press', 'Smith Machine Incline Bench Press', 'Seated Leg Curl']);
  await scheduleToday(page, name);
  await tab(page, 'today');
  await startTodayWorkout(page);

  const header = page.locator('.session-top');
  const list = page.locator('#sessionList');
  await expect(header).toHaveCSS('border-radius', '22px');
  await expect(header).toHaveCSS('backdrop-filter', 'none');
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
  await expect(page.locator('#session').getByRole('progressbar', { name: 'Sets done' })).toHaveAttribute('aria-valuenow', '0');

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
  await expect(page.locator('#session').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');

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
  await expect(page.locator('#session').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const session = page.locator('#session');
  expect(await session.evaluate(root => {
    root.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
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

  await page.locator('#page-plan [data-open-settings]').click();
  const settingsHeader = page.locator('#page-settings .editor-top');
  await page.evaluate(() => window.scrollTo(0, 360));
  await expect(settingsHeader).toHaveCSS('position', 'relative');
  await expect.poll(async () => (await settingsHeader.boundingBox()).y).toBeLessThan(0);
  await page.goBack();

  await createWorkout(page, 'A long workout name', ['Barbell Bench Press', 'Leg Extension']);
  await page.locator('[data-edit="A long workout name"]').click();
  const banner = page.locator('#updateBanner');
  const editor = page.locator('.page.active .editor-top');
  await banner.evaluate(node => { node.hidden = false; });
  await page.evaluate(() => window.scrollTo(0, 240));
  await expect(banner).toHaveCSS('position', 'sticky');
  await expect(editor).toHaveCSS('position', 'relative');
  await expect(editor).toHaveCSS('border-radius', '0px');
  await expect.poll(async () => (await editor.boundingBox()).y).toBeLessThan(0);
  await banner.evaluate(node => { node.hidden = true; });
  await page.goBack();
  await expect(page.locator('[data-edit="A long workout name"]')).toBeVisible();
});

test('split-day and Train anyway use the themed workout picker with keyboard focus', async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.GYM_CLOUD_CONFIG={};',
  }));
  await page.setViewportSize({ width: 320, height: 620 });
  await open(page);
  await createWorkout(page, 'Legs', ['Leg Press']);
  const today = (new Date().getDay() + 6) % 7;
  const day = page.locator(`#page-plan [data-day="${today}"]`);
  const sheet = page.locator('.sheet-backdrop.open .choice-sheet');
  await day.click();
  const rest = sheet.getByRole('option', { name: 'Rest day', exact: true });
  const legs = sheet.getByRole('option', { name: 'Legs', exact: true });
  await expect(rest).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(legs).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(day).toHaveAccessibleName(/: Legs$/);
  await expect(day).toBeFocused();

  await day.click();
  await expect(legs).toHaveAttribute('aria-selected', 'true');
  await rest.click();
  await expect(day).toHaveAccessibleName(/: Rest$/);
  await tab(page, 'today');
  await page.getByRole('button', { name: 'Train anyway' }).click();
  await expect(legs).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#sessionTitle')).toHaveText('Legs');
  await expect(page.locator('#session')).toBeVisible();
  await page.getByRole('button', { name: 'Close workout' }).click();
  await expect(page.getByRole('button', { name: 'Train anyway' })).toBeFocused();
});

test('Progress preloads and incoming requests notify from Calendar', async ({ page }) => {
  const me = '00000000-0000-4000-8000-000000000001';
  const friend = '00000000-0000-4000-8000-000000000002';
  let incoming = false;
  let progressReads = 0;
  await page.clock.install();
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};',
  }));
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/progress_photos*', route => {
    progressReads++;
    return route.fulfill({ json: [] });
  });
  await page.route('**/rest/v1/friend_requests*', route => route.fulfill({ json: incoming ? [{
    id: 'request', requester_id: friend, target_id: me, requester: { username: 'blake' }, status: 'pending',
  }] : [] }));
  await open(page);
  await page.evaluate(async id => {
    const { account } = await import('/js/cloud/sync.js');
    const { supabase } = await import('/js/cloud/client.js');
    account.user = { id };
    account.ready = true;
    supabase.auth.getSession = async () => ({ data: { session: { user: { id }, access_token: 'mock' } } });
    window.dispatchEvent(new CustomEvent('gym:account'));
  }, me);
  await expect.poll(() => progressReads).toBe(1);
  await tab(page, 'calendar');
  incoming = true;
  await page.clock.fastForward(31000);
  await expect(page.locator('[data-page="crew"]')).toHaveAccessibleName('Friends, 1 new friend request');
  await expect(page.locator('#toast')).toContainText('Friend request from @blake');
  await expect(page.locator('#page-calendar')).toHaveClass(/active/);
  await tab(page, 'stats');
  await page.getByRole('tab', { name: 'Progress' }).click();
  await expect(page.getByText('No progress pictures yet.')).toBeVisible();
  expect(progressReads).toBe(1);
});

test('glass surfaces can be enabled and disabled independently of the bottom bar', async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={};',
  }));
  await open(page);
  await page.locator('#page-today [data-open-settings]').click();
  await page.getByRole('button', {name: 'Customize appearance'}).click();
  const card = page.locator('[data-key="appearance"]');
  const toggle = card.getByRole('checkbox', { name: 'Glass surfaces' });
  await expect(toggle).not.toBeChecked();
  const solid = await card.evaluate(el => getComputedStyle(el).backgroundColor);
  await toggle.check();
  await expect(page.locator('html')).toHaveAttribute('data-glass-surfaces', '');
  await expect(card).not.toHaveCSS('background-color', solid);
  await page.reload();
  await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  await page.locator('#page-today [data-open-settings]').click();
  await page.getByRole('button', {name: 'Customize appearance'}).click();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(card).toHaveCSS('background-color', solid);
  await toggle.check();
  await page.goBack();
  await tab(page, 'plan');
  const plan = page.locator('#page-plan');
  const streak = plan.locator('[data-open-streak]');
  const settings = plan.locator('[data-open-settings]');
  for (const shortcut of [streak, settings]) {
    await expect(shortcut).toHaveCSS('backdrop-filter', /blur\(12px\)/);
    await expect(shortcut).toHaveCSS('background-image', /linear-gradient/);
  }
  for (const row of [plan.locator('.plan-week'), plan.locator('.week-slot').first(), plan.locator('.rest-alert-option')]) {
    await expect(row).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(row).toHaveCSS('background-image', 'none');
  }
  await streak.click();
  const dialog = page.getByRole('dialog', { name: 'Your streak' });
  await expect(dialog).toHaveCSS('backdrop-filter', 'blur(12px)');
  await expect(dialog.locator('..')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.32)');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await plan.locator('.week-slot').first().click();
  await expect(page.locator('.choice-sheet')).toHaveCSS('backdrop-filter', 'blur(12px)');
});

test('workout header stays in place with glass surfaces enabled', async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={};',
  }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 540 });
  await page.addInitScript(() => localStorage.setItem('gymCustomWorkouts', JSON.stringify({
    Push: ['Barbell Bench Press', 'Smith Machine Incline Bench Press', 'Seated Leg Curl'].map(name => ({ name, sets: 2 })),
  })));
  await open(page);
  const todayHeader = page.locator('#page-today .top');
  await expect(todayHeader).toHaveCSS('background-image', 'none');
  await page.locator('#page-today [data-open-settings]').click();
  await page.getByRole('button', {name: 'Customize appearance'}).click();
  await page.getByRole('checkbox', { name: 'Glass surfaces' }).check();
  await expect(page.locator('#page-settings .editor-top')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  expect(await page.locator('#page-settings .editor-top').evaluate(el => getComputedStyle(el, '::before').backdropFilter)).toBe('none');
  await page.goBack();
  await page.goBack();
  await expect(todayHeader).toHaveCSS('background-image', 'none');
  await page.evaluate(async () => {
    const { addDays, ymd } = await import('/js/core/dates.js');
    const { openSession } = await import('/js/ui/session.js');
    openSession('Push', ymd(addDays(new Date(), 1)));
  });
  const header = page.locator('.session-top');
  const list = page.locator('#sessionList');
  const first = list.locator('.ex-card').first();
  await expect(header.locator('#sessionClockLabel')).toHaveText('Preview');
  await expect(header).toHaveCSS('backdrop-filter', 'blur(12px)');
  await expect(first).toHaveCSS('background-image', /linear-gradient/);
  const bounds = await header.boundingBox();
  await expect(header).toHaveCSS('border-radius', '22px');
  expect(bounds.x).toBeGreaterThan(0);
  expect(bounds.y).toBeGreaterThan(0);
  expect((await first.boundingBox()).y).toBeGreaterThanOrEqual(bounds.y + bounds.height);
  expect(await list.evaluate(node => { node.scrollTop = 100; return node.scrollTop; })).toBeGreaterThan(0);
  expect(await header.boundingBox()).toEqual(bounds);
});

test('Coming up groups days by Monday with no row dividers', async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={};',
  }));
  await page.clock.setFixedTime(new Date(2026, 10, 27, 12));
  await page.addInitScript(() => {
    localStorage.setItem('gymCustomWorkouts', JSON.stringify({ Push: [{ name: 'Barbell Bench Press', sets: 2 }] }));
    localStorage.setItem('gymPlanSchedule', JSON.stringify({ 0: 'Push' }));
  });
  await open(page);
  const weeks = page.locator('.up-weeks section');
  await expect(weeks.locator('h3')).toHaveText(['23 Nov – 29 Nov', '30 Nov – 6 Dec']);
  await expect(page.getByRole('heading', { name: 'Coming up' })).toHaveClass('sr-only');
  await expect(weeks.nth(1)).toHaveCSS('border-top-width', '1px');
  await expect(weeks.first().locator('.up-row')).toHaveCount(2);
  await expect(weeks.nth(1).locator('.up-row')).toHaveCount(5);
  for (const row of await weeks.locator('.up-row').all()) await expect(row).toHaveCSS('border-bottom-width', '0px');
  await page.locator('[data-more]').click();
  await expect(weeks).toHaveCount(4);
  await expect(weeks.locator('.up-row')).toHaveCount(21);
  await weeks.nth(1).locator('[data-preview="2026-11-30"]').click();
  await expect(page.locator('#sessionClockLabel')).toHaveText('Preview');
});
