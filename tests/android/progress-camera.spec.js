import { test, expect, _android as android } from '@playwright/test';
import { makeUser, uniqueName, adminClient } from '../integration/helpers.js';
import { execFileSync } from 'node:child_process';
const PKG = 'com.roguelineage.rattracker';
const adb = args => execFileSync('adb', ['shell', ...args], { encoding: 'utf8', timeout: 10000 });
function nodes() {
  adb(['uiautomator', 'dump', '/sdcard/progress-test.xml']);
  const xml = adb(['cat', '/sdcard/progress-test.xml']);
  return [...xml.matchAll(/<node\b([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
function tap(pattern) {
  const node = nodes().find(node => pattern.test([node['content-desc'], node.text, node['resource-id']].join(' ')) && node.bounds !== '[0,0][0,0]');
  if (!node) return false;
  const bounds = [...node.bounds.matchAll(/\d+/g)].map(match => Number(match[0]));
  adb(['input', 'tap', String(Math.round((bounds[0] + bounds[2]) / 2)), String(Math.round((bounds[1] + bounds[3]) / 2))]); return true;
}
test('native camera returns a progress picture, posts to friends and removes only the test photo', async () => {
  test.setTimeout(120000);
  const [device] = await android.devices(); if (!device) throw new Error('No Android device');
  const user = await makeUser(uniqueName('pic'));
  try {
    await device.shell(`am force-stop ${PKG}`); await device.shell(`pm clear ${PKG}`); await device.shell(`am start -W -n ${PKG}/.MainActivity`);
    const page = await (await device.webView({ pkg: PKG }, { timeout: 60000 })).page();
    await expect(page.locator('#page-today h1')).toHaveText('Today', { timeout: 30000 }); await page.locator('#loadingScreen').waitFor({ state: 'detached' });
    await page.locator('.page.active [data-open-settings]').click();
    await page.locator('#authForm [name=email]').fill(user.email); await page.locator('#authForm [name=password]').fill(user.password); await page.locator('#authForm [type=submit]').click();
    await expect(page.locator('#page-settings .account-identity')).toContainText('@' + user.username, { timeout: 30000 });
    await page.locator('[data-close-settings]').click(); await page.locator('[data-page=stats]').click(); await page.locator('[data-stats-tab=progress]').click();
    await page.locator('[data-add-progress]').click(); await page.locator('[data-progress-camera]').click();
    await expect.poll(() => {
      const list = nodes();
      if (list.some(node => /location/i.test(node.text || ''))) tap(/No thanks|Not now|Skip/i);
      return list.some(node => /shutter|capture_button|Take photo/i.test([node['content-desc'], node['resource-id']].join(' ')));
    }, { timeout: 30000 }).toBe(true);
    if (!tap(/shutter_button|shutter button|Take photo/i)) adb(['input', 'keyevent', 'KEYCODE_CAMERA']);
    await expect.poll(() => tap(/done_button|review_done|Done|Accept photo|Use photo/i), { timeout: 20000 }).toBe(true);
    await expect(page.locator('[data-progress-preview] img')).toBeVisible({ timeout: 30000 });
    const picture = await page.locator('[data-progress-preview] img').getAttribute('src'); expect(picture).toMatch(/^data:image\/jpeg;base64,/); expect(picture.length).toBeLessThanOrEqual(240000);
    await page.locator('.progress-editor [name=caption]').fill('Synthetic emulator camera');
    await page.locator('.sheet-backdrop.open').getByRole('button', { name: 'Post picture', exact: true }).click();
    await expect(page.locator('.progress-post')).toContainText('Synthetic emulator camera', { timeout: 15000 });
    expect((await user.client.from('progress_photos').select('id')).data).toHaveLength(1);
  } finally { await adminClient().auth.admin.deleteUser(user.id); await device.close(); }
});
