import { test, expect, open, tab, createWorkout, scheduleToday, startTodayWorkout, sheetAction, newPhone } from './helpers.js';

test('community chat connects two users, preserves failed drafts and keeps keyboard actions visible', async ({ page, browser }) => {
  const first = '00000000-0000-4000-8000-000000000001', second = '00000000-0000-4000-8000-000000000002';
  const ctx = await newPhone(browser), other = await ctx.newPage();
  let rows = [], fail = false;
  async function setup(p, uid, username) {
    await p.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:location.origin,anonKey:"mock-key"};' }));
    await p.route('**/rest/v1/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
    await p.route('**/rest/v1/rpc/community_chat', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify([...rows].reverse()) }));
    await p.route('**/rest/v1/rpc/send_community_message', r => {
      if (fail) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Wait a moment before sending more messages.' }) });
      const body = r.request().postDataJSON();
      expect(r.request().headers().authorization).toBe('Bearer chat-' + uid);
      if (!rows.some(m => m.id === body.message_id)) rows.push({ id: body.message_id, user_id: uid, username, body: body.message_body, created_at: new Date().toISOString() });
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify(body.message_id) });
    });
    await p.route('**/rest/v1/community_messages*', r => {
      const id = new URL(r.request().url()).searchParams.get('id').slice(3); rows = rows.filter(m => m.id !== id || m.user_id !== uid);
      return r.fulfill({ status: 204 });
    });
    await open(p, p === page ? '/' : page.url());
    await p.evaluate(async ({ uid, username }) => {
      const { account } = await import('/js/cloud/sync.js'), { supabase } = await import('/js/cloud/client.js');
      account.user = { id: uid }; account.profile = { username }; account.ready = true;
      supabase.auth.getSession = async () => ({ data: { session: { user: { id: uid }, access_token: 'chat-' + uid } } });
      supabase.channel = () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} });
    }, { uid, username });
    await tab(p, 'crew');
    await expect(p.locator('[data-crew-tab]')).toHaveText(['Leaderboard', 'Friends', 'Gym dates']);
    await expect(p.locator('#crew-tab-ranking')).toHaveAttribute('aria-selected', 'true');
    await p.locator('#crew-tab-dates').click();
    await expect(p.locator('#chatRoom')).toBeVisible();
    await expect(p.locator('[data-quick]')).toHaveCount(0);
  }
  await setup(page, first, 'avery'); await setup(other, second, 'blake');
  await page.locator('#chatInput').fill('<img src=x> Gym at six?'); await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.chat-message')).toContainText('Gym at six?');
  await other.evaluate(async () => (await import('/js/ui/chat.js')).loadChat());
  await expect(other.locator('.chat-message')).toContainText('@avery');
  await expect(other.locator('.chat-message img')).toHaveCount(0);
  fail = true;
  await other.locator('#chatInput').fill('See you there'); await other.getByRole('button', { name: 'Send message' }).click();
  await expect(other.locator('#chatError')).toContainText('Wait a moment');
  await expect(other.locator('#chatInput')).toHaveValue('See you there');
  fail = false; await other.getByRole('button', { name: 'Send message' }).click();
  await expect(other.locator('.chat-message.mine')).toContainText('See you there');
  await page.evaluate(async () => (await import('/js/ui/chat.js')).loadChat());
  await expect(page.locator('.chat-message').last()).toContainText('@blake');
  await expect(page.locator('.chat-message').last().locator('[data-delete-message]')).toHaveCount(0);
  await other.locator('[data-delete-message]').click(); await expect(other.locator('.chat-message.mine')).toHaveCount(0);
  await test.info().attach('Gym chat', { body: await page.screenshot(), contentType: 'image/png' });
  await page.setViewportSize({ width: 393, height: 400 }); await page.locator('#chatInput').focus();
  await expect.poll(() => page.locator('#chatInput').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  expect(await page.getByRole('button', { name: 'Send message' }).evaluate(el => el.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
});

test('ongoing workout status follows real sessions and rest timers save per account', async ({ page }) => {
  await page.addInitScript(() => {
    window.statusCalls = []; window.statusOpen = null;
    const fetch = window.fetch;
    window.fetch = (url, options) => String(url).startsWith('https://api.github.com/')
      ? Promise.resolve(new Response(JSON.stringify({ name: 'Gym Tracker v99.0.0 (build 99999)' }), { headers: { 'Content-Type': 'application/json' } }))
      : fetch(url, options);
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      App: { getInfo: async () => ({ version: '99.0.0', build: '99999' }), addListener: () => {} },
      WorkoutStatus: {
        addListener: async (event, callback) => { window.statusOpen = callback; },
        requestPermission: async () => { window.statusCalls.push('permission'); },
        update: async status => { window.statusCalls.push(status); },
        stop: async () => { window.statusCalls.push('stop'); },
      },
    } };
  });
  await open(page);
  await createWorkout(page, 'Push', ['Dips']); await scheduleToday(page, 'Push'); await tab(page, 'today');
  await page.locator('#startToday').click();
  expect(await page.evaluate(() => window.statusCalls.filter(x => typeof x === 'object').length)).toBe(0);
  await page.locator('#sessionMain').click(); await sheetAction(page, 'Start workout');
  await expect.poll(() => page.evaluate(() => window.statusCalls.includes('permission'))).toBe(true);
  await page.locator('.ex-card .d').first().check();
  await expect(page.locator('#restBar')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.statusCalls.filter(x => typeof x === 'object').at(-1)?.restUntil > Date.now())).toBe(true);
  await page.locator('#sessionBack').click();
  await page.evaluate(() => window.statusOpen());
  await expect(page.locator('#session')).toBeVisible();
  await expect(page.locator('#restBar')).toBeVisible();
  await page.locator('#sessionBack').click();
  await page.locator('.page.active [data-open-settings]').click();
  await page.locator('[data-rest-timers]').uncheck();
  await expect.poll(() => page.evaluate(() => window.statusCalls.filter(x => typeof x === 'object').at(-1)?.restUntil)).toBe(0);
  await page.reload(); await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  await page.locator('.page.active [data-open-settings]').click();
  await expect(page.locator('[data-rest-timers]')).not.toBeChecked();
  await page.evaluate(() => window.statusOpen());
  await expect(page.locator('#restBar')).toBeHidden();
  await page.locator('.ex-card .d').nth(1).check();
  await expect(page.locator('#restBar')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.statusCalls.filter(x => typeof x === 'object').at(-1)?.done)).toBe(2);
  await page.locator('#sessionCancel').click(); await sheetAction(page, 'Cancel workout');
  await expect.poll(() => page.evaluate(() => window.statusCalls.at(-1))).toBe('stop');
  const accounts = await page.evaluate(async () => {
    const { activateAccountSettings, state, saveSettings } = await import('/js/state.js');
    activateAccountSettings('timer-a'); state.settings.restTimers = false; saveSettings();
    activateAccountSettings('timer-b'); const other = state.settings.restTimers !== false;
    activateAccountSettings('timer-a'); return { other, original: state.settings.restTimers };
  });
  expect(accounts).toEqual({ other: true, original: false });
});

