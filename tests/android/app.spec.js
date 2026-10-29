// End-to-end tests of the installed Android app in an emulator. The debug build's
// WebView is debuggable, so Playwright drives the real app UI through it.
// Run with `npm run test:android` (see tools/android-e2e.sh).
import { test, expect, _android as android } from '@playwright/test';
import { adminClient } from '../integration/helpers.js';
import { newUser } from '../e2e/helpers.js';
import { execFileSync } from 'node:child_process';
import {touchTap} from './touch.js';

const PKG = 'com.roguelineage.rattracker';
let device;

async function launch({ clear = false } = {}) {
  execFileSync('adb', ['reverse', 'tcp:54321', 'tcp:54321']);
  await device.shell(`am force-stop ${PKG}`);
  if (clear) await device.shell(`pm clear ${PKG}`);
  await device.shell(`pm grant ${PKG} android.permission.POST_NOTIFICATIONS`);
  await device.shell(`am start -W -n ${PKG}/.MainActivity`);
  const webview = await device.webView({ pkg: PKG }, { timeout: 60000 });
  const page = await webview.page();
  page.on('pageerror',error=>console.log('ANDROID_PAGE_ERROR: '+error.message));
  page.on('crash',()=>console.log('ANDROID_WEBVIEW_CRASH'));
  page.on('close',()=>console.log('ANDROID_WEBVIEW_CLOSED'));
  await expect(page.locator('#page-today h1')).toHaveText('Today', { timeout: 30000 });
  await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  return page;
}

const back = () => device.shell('input keyevent KEYCODE_BACK');

test.beforeAll(async () => {
  [device] = await android.devices();
  // A missing emulator is a failure (CI must not pass green without running);
  // set ANDROID_E2E_ALLOW_SKIP=1 to skip deliberately.
  if (!device && process.env.ANDROID_E2E_ALLOW_SKIP === '1') test.skip(true, 'No Android device or emulator connected');
  if (!device) throw new Error('No Android device or emulator connected');
});

/** Waits until the WebView has written localStorage to disk (it does so shortly after a change). */
async function waitForStorageFlush(sinceSeconds) {
  const dir = 'app_webview/Default/Local\\ Storage/leveldb';
  // Size and time of the newest log file: written after the change, then unchanged
  // for two seconds (a save can take several writes).
  const state = async () => String(await device.shell(`run-as ${PKG} sh -c 'stat -c "%Y %s" ${dir}/*.log 2>/dev/null | sort -n | tail -1'`)).trim();
  let last = '', stableSince = 0;
  await expect.poll(async () => {
    const now = await state();
    if (now !== last) { last = now; stableSince = Date.now(); }
    return (Number(now.split(' ')[0]) || 0) >= sinceSeconds && Date.now() - stableSince >= 2000;
  }, { timeout: 20000, intervals: [500], message: 'WebView storage was not written to disk' }).toBe(true);
}

test.afterAll(async () => { await device?.close(); });

test('logs a workout offline and keeps it after the app restarts', async () => {
  let page = await launch({ clear: true });
  expect(await page.evaluate(() => window.Capacitor?.isNativePlatform?.())).toBe(true);
  // The Android-app install banner is only for browsers.
  await expect(page.locator('#installBanner')).toBeHidden();

  await page.locator('.nav-btn[data-page="plan"]').click();
  await page.getByRole('button', { name: 'New workout' }).click();
  await page.locator('.sheet input[name=value]').fill('Push');
  await page.locator('.sheet [type=submit]').click();
  await page.locator('#exSearch').fill('Bench');
  await page.locator('[data-add="Barbell Bench Press"]').click();
  await page.locator('[data-close-editor]').click();
  const dow = (new Date().getDay() + 6) % 7;
  await page.locator(`[data-day="${dow}"]`).click();
  await page.locator('.sheet [data-choose="Push"]').click();

  await page.locator('.nav-btn[data-page="today"]').click();
  await page.locator('#startToday').click();
  await page.locator('#sessionMain').click();
  await page.locator('.sheet').getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.locator('#session .w').first().fill('60');
  await page.locator('#session .r').first().fill('8');
  await page.locator('#session .check').first().click();

  // Hardware back closes the workout but keeps it running.
  await back();
  await expect(page.locator('#session')).toBeHidden();
  await expect(page.locator('#activeBar')).toBeVisible();
  await page.locator('#activeBar button').click();
  await expect(page.locator('#session .w').first()).toHaveValue('60');
  await page.locator('#sessionMain').click();
  await page.locator('.sheet').getByRole('button', { name: 'Save workout' }).click();
  const savedAt = Math.floor(Date.now() / 1000) - 1;
  await expect(page.locator('.hero-card.done')).toBeVisible();
  await waitForStorageFlush(savedAt);

  page = await launch();
  await expect(page.locator('.hero-card.done')).toBeVisible();
  await expect(page.locator('.hero-title')).toHaveText('Push');
});

test('signs up and posts a chat message to the cloud', async () => {
  const user = newUser('droid');
  const page = await launch({ clear: true });
  await page.locator('.page.active [data-open-settings]').click();
  await page.locator('[data-auth-mode="signup"]').click();
  await page.locator('#authForm [name=email]').fill(user.email);
  await page.locator('#authForm [name=password]').fill(user.password);
  await page.locator('#authForm [name=username]').fill(user.username);
  await page.locator('#authForm [name=consent]').check();
  await page.locator('#authForm [type=submit]').click();
  await expect(page.locator('#page-settings .account-identity')).toContainText('@' + user.username, { timeout: 30000 });

  await page.locator('[data-account-settings]').click();
  await page.locator('[data-change-display-name]').click();
  await page.locator('.sheet input[name=value]').fill('Emulator Lifter');
  await page.locator('.sheet [type=submit]').click();
  await expect(page.locator('.sheet-backdrop.open')).toHaveCount(0);
  // Leave the account flow explicitly; hardware back is covered in the workout case.
  await page.locator('[data-close-settings]').click();
  await expect(page.locator('#page-today')).toHaveClass(/active/);

  await touchTap(page,'.nav-btn[data-page="crew"]');
  await expect(page.locator('#page-crew')).toHaveClass(/active/);
  await expect(page.locator('#crew-tab-ranking')).toHaveAttribute('aria-selected','true');
  await touchTap(page,'#crew-tab-dates');
  await page.locator('#chatInput').fill('Synthetic emulator chat');
  await page.locator('#chatForm [type=submit]').click();
  await expect(page.locator('.chat-message.mine').last()).toContainText('Synthetic emulator chat');
  await expect(page.locator('.chat-message.mine .chat-author').last()).toHaveText('Emulator Lifter');

  const admin = adminClient();
  const profile = await admin.from('profiles').select('id').eq('username', user.username).single();
  expect(profile.error).toBeNull();
  try {
    const messages = await admin.from('community_messages').select('body').eq('user_id', profile.data.id);
    expect(messages.error).toBeNull();
    expect(messages.data).toEqual([{ body: 'Synthetic emulator chat' }]);
  } finally { await admin.auth.admin.deleteUser(profile.data.id); }
});
