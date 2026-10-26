import { test, expect, _android as android } from '@playwright/test';
import { makeUser, uniqueName, adminClient } from '../integration/helpers.js';
import { firebaseAccessToken, messagePayload } from '../../supabase/functions/chat-push/fcm.mjs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const PKG = 'com.roguelineage.rattracker';
test('real Firebase alert arrives with app process closed and opens Chat; opting out removes registration', async () => {
  test.skip(!process.env.FIREBASE_SERVICE_ACCOUNT, 'Run the explicitly authorized push scope with its protected sender secret.');
  test.setTimeout(240000);
  const [device] = await android.devices(); if (!device) throw new Error('No Android device');
  const user = await makeUser(uniqueName('push'));
  try {
    await device.shell(`am force-stop ${PKG}`); await device.shell(`pm clear ${PKG}`);
    await device.shell(`pm grant ${PKG} android.permission.POST_NOTIFICATIONS`);
    await device.shell(`am start -W -n ${PKG}/.MainActivity`);
    let page = await (await device.webView({ pkg: PKG }, { timeout: 60000 })).page();
    await expect(page.locator('#page-today h1')).toHaveText('Today', { timeout: 30000 }); await page.locator('#loadingScreen').waitFor({ state: 'detached' });
    await page.locator('.page.active [data-open-settings]').click();
    await page.locator('#authForm [name=email]').fill(user.email); await page.locator('#authForm [name=password]').fill(user.password); await page.locator('#authForm [type=submit]').click();
    await expect(page.locator('#page-settings .account-identity')).toContainText('@' + user.username, { timeout: 30000 });
    await expect(page.locator('[data-chat-notifications]')).toBeEnabled({ timeout: 30000 });
    await page.locator('[data-chat-notifications]').check();
    let registration;
    await expect.poll(async () => {
      const result = await adminClient().from('chat_push_devices').select('id,token').eq('user_id', user.id);
      registration = result.data?.[0]; return !!registration;
    }, { timeout: 90000, intervals: [1000, 3000, 5000] }).toBe(true);
    await device.shell('input keyevent KEYCODE_HOME');
    await device.shell(`am kill ${PKG}`);
    await expect.poll(async () => String(await device.shell(`pidof ${PKG}`)).trim()).toBe('');
    const service = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT), token = await firebaseAccessToken(service);
    const body = 'Synthetic closed app push ' + randomUUID().slice(0, 6);
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${service.project_id}/messages:send`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(messagePayload({ message_id: randomUUID(), username: 'GymTest', body }, registration.token)),
    });
    expect(response.status).toBe(200);
    await expect.poll(async () => String(await device.shell('dumpsys notification --noredact')), { timeout: 60000 }).toContain(body);
    await device.shell('cmd statusbar expand-notifications');
    await expect.poll(() => {
      execFileSync('adb', ['shell', 'uiautomator', 'dump', '/sdcard/push-test.xml'], { timeout: 10000 });
      const xml = execFileSync('adb', ['shell', 'cat', '/sdcard/push-test.xml'], { encoding: 'utf8', timeout: 10000 });
      const node = [...xml.matchAll(/<node\b([^>]+)>/g)].find(match => match[1].includes(body));
      const bounds = node && /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node[1]);
      if (!bounds) return false;
      execFileSync('adb', ['shell', 'input', 'tap', String(Math.round((+bounds[1] + +bounds[3]) / 2)), String(Math.round((+bounds[2] + +bounds[4]) / 2))], { timeout: 10000 }); return true;
    }, { timeout: 15000 }).toBe(true);
    page = await (await device.webView({ pkg: PKG }, { timeout: 60000 })).page();
    await expect(page.locator('#page-crew')).toHaveClass(/active/, { timeout: 30000 });
    await expect(page.locator('#crew-tab-dates')).toHaveAttribute('aria-selected', 'true');
    await test.info().attach('Chat opened from real notification', { body: await device.screenshot(), contentType: 'image/png' });
    await page.locator('.page.active [data-open-settings]').click();
    await page.locator('[data-chat-notifications]').uncheck();
    await expect.poll(async () => (await adminClient().from('chat_push_devices').select('id').eq('user_id', user.id)).data?.length).toBe(0);
    expect((await user.client.from('chat_push_settings').select('enabled').single()).data?.enabled).toBe(false);
  } finally { await adminClient().auth.admin.deleteUser(user.id); await device.close(); }
});