test.beforeEach(async ({ page }) => {
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {};' }));
});

test('friends manage all or individual routine sharing and exercise suggestions avoid native popups', async ({ page }) => {
  const id = '00000000-0000-4000-8000-000000000001'; let shares = [];
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:location.origin,anonKey:"mock-key"};' }));
  await page.route('**/rest/v1/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/shared_workouts*', r => {
    const request = r.request();
    if (request.method() === 'POST') { shares.push({ ...request.postDataJSON(), id: crypto.randomUUID(), created_at: new Date().toISOString() }); return r.fulfill({ status: 201, body: '' }); }
    if (request.method() === 'DELETE') { const remove = new URL(request.url()).searchParams.get('id').slice(3); shares = shares.filter(s => s.id !== remove); return r.fulfill({ status: 204 }); }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(shares) });
  });
  await open(page);
  await createWorkout(page, 'Push', ['Dips']); await createWorkout(page, 'Pull', ['Lat Pulldown']);
  await page.evaluate(async uid => {
    const { account } = await import('/js/cloud/sync.js'), { supabase } = await import('/js/cloud/client.js'); account.user = { id: uid, email: 'local@example.test' }; account.profile = { username: 'avery' }; account.ready = true;
    supabase.auth.getSession = async () => ({ data: { session: { user: { id: uid }, access_token: 'routine-test-token' } } });
    supabase.channel = () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} });
  }, id);
  await tab(page, 'crew'); await page.locator('[data-crew-tab="friends"]').click();
  await page.locator('[data-manage-routine-sharing]').click();
  await page.locator('[data-share-all]').check(); await sheetAction(page, 'Save sharing');
  await expect.poll(() => shares.length).toBe(2);
  await expect(page.locator('[data-key="shared-list"]')).toContainText('Push');
  await page.locator('[data-manage-routine-sharing]').click();
  await page.locator('[data-share-routine="Pull"]').uncheck(); await sheetAction(page, 'Save sharing');
  await expect.poll(() => shares.map(s => s.title)).toEqual(['Push']);
  await page.locator('[data-crew-tab="dates"]').click(); await expect(page.locator('[data-key="shared-title"]')).toHaveCount(0);
  await page.locator('.page.active [data-open-settings]').click();
  await page.locator('#exerciseBoardName').fill('Dip');
  await expect(page.locator('#exerciseBoardName')).not.toHaveAttribute('list');
  await page.locator('[data-board-suggestion="Dips"]').click();
  await expect(page.locator('[data-key="exercise-board-list"]')).toContainText('Dips');
});

test('friends keep next workouts beside shared routines while leaderboard opens first', async ({ page }) => {
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:location.origin,anonKey:"mock-key"};' }));
  await page.route('**/rest/v1/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/rpc/friend_next_workouts', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ user_id: '00000000-0000-4000-8000-000000000002', username: 'blake', workout_name: 'Pull', workout_date: new Date().toLocaleDateString('en-CA') }]) }));
  await open(page);
  await page.evaluate(async () => {
    const { account } = await import('/js/cloud/sync.js'); account.user = { id: '00000000-0000-4000-8000-000000000001' }; account.ready = true;
  });
  await tab(page, 'crew');
  await expect(page.locator('#crew-tab-ranking')).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-crew-tab="friends"]').click();
  await expect(page.locator('.next-workouts')).toContainText('@blake');
  await expect(page.locator('.next-workouts')).toContainText('Pull');
  await expect(page.locator('[data-crew-tab]')).toHaveCount(3);
});

test('keyboard-sized viewport keeps dialog inputs and actions visible', async ({ page }) => {
  await open(page); await tab(page, 'plan');
  await page.getByRole('button', { name: 'New workout', exact: true }).click();
  const input = page.locator('.sheet-backdrop.open input[name=value]');
  await input.focus();
  await page.setViewportSize({ width: 393, height: 400 });
  await input.fill('Keyboard test');
  await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--view-height')))).toBeLessThanOrEqual(400);
  expect(await input.evaluate(el => el.getBoundingClientRect().bottom <= (visualViewport?.height || innerHeight))).toBe(true);
  const save = page.locator('.sheet-backdrop.open [type=submit]');
  expect(await save.evaluate(el => el.getBoundingClientRect().bottom <= (visualViewport?.height || innerHeight))).toBe(true);
  await save.click();
  await expect(page.locator('#page-plan h1')).toHaveText('Keyboard test');
});

