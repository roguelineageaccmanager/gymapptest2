import { test, expect, _android as android } from '@playwright/test';
import { makeUser, uniqueName, adminClient } from '../integration/helpers.js';

const PKG = 'com.roguelineage.rattracker';
test('chat composer and Send stay above the real Android keyboard', async () => {
  const [device] = await android.devices();
  if (!device) throw new Error('No Android device connected');
  const user = await makeUser(uniqueName('ime'));
  try {
    await device.shell(`am force-stop ${PKG}`); await device.shell(`pm clear ${PKG}`);
    await device.shell('settings put secure show_ime_with_hard_keyboard 1');
    await device.shell(`am start -W -n ${PKG}/.MainActivity`);
    const webview = await device.webView({ pkg: PKG }, { timeout: 60000 }), page = await webview.page();
    await expect(page.locator('#page-today h1')).toHaveText('Today', { timeout: 30000 });
    await page.locator('#loadingScreen').waitFor({ state: 'detached' });
    const full = await page.evaluate(() => innerHeight);
    await page.locator('.page.active [data-open-settings]').click();
    await page.locator('#authForm [name=email]').fill(user.email); await page.locator('#authForm [name=password]').fill(user.password);
    await page.locator('#authForm [type=submit]').click();
    await expect(page.locator('#page-settings .account-identity')).toContainText('@' + user.username, { timeout: 30000 });
    await page.locator('[data-close-settings]').click();
    await page.locator('[data-page=crew]').click(); await page.locator('#crew-tab-dates').click();
    await page.locator('#chatInput').click(); await page.locator('#chatInput').fill('Real keyboard test');
    await expect.poll(async () => /mInputShown=true|mIsInputViewShown=true/.test(String(await device.shell('dumpsys input_method'))), { timeout: 15000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => Math.min(innerHeight, visualViewport?.height || innerHeight)), { timeout: 15000 }).toBeLessThan(full - 100);
    await expect(page.locator('body')).toHaveClass(/chat-keyboard-open/);
    const visible = () => page.evaluate(() => {
      const top = visualViewport?.offsetTop || 0, bottom = top + (visualViewport?.height || innerHeight);
      return ['#chatInput', '#chatForm [type=submit]'].every(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return r.top >= top && r.bottom <= bottom; });
    });
    await expect.poll(visible).toBe(true);
    await page.locator('#chatForm [type=submit]').click();
    await expect(page.locator('.chat-message.mine')).toContainText('Real keyboard test', { timeout: 15000 });
    await expect(page.locator('#chatInput')).toHaveValue('');
    await expect.poll(visible).toBe(true);
    await test.info().attach('Android chat keyboard', { body: await device.screenshot(), contentType: 'image/png' });
    await device.shell('input keyevent KEYCODE_BACK');
    await expect(page.locator('body')).not.toHaveClass(/chat-keyboard-open/);
  } finally { await adminClient().auth.admin.deleteUser(user.id); await device.close(); }
});
