import { test, expect, newPhone, open, signIn, sheetAction, revealAccent } from './helpers.js';
import { makeUser, uniqueName } from '../integration/helpers.js';

test('appearance follows an account across phones, including offline changes and resets', async ({ browser }) => {
  const user = await makeUser(uniqueName('prefs'));
  const first = await (await newPhone(browser)).newPage();
  const secondContext = await newPhone(browser), second = await secondContext.newPage();
  await open(first); await signIn(first, user);
  await first.locator('[data-button-color]').evaluate(el => { el.value = '#345678'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(async () => (await user.client.auth.getUser()).data.user.user_metadata.tracker_preferences?.values.buttonColor).toBe('#345678');
  await open(second); await signIn(second, user);
  await expect(second.locator('[data-button-color]')).toHaveValue('#345678');
  await secondContext.setOffline(true);
  await second.locator('[data-streak-color]').evaluate(el => { el.value = '#884466'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await secondContext.setOffline(false);
  await second.evaluate(async () => { await (await import('/js/cloud/sync.js')).syncAll(); });
  await first.evaluate(async () => { await (await import('/js/cloud/sync.js')).syncAll(); });
  await expect(first.locator('[data-streak-color]')).toHaveValue('#884466');
  await first.locator('[data-reset-background]').click();
  await first.evaluate(async () => { await (await import('/js/cloud/sync.js')).syncAll(); });
  await second.evaluate(async () => { await (await import('/js/cloud/sync.js')).syncAll(); });
  expect(await second.evaluate(() => JSON.parse(localStorage.getItem('gymSettings')).buttonColor)).toBeUndefined();
});

test('switching accounts restores each person’s appearance without copying it', async ({ page }) => {
  const a = await makeUser(uniqueName('prefa')), b = await makeUser(uniqueName('prefb'));
  await open(page); await signIn(page, a);
  await revealAccent(page);
  await page.locator('[data-preset="ocean"]').click();
  await page.locator('[data-account-settings]').click();
  await page.locator('[data-signout]').click();
  await sheetAction(page, 'Sign out, keep data here');
  await page.locator('[data-close-settings]').click();
  await signIn(page, b);
  await expect(page.locator('[data-preset="lime"]')).toHaveAttribute('aria-checked', 'true');
  await revealAccent(page);
  await page.locator('[data-preset="rose"]').click();
  await page.locator('[data-account-settings]').click();
  await page.locator('[data-signout]').click();
  await sheetAction(page, 'Sign out, keep data here');
  await page.locator('[data-close-settings]').click();
  await signIn(page, a);
  await expect(page.locator('[data-preset="ocean"]')).toHaveAttribute('aria-checked', 'true');
});