test('complete themes can be saved, switched and restored after reload', async ({ page }) => {
  await open(page); await page.locator('.page.active [data-open-settings]').click();
  await expect(page.locator('[data-theme-set]')).toHaveCount(5);
  await expect(page.locator('.accent-options')).not.toHaveAttribute('open');
  await page.locator('[data-theme-set="icy-blue"]').click();
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(8, 18, 28)');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gymSettings')).backgroundColor)).toBe('#08121c');
  await page.locator('[data-save-theme]').click();
  await page.locator('.sheet-backdrop.open input[name=value]').fill('My ice'); await sheetAction(page, 'Save');
  await page.locator('[data-theme-set="baby-blue"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'My ice', exact: true }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
  await page.reload(); await page.locator('.page.active [data-open-settings]').click();
  await expect(page.getByRole('button', { name: 'My ice', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gymSettings')).backgroundColor)).toBe('#08121c');
});

test('saved themes share with everyone and gallery themes preserve training settings', async ({ page }) => {
  const me = '00000000-0000-4000-8000-000000000001', friend = '00000000-0000-4000-8000-000000000002';
  let sent = null;
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:location.origin,anonKey:"mock-key"};' }));
  await page.route('**/rest/v1/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/friend_requests*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'request', requester_id: me, target_id: friend, status: 'accepted', requester: { username: 'avery' }, target: { username: 'blake' } }]) }));
  await page.route('**/rest/v1/shared_themes*', r => {
    if (r.request().method() === 'POST') { sent = r.request().postDataJSON(); return r.fulfill({ status: 201, body: '' }); }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: '00000000-0000-4000-8000-000000000003', owner_id: friend, recipient_id: me, name: 'Blake blue', owner: { username: 'blake' }, appearance: { theme: { base: 'dark', preset: 'custom', color: '#aabbff' }, buttonColor: '#112244', weightStep: 999 } }]) });
  });
  await page.route('**/rest/v1/rpc/community_themes', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: '00000000-0000-4000-8000-000000000003', owner_id: friend, recipient_id: null, name: 'Blake blue', username: 'blake', appearance: { theme: { base: 'dark', preset: 'custom', color: '#aabbff' }, buttonColor: '#112244', weightStep: 999 } }]) }));
  await open(page);
  await page.evaluate(async uid => {
    const { account } = await import('/js/cloud/sync.js'), { supabase } = await import('/js/cloud/client.js');
    account.user = { id: uid, email: 'local@example.test' }; account.profile = { username: 'avery' }; account.ready = true;
    supabase.auth.getSession = async () => ({ data: { session: { user: { id: uid }, access_token: 'theme-test-token' } } });
    supabase.channel = () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} });
    const { state } = await import('/js/state.js'); state.settings.weightStep = 2.5;
  }, me);
  await page.locator('.page.active [data-open-settings]').click();
  await expect(page.getByRole('heading', { name: 'Blocked people' })).toHaveCount(0);
  await page.locator('[data-theme-set="icy-blue"]').click(); await page.locator('[data-save-theme]').click();
  await page.locator('.sheet-backdrop.open input[name=value]').fill('Ice for Blake'); await sheetAction(page, 'Save');
  await page.getByRole('button', { name: 'Share Ice for Blake', exact: true }).click();
  await sheetAction(page, 'Share with everyone');
  await expect.poll(() => sent?.owner_id).toBe(me); expect(sent.recipient_id).toBeNull(); expect(sent.owner_id).toBe(me);
  expect(sent.appearance.weightStep).toBeUndefined();
  await page.locator('[data-close-settings]').click(); await tab(page, 'crew');
  await page.locator('[data-crew-tab="friends"]').click();
  await expect(page.locator('[data-crew-tab="friends"]')).toHaveCSS('border-radius', '0px');
  await page.locator('[data-unfriend]').click();
  await expect(page.locator('.sheet-backdrop.open')).not.toContainText('block'); await sheetAction(page, 'Cancel');
  await page.locator('[data-use-shared-theme]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gymSettings')).weightStep)).toBe(2.5);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gymSettings')).buttonColor)).toBe('#112244');
});

test('account profile pictures crop, display for friends and can be removed', async ({ page }) => {
  const id = '00000000-0000-4000-8000-000000000001', friend = '00000000-0000-4000-8000-000000000002';
  let image = null;
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:location.origin,anonKey:"mock-key"};' }));
  await page.route('**/rest/v1/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/friend_requests*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'request', requester_id: id, target_id: friend, status: 'accepted', requester: { username: 'avery' }, target: { username: 'blake' } }]) }));
  await page.route('**/rest/v1/profile_pictures*', r => {
    if (r.request().method() === 'POST') { const data = r.request().postDataJSON(); expect(data.user_id).toBe(id); image = data.image_data; return r.fulfill({ status: 201, body: '' }); }
    if (r.request().method() === 'DELETE') { image = null; return r.fulfill({ status: 204 }); }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(image ? [{ user_id: id, image_data: image }, { user_id: friend, image_data: image }] : []) });
  });
  await open(page);
  await page.evaluate(async uid => {
    const { account } = await import('/js/cloud/sync.js'), { supabase } = await import('/js/cloud/client.js');
    account.user = { id: uid, email: 'local@example.test' }; account.profile = { username: 'avery' }; account.ready = true;
    supabase.auth.getSession = async () => ({ data: { session: { user: { id: uid }, access_token: 'picture-test-token' } }, error: null });
  }, id);
  await page.locator('.page.active [data-open-settings]').click();
  await page.locator('[data-profile-picture-file]').setInputFiles('icon-192.png');
  await expect(page.locator('.account-identity .avatar img')).toBeVisible();
  expect(image).toMatch(/^data:image\/jpeg;base64,/);
  expect(image.length).toBeLessThan(100000);
  await expect.poll(() => page.locator('.account-identity img').evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([192, 192]);
  await page.locator('[data-close-settings]').click();
  await tab(page, 'crew');
  await page.locator('[data-crew-tab="friends"]').click();
  await expect(page.locator('[data-key="friend-request"] .avatar img')).toBeVisible();
  await page.locator('.page.active [data-open-settings]').click();
  await page.locator('[data-remove-profile-picture]').click();
  await expect(page.locator('.account-identity img')).toHaveCount(0);
  expect(image).toBeNull();
  await page.locator('[data-profile-picture-file]').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg></svg>') });
  await expect(page.locator('#toast')).toContainText('JPEG, PNG or WebP');
  expect(image).toBeNull();
  await page.evaluate(async () => {
    const { account } = await import('/js/cloud/sync.js'); account.user = { id: '00000000-0000-4000-8000-000000000003' };
    const { profilePicture } = await import('/js/cloud/profile-pictures.js');
    if (profilePicture('00000000-0000-4000-8000-000000000002')) throw new Error('Picture cache leaked across accounts');
  });
});

test('a picture upload remains bound to its original account during a switch', async ({ page }) => {
  let pendingUpload = null, authorization;
  const id = '00000000-0000-4000-8000-000000000001';
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:location.origin,anonKey:"mock-key"};' }));
  await page.route('**/rest/v1/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/profile_pictures*', r => { authorization = r.request().headers().authorization; pendingUpload = r; });
  await open(page);
  await page.evaluate(async uid => {
    const { account } = await import('/js/cloud/sync.js'), { supabase } = await import('/js/cloud/client.js');
    account.user = { id: uid }; account.ready = true;
    supabase.auth.getSession = async () => ({ data: { session: { user: { id: uid }, access_token: 'original-picture-token' } } });
    window.__savingPicture = (await import('/js/cloud/profile-pictures.js')).saveProfilePicture('data:image/jpeg;base64,AAAA', uid);
  }, id);
  await expect.poll(() => !!pendingUpload).toBe(true);
  await page.evaluate(async () => { (await import('/js/cloud/sync.js')).account.user = { id: '00000000-0000-4000-8000-000000000002' }; });
  await pendingUpload.fulfill({ status: 201, body: '' });
  const picture = await page.evaluate(async uid => { await window.__savingPicture; return (await import('/js/cloud/profile-pictures.js')).profilePicture(uid); }, id);
  expect(authorization).toBe('Bearer original-picture-token');
  expect(picture).toBe('');
});

test('Gym Tracker uses neutral buttons and saves the update section color and layout', async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('gymSettings')) localStorage.setItem('gymSettings', JSON.stringify({ theme: { base: 'dark', preset: 'custom', color: '#ffffff' } })); });
  await open(page);
  await expect(page).toHaveTitle('Gym Tracker');
  await expect(page.locator('#page-today .btn-primary')).toHaveCSS('background-color', 'rgb(22, 24, 27)');
  await page.locator('.page.active [data-open-settings]').click();
  await expect(page.locator('#page-settings .editor-top .eyebrow')).toHaveCount(0);
  await expect(page.locator('.update-version')).toHaveText(/^v\d+\.\d+\.\d+$/);
  await expect(page.locator('[data-apply-update]')).toHaveText('Install latest update');
  expect(await page.locator('.update-row').evaluate(el => {
    const version = el.querySelector('.update-version').getBoundingClientRect(), button = el.querySelector('button').getBoundingClientRect();
    return version.right < button.left && Math.abs(version.y + version.height / 2 - button.y - button.height / 2) < 2;
  })).toBe(true);
  await page.locator('[data-color-group="Buttons and fields"] > summary').click();
  for (const [selector, color] of [['[data-button-color]', '#000000'], ['[data-update-color]', '#223344']]) {
    await page.locator(selector).evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }, color);
  }
  await page.reload();
  await page.locator('.page.active [data-open-settings]').click();
  await expect(page.locator('.update-notice')).toHaveCSS('background-color', 'rgb(34, 51, 68)');
  for (const selector of ['[data-apply-update]', '[data-close-settings]', '[data-base="dark"]']) await expect(page.locator(selector)).toHaveCSS('background-color', 'rgb(0, 0, 0)');
});

test('the always available update button checks and installs in one tap', async ({ page }) => {
  await page.addInitScript(() => {
    window.__installCalls = 0;
    window.__latestReady = false;
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      App: { getInfo: async () => ({ version: '1.0.0', build: '1' }), addListener: () => {} },
      ApkUpdater: { install: async () => { window.__installCalls++; } },
    } };
    const real = window.fetch;
    window.fetch = (url, options) => String(url).startsWith('https://api.github.com/')
      ? Promise.resolve(new Response(JSON.stringify({ name: window.__latestReady ? 'Tracker v99.0.0 (build 999)' : 'Tracker v1.0.0 (build 1)' }), { headers: { 'Content-Type': 'application/json' } }))
      : real(url, options);
  });
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  await expect(page.locator('[data-check-update]')).toHaveCount(0);
  const button = page.locator('[data-apply-update]');
  await expect(button).toHaveText('Install latest update');
  await button.click();
  await expect(page.locator('#toast')).toContainText('latest version');
  expect(await page.evaluate(() => window.__installCalls)).toBe(0);
  await page.evaluate(() => { window.__latestReady = true; });
  await button.click();
  await expect.poll(() => page.evaluate(() => window.__installCalls)).toBe(1);
  await expect(button).toHaveText('Install update');
});

test('update notice and install controls use the saved button background', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gymSettings', JSON.stringify({ buttonColor: '#000000' })));
  await page.route('**/Version*', r => r.fulfill({ contentType: 'application/json', body: '{"version":"99.0.0"}' }));
  await open(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('gym:check-update', { detail: { manual: true } })));
  const notice = page.locator('#updateBanner');
  await expect(notice).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(notice).toHaveCSS('color', 'rgb(255, 255, 255)');
  await notice.click();
  await expect(page.locator('[data-apply-update]')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
});

test('view, confirmed start and cancel keep workout history safe', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gymLogs', JSON.stringify({ '2026-01-01': [{ id: 'kept', day: 'Pull', time: '2026-01-01T12:00:00Z', exercises: [{ name: 'Row', sets: [{ w: '20', r: '10', done: true }] }] }] }));
    const d = new Date(), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    localStorage.setItem('gymDrafts', JSON.stringify({
      unrelated: { day: 'Pull', date: '2026-01-01', key: 'new:other', active: Date.now(), ex: { Row: [{ w: '25', r: '8', done: false }] } },
      [today + '|Push|new:preview']: { day: 'Push', date: today, key: 'new:preview', active: Date.now(), ex: { Dips: [{ w: '10', r: '8', done: false }] } },
    }));
  });
  await open(page);
  await createWorkout(page, 'Push', ['Dips']);
  await scheduleToday(page, 'Push');
  await tab(page, 'today');
  const hero = page.locator('.hero-card');
  await expect(hero.locator('h2')).toHaveText('Push');
  await expect(hero.locator('.tags, .hero-meta')).toHaveCount(0);
  await hero.getByRole('button', { name: 'View workout', exact: true }).click();
  await expect(page.locator('#sessionList')).toContainText('Dips');
  await expect(page.locator('#sessionMain')).toHaveText('Start workout');
  expect(await page.evaluate(() => localStorage.getItem('gymActive'))).toBeNull();
  await expect(page.locator('#session .d').first()).toBeDisabled();
  await expect(page.locator('#sessionCancel')).toBeHidden();
  await page.locator('#sessionBack').click();
  await expect(page.locator('#toast.show').filter({ hasText: 'Workout kept' })).toHaveCount(0);
  await page.locator('#startToday').click();
  expect(await page.evaluate(() => localStorage.getItem('gymActive'))).toBeNull();
  await page.locator('#sessionMain').click();
  await sheetAction(page, 'Cancel');
  await expect(page.locator('#sessionMain')).toHaveText('Start workout');
  await expect(page.locator('#session .d').first()).toBeDisabled();
  await expect(page.locator('#sessionCancel')).toBeHidden();
  await page.locator('#sessionMain').click();
  await sheetAction(page, 'Start workout');
  await expect(page.locator('#sessionMain')).toHaveText('Finish workout');
  await expect(page.locator('#session .d').first()).toBeEnabled();
  await expect(page.locator('#sessionCancel')).toBeVisible();
  await page.locator('#session .check').first().click();
  const before = await page.evaluate(() => ({ active: localStorage.getItem('gymActive'), logs: localStorage.getItem('gymLogs') }));
  await page.locator('#sessionCancel').click();
  await sheetAction(page, 'Keep workout');
  expect(await page.evaluate(() => localStorage.getItem('gymActive'))).toBe(before.active);
  await page.locator('#sessionCancel').click();
  await sheetAction(page, 'Cancel workout');
  await expect(page.locator('#session')).toBeHidden();
  await expect(page.locator('#activeBar')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('gymActive'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('gymLogs'))).toBe(before.logs);
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('gymDrafts') || '{}')))).toEqual(['unrelated']);
  await page.locator('#startToday').click();
  await expect(page.locator('#sessionMain')).toHaveText('Start workout');
  await expect(page.locator('#session .d').first()).not.toBeChecked();
});

test('future previews cannot change drafts or a running workout; today starts after confirmation', async ({ page }) => {
  await open(page);
  await createWorkout(page, 'Push', ['Dips']);
  await scheduleToday(page, 'Push');
  for (let day = 0; day < 7; day++) {
    await page.locator(`[data-day="${day}"]`).click();
    await page.locator('.sheet-backdrop.open [data-choose="Push"]').click();
  }
  await tab(page, 'today');
  await startTodayWorkout(page);
  await expect(page.locator('#sessionMain')).toHaveText('Finish workout');
  await expect(page.locator('#sessionClockLabel')).toHaveText('In gym');
  await page.locator('#sessionBack').click();
  const before = await page.evaluate(() => ({ active: localStorage.getItem('gymActive'), drafts: localStorage.getItem('gymDrafts'), logs: localStorage.getItem('gymLogs') }));
  expect(before.active).toBeTruthy();
  await page.locator('[data-preview]').first().click();
  await expect(page.locator('#sessionMain')).toBeHidden();
  await expect(page.locator('#session')).toHaveClass(/session-preview/);
  for (const control of await page.locator('#sessionList input, #sessionList button').all()) await expect(control).toBeDisabled();
  await page.locator('#sessionBack').click();
  expect(await page.evaluate(() => ({ active: localStorage.getItem('gymActive'), drafts: localStorage.getItem('gymDrafts'), logs: localStorage.getItem('gymLogs') }))).toEqual(before);
  await page.locator('#activeBar button').click();
  await expect(page.locator('#sessionMain')).toBeVisible();
  await expect(page.locator('#sessionMain')).toHaveText('Finish workout');
});

test('an edited workout badge survives reload and rename', async ({ page }) => {
  await open(page);
  await createWorkout(page, 'Push', ['Dips']);
  await page.locator('[data-edit="Push"]').click();
  await page.locator('[data-workout-badge]').fill('PU');
  await page.locator('[data-workout-badge]').press('Tab');
  await page.locator('[data-rename]').click();
  await page.locator('.sheet-backdrop.open input[name=value]').fill('Upper');
  await page.locator('.sheet-backdrop.open [type=submit]').click();
  await expect(page.locator('[data-workout-badge]')).toHaveValue('PU');
  await page.locator('[data-close-editor]').click();
  await scheduleToday(page, 'Upper');
  await tab(page, 'today');
  await expect(page.locator('.week-day.today .wd-dot')).toHaveCount(1);
  await expect(page.locator('.week-day.today .wd-initial')).toHaveText('PU');
  await page.reload();
  await tab(page, 'plan');
  await expect(page.locator('[data-edit="Upper"] .routine-mark')).toHaveText('PU');
});

test('chart selection moves one white ring without a floating box', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bodyWeightLogs', JSON.stringify([{ date: '2026-10-01', weight: 70 }, { date: '2026-10-05', weight: 72 }, { date: '2026-10-10', weight: 71 }]));
  });
  await open(page);
  await tab(page, 'stats');
  const chart = page.locator('#weightCard .chart-wrap');
  await expect(chart.locator('.g-selected')).toHaveCount(1);
  await expect(chart.locator('.g-selected')).toHaveAttribute('r', '4');
  const first = chart.locator('[data-chart-point]').first();
  const x = await first.getAttribute('cx');
  await first.click();
  await expect(chart.locator('.g-selected')).toHaveAttribute('cx', String(Number(x)));
  await expect(chart.locator('.g-select-bg, .g-best')).toHaveCount(0);
  await expect(chart.locator('[data-chart-selection-output]')).toContainText('70 kg');
  await expect(first).toHaveCSS('outline-style', 'none');
  await expect(page.locator('#weightCard [data-chart-value]')).toHaveText('70');
  await expect(page.locator('#weightCard [data-chart-date]')).toHaveText('1 Oct');
  await first.focus();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(first).toHaveCSS('outline-style', 'none');
});

test('podium rows and the custom leaderboard picker use the selected category', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gymSettings', JSON.stringify({ buttonColor: '#343456', selectedColor: '#6733aa', selectedTextColor: '#ffffff' })));
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:location.origin,anonKey:"mock-key"};' }));
  await page.route('**/rest/v1/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  const rows = [
    { user_id: '00000000-0000-4000-8000-000000000001', username: 'avery', total_seconds: 3600, volume_kg_reps: 100, best_streak: 2, workouts_count: 3, weight_kg: 70 },
    { user_id: '00000000-0000-4000-8000-000000000002', username: 'blake', total_seconds: 2400, volume_kg_reps: 300, best_streak: 4, workouts_count: 3, weight_kg: 90 },
    { user_id: '00000000-0000-4000-8000-000000000003', username: 'casey', total_seconds: 1200, volume_kg_reps: 200, best_streak: 3, workouts_count: 3, weight_kg: 80 },
  ];
  await page.route('**/rest/v1/rpc/friend_summaries', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(rows) }));
  await open(page);
  await page.evaluate(async () => {
    const { account } = await import('/js/cloud/sync.js');
    account.user = { id: '00000000-0000-4000-8000-000000000001', email: 'local@example.test' };
    account.profile = { username: 'avery' };
    account.ready = true;
  });
  await tab(page, 'crew');
  await expect(page.locator('.quick-head .big-icon')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  await page.locator('[data-crew-tab="friends"]').click();
  await expect(page.locator('#addFriendForm')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-crew-tab="ranking"]').click();
  await expect(page.locator('[data-crew-tab="friends"]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('[data-crew-tab="ranking"]')).toHaveCSS('border-bottom-color', 'rgb(103, 51, 170)');
  await expect(page.locator('[data-leaderboard-picker]')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  await expect(page.locator('.leaderboard-row.gold')).toContainText('@avery');
  await expect(page.locator('.leaderboard-row.silver')).toContainText('@blake');
  await expect(page.locator('.leaderboard-row.bronze')).toContainText('@casey');
  await expect(page.locator('.leaderboard-row.me')).toHaveCSS('outline-style', 'none');
  await expect(page.locator('.leaderboard-row.me .avatar')).toHaveCSS('outline-width', '1px');
  await page.locator('[data-leaderboard-picker]').click();
  await expect(page.locator('.board-sheet select')).toHaveCount(0);
  await page.locator('.sheet-backdrop.open').getByRole('option', { name: /Weight lifted/ }).click();
  await expect(page.locator('[data-leaderboard-picker]')).toContainText('Weight lifted');
  await expect(page.locator('.leaderboard-row.gold')).toContainText('@blake');
  await expect(page.locator('[data-leaderboard-picker]')).toBeFocused();
  await page.locator('[data-leaderboard-picker]').click();
  await page.locator('.sheet-backdrop.open').getByRole('option', { name: /^Body weight/ }).click();
  await expect(page.locator('.leaderboard-row.gold')).toContainText('@blake');
  await expect(page.locator('.leaderboard-row.gold')).toContainText('90 kg');
  await expect(page.locator('.leaderboard-controls .hint')).toHaveCount(0);
  await expect(page.locator('[data-publish]')).toHaveCount(0);
});

test('compact controls and custom button text persist without a dedicated Train anyway background', async ({ page }) => {
  await open(page);
  await createWorkout(page, 'Upper', ['Dips']);
  await tab(page, 'today');
  await expect(page.locator('[data-log-any]')).toHaveCSS('min-height', '34px');
  await page.locator('.page.active [data-open-settings]').click();
  await expect(page.locator('[data-train-color]')).toHaveCount(0);
  await page.locator('[data-button-text-color]').evaluate(el => { el.value = '#ff88cc'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(page.locator('[data-pick-image]')).toHaveCSS('color', 'rgb(255, 136, 204)');
  await page.locator('[data-close-settings]').click();
  await expect(page.locator('[data-log-any]')).toHaveCSS('color', 'rgb(255, 136, 204)');
  await page.reload();
  await expect(page.locator('[data-log-any]')).toHaveCSS('color', 'rgb(255, 136, 204)');
});

test('shared appearance colors cover icon buttons, selected controls, fields and workout badges', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gymSettings', JSON.stringify({ buttonColor: '#343456', selectedColor: '#6733aa', selectedTextColor: '#ffffff', inputColor: '#223344', badgeColor: '#aa6644', textColor: '#eeeeee' })));
  await open(page);
  await expect(page.locator('.page.active [data-open-settings]')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  await page.locator('.page.active [data-open-settings]').click();
  await expect(page.locator('[data-base="dark"]')).toHaveCSS('background-color', 'rgb(103, 51, 170)');
  await expect(page.locator('[data-base="dark"]')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.locator('[data-close-settings]').click();
  await tab(page, 'stats');
  await expect(page.locator('#weightInput')).toHaveCSS('background-color', 'rgb(34, 51, 68)');
  await createWorkout(page, 'Upper', ['Dips']);
  await expect(page.locator('[data-edit="Upper"] .routine-mark')).toHaveCSS('background-color', 'rgb(170, 102, 68)');
  await page.evaluate(async () => { const { account } = await import('/js/cloud/sync.js'); account.user = { id: '00000000-0000-4000-8000-000000000001' }; });
  await page.locator('[data-edit="Upper"]').click();
  await expect(page.locator('#page-plan .editor-top .eyebrow')).toHaveCount(0);
  await expect(page.locator('#page-plan .editor-top h1')).toHaveText('Upper');
  for (const selector of ['[data-rename]', '[data-share]']) await expect(page.locator(selector)).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  for (const selector of ['[data-field="target"]', '[data-field="note"]', '[data-field="rest"]', '.stepper']) await expect(page.locator('[data-ex="Dips"] ' + selector)).toHaveCSS('background-color', 'rgb(34, 51, 68)');
  await page.reload();
  await expect(page.locator('.page.active [data-open-settings]')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
});

test('the loading text uses the saved text color before app initialization', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gymSettings', JSON.stringify({ textColor: '#aabbcc', backgroundColor: '#101020' })));
  await page.route('**/js/main.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto('/');
  await expect(page.locator('#loadingScreen')).toBeVisible();
  await expect(page.locator('.loading-label')).toHaveCSS('color', 'rgb(170, 187, 204)');
  await expect(page.locator('#loadingScreen')).toHaveCSS('background-color', 'rgb(16, 16, 32)');
});

test('streaks, workout icons and visible navigation use shared colors', async ({ page }) => {
  await open(page);
  await createWorkout(page, 'Upper', ['Dips']);
  await page.locator('.page.active [data-open-settings]').click();
  for (const [selector, color] of [['[data-button-color]', '#343456'], ['[data-selected-color]', '#6733aa']]) {
    await page.locator(selector).evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }, color);
  }
  await page.locator('[data-close-settings]').click();
  await expect(page.locator('.routine-mark')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  for (const name of ['today', 'plan', 'calendar', 'stats', 'crew']) {
    await tab(page, name);
    await expect(page.locator('.nav-btn.active')).toHaveCSS('background-color', 'rgb(103, 51, 170)');
    if (name !== 'today') await expect(page.locator('.page.active .top .streak')).toHaveCSS('background-color', 'rgb(52, 52, 86)');
  }
  await page.locator('.page.active [data-open-settings]').click();
  await page.locator('[data-streak-color]').evaluate(el => { el.value = '#aa6644'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('[data-close-settings]').click();
  await expect(page.locator('.page.active .top .streak')).toHaveCSS('background-color', 'rgb(170, 102, 68)');
});

test('account caches separate settings and preserve offline edits and resets', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const s = await import('/js/state.js');
    s.activateAccountSettings('account-a');
    s.state.settings.buttonColor = '#112233'; s.saveSettings();
    s.deactivateAccountSettings();
    s.activateAccountSettings('account-b');
    const b = s.state.settings.buttonColor;
    s.state.settings.buttonColor = '#445566'; s.saveSettings();
    s.activateAccountSettings('account-a');
    const a = s.state.settings.buttonColor;
    const pending = s.accountPreferences('account-a');
    delete s.state.settings.buttonColor; s.saveSettings();
    s.applyAccountPreferences('account-a', pending);
    const reset = s.state.settings.buttonColor;
    s.applyAccountPreferences('account-b', { values: { buttonColor: '#ffffff' }, times: { buttonColor: Date.now() + 1000 } });
    const unchanged = s.state.settings.buttonColor;
    s.activateAccountSettings('account-b');
    return { a, b, reset, unchanged, bAgain: s.state.settings.buttonColor };
  });
  expect(result).toEqual({ a: '#112233', b: undefined, reset: undefined, unchanged: undefined, bAgain: '#445566' });
});

test('preference requests keep the original account token during an account switch', async ({ page }) => {
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG = {url:location.origin,anonKey:"mock-key"};' }));
  let stored, authorization;
  await page.route('**/auth/v1/user', async route => {
    authorization = route.request().headers().authorization;
    if (route.request().method() === 'PUT') stored = route.request().postDataJSON().data.tracker_preferences;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'account-a', user_metadata: { tracker_preferences: stored } }) });
  });
  await open(page);
  const returned = await page.evaluate(async () => {
    const { requestAccountPreferences } = await import('/js/cloud/client.js');
    const s = await import('/js/state.js');
    s.activateAccountSettings('account-a');
    s.state.settings.textColor = '#aabbcc'; s.saveSettings();
    const originalSession = { user: { id: 'account-a' }, access_token: 'original-account-token' };
    const writing = requestAccountPreferences(originalSession, s.accountPreferences('account-a'));
    s.activateAccountSettings('account-b');
    const remote = await writing;
    s.applyAccountPreferences('account-a', remote);
    return { remote, bColor: s.state.settings.textColor };
  });
  expect(authorization).toBe('Bearer original-account-token');
  expect(returned.remote.values.textColor).toBe('#aabbcc');
  expect(returned.bColor).toBeUndefined();
});

test('original week shows circles, rest dashes and completed checks with all seven days visible', async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date(), monday = new Date(now); monday.setDate(now.getDate() - (now.getDay() + 6) % 7);
    const date = monday.getFullYear() + '-' + String(monday.getMonth() + 1).padStart(2, '0') + '-' + String(monday.getDate()).padStart(2, '0');
    localStorage.setItem('gymCustomWorkouts', JSON.stringify({ Push: [] }));
    localStorage.setItem('gymPlanSchedule', JSON.stringify({ 2: 'Push' }));
    localStorage.setItem('gymLogs', JSON.stringify({ [date]: [{ id: 'completed', day: 'Push', time: monday.toISOString(), exercises: [{ name: 'Dips', sets: [{ w: '10', r: '8', done: true }] }] }] }));
  });
  await open(page);
  await expect(page.locator('.week')).toHaveAttribute('aria-label', 'This week');
  await expect(page.locator('.wd-letter')).toHaveText(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  await expect(page.locator('.wd-dot')).toHaveCount(7);
  await expect(page.locator('.wd-initial')).toHaveText(['P', '', 'P', '', '', '', '']);
  await expect(page.locator('.week-day.planned:not(.done) .wd-dot .icon')).toHaveCount(0);
  await expect(page.locator('.week-day.rest:not(.done) .wd-dot .icon')).toHaveCount(5);
  await expect(page.locator('.week-heading, .wd-num, .wd-workout, [data-week-scroll]')).toHaveCount(0);
  expect(await page.locator('.week').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(page.locator('.week-day.done')).toHaveCount(1);
  await expect(page.locator('.week-day.done .wd-dot')).toHaveCSS('background-color', 'rgb(200, 245, 61)');
  await expect(page.locator('.week-day.done .wd-dot .icon')).toHaveCount(1);
  await expect(page.locator('.week-day.today')).toHaveAttribute('aria-current', 'date');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('appearance preview shows live samples without saving unfinished picker changes', async ({ page }) => {
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  await page.locator('[data-color-group="Buttons and fields"] > summary').click();
  await page.locator('[data-color-group="Screen"] > summary').click();
  const preview = page.locator('.preview-screen');
  await expect(preview).toHaveAttribute('role', 'img');
  await expect(preview.locator('button, input, [tabindex]')).toHaveCount(0);
  const before = await page.evaluate(() => localStorage.getItem('gymSettings'));
  const picker = page.locator('[data-button-color]');
  await picker.focus();
  await picker.evaluate(el => { el.value = '#354678'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  for (const selector of ['.btn', '.preview-badge', '.preview-streak']) await expect(preview.locator(selector)).toHaveCSS('background-color', 'rgb(53, 70, 120)');
  expect(await page.evaluate(() => localStorage.getItem('gymSettings'))).toBe(before);
  await page.locator('[data-text-color]').focus();
  await expect.poll(() => preview.evaluate(el => el.style.length)).toBe(0);
  await expect(preview.locator('.btn')).not.toHaveCSS('background-color', 'rgb(53, 70, 120)');
  await picker.evaluate(el => { el.value = '#354678'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(preview.locator('.btn')).toHaveCSS('background-color', 'rgb(53, 70, 120)');
  await page.reload();
  await page.locator('.page.active [data-open-settings]').click();
  await expect(preview.locator('.btn')).toHaveCSS('background-color', 'rgb(53, 70, 120)');
  await page.locator('[data-reset-background]').click();
  await expect(preview.locator('.btn')).not.toHaveCSS('background-color', 'rgb(53, 70, 120)');
});

test('preview covers each custom color and keeps its navigation separate from real tabs', async ({ page }) => {
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  const preview = page.locator('.preview-screen');
  for (const [field, target, property] of [
    ['background-color', '.preview-screen', 'background-color'], ['surface-color', '.preview-card', 'background-color'],
    ['text-color', '.preview-workout .grow', 'color'], ['border-color', '.preview-card', 'border-top-color'],
    ['button-text-color', '.preview-controls .btn', 'color'], ['button-color', '.preview-controls .btn', 'background-color'],
    ['selected-color', '.preview-tab.active', 'background-color'], ['selected-text-color', '.preview-tab.active', 'color'],
    ['input-color', '.preview-field', 'background-color'], ['badge-color', '.preview-badge', 'background-color'],
    ['streak-color', '.preview-streak', 'background-color'],
  ]) {
    await page.locator(`[data-${field}]`).evaluate(el => { el.value = '#884466'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(page.locator(target)).toHaveCSS(property, 'rgb(136, 68, 102)');
    await preview.evaluate(el => el.removeAttribute('style'));
  }
  await expect(page.locator('.nav-btn')).toHaveCount(5);
  await expect(preview.locator('.preview-tab.active')).toContainText('Today');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('appearance preview stays anchored while scrolling the grouped color controls', async ({ page }) => {
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  for (const group of await page.locator('.color-group > summary').all()) await group.click();
  await page.locator('[data-button-color]').scrollIntoViewIfNeeded();
  const sample = page.locator('.appearance-preview');
  await expect(sample).toHaveClass(/preview-pinned/);
  const before = await sample.boundingBox();
  await page.evaluate(() => window.scrollBy(0, 120));
  await expect.poll(async () => Math.round((await sample.boundingBox()).y)).toBe(Math.round(before.y));
  await expect(page.locator('.color-group > summary')).toHaveText(['Screen', 'Buttons and fields', 'Bottom navigation', 'Workout and streak']);
  await expect(page.locator('#page-settings')).not.toContainText('Button backgrounds also color');
  await expect(page.locator('#page-settings')).not.toContainText('Workout weights are saved exactly');
});

test('dedicated bottom navigation colors affect every real tab and persist', async ({ page }) => {
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  for (const [selector, color] of [['[data-nav-color]', '#884466'], ['[data-nav-text-color]', '#ffffff']]) {
    await page.locator(selector).evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }, color);
  }
  await expect(page.locator('.preview-tab.active')).toHaveCSS('background-color', 'rgb(136, 68, 102)');
  await page.locator('[data-close-settings]').click();
  for (const name of ['today', 'plan', 'calendar', 'stats', 'crew']) {
    await tab(page, name);
    await expect(page.locator('#bottomNav .nav-btn.active')).toHaveCSS('background-color', 'rgb(136, 68, 102)');
    await expect(page.locator('#bottomNav .nav-btn.active')).toHaveCSS('color', 'rgb(255, 255, 255)');
  }
  await page.reload();
  await expect(page.locator('#bottomNav .nav-btn.active')).toHaveCSS('background-color', 'rgb(136, 68, 102)');
});

test('color groups start collapsed and show the preview only while customizing', async ({ page }) => {
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  await expect(page.locator('.color-group[open]')).toHaveCount(0);
  await expect(page.locator('.preview-slot')).toBeHidden();
  const summary = page.locator('[data-color-group="Bottom navigation"] > summary');
  await summary.click();
  await expect(page.locator('.preview-slot')).toBeVisible();
  await expect(page.locator('[data-nav-color]')).toBeVisible();
  await page.locator('[data-nav-color]').evaluate(el => { el.value = '#884466'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(page.locator('[data-color-group="Bottom navigation"]')).toHaveAttribute('open', '');
  await summary.click();
  await expect(page.locator('.preview-slot')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Today shows a compact week of upcoming days and still expands', async ({ page }) => {
  await open(page);
  await createWorkout(page, 'Push', ['Dips']);
  await tab(page, 'today');
  await expect(page.locator('.up-row')).toHaveCount(7);
  await expect(page.locator('#page-today .top')).toHaveCSS('border-top-width', '0px');
  await page.locator('[data-more]').click();
  await expect(page.locator('.up-row')).toHaveCount(21);
});

test('today highlights a rest dash without drawing a circle around it', async ({ page }) => {
  await open(page);
  const dot = page.locator('.week-day.today.rest .wd-dot');
  await expect(dot).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  await expect(dot.locator('.icon')).toHaveCSS('stroke-width', '3px');
  // The computed RGB is the same accent used for today's weekday label.
  expect(await dot.evaluate(el => getComputedStyle(el).color === getComputedStyle(el.closest('button').querySelector('.wd-letter')).color)).toBe(true);
});

test('week style can switch between circles and compact boxes and survives reload', async ({ page }) => {
  await open(page);
  await page.locator('.page.active [data-open-settings]').click();
  await page.getByRole('radio', { name: 'Boxes', exact: true }).click();
  await page.locator('[data-close-settings]').click();
  await expect(page.locator('.week-boxes')).toBeVisible();
  await expect(page.locator('.week-boxes .wd-num')).toHaveCount(7);
  await expect(page.locator('.week-boxes [data-week-day]')).toHaveCount(7);
  expect(await page.locator('.week').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.reload();
  await expect(page.locator('.week-boxes')).toBeVisible();
  await page.locator('.page.active [data-open-settings]').click();
  await page.getByRole('radio', { name: 'Circles and dashes', exact: true }).click();
  await page.locator('[data-close-settings]').click();
  await expect(page.locator('.wd-dot')).toHaveCount(7);
  await expect(page.locator('.week-box-card')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.wd-dot')).toHaveCount(7);
});
