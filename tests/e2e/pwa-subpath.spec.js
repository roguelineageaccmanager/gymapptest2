import { test, expect } from './helpers.js';
test.skip(({ baseURL }) => !baseURL?.endsWith(':4175/gymapptest2/'), 'Runs in the dedicated subpath/worker project.');

test('one worker caches the full app at the GitHub Pages subpath and opens offline', async ({ page, context }) => {
  await page.goto('./');
  await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  await page.evaluate(async () => navigator.serviceWorker.register((await import('./js/core/dom.js')).scriptURL('sw.js'), { scope: './', updateViaCache: 'none' }));
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe('http://127.0.0.1:4175/gymapptest2/');
  const registrations = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => ({ scope: r.scope, script: r.active.scriptURL })));
  expect(registrations).toEqual([{ scope, script: scope + 'sw.js' }]);
  const manifest = await page.evaluate(async () => await (await fetch('manifest.json')).json());
  expect(manifest.start_url).toBe('./'); expect(manifest.scope).toBe('./'); expect(manifest.display).toBe('standalone');
  expect(await page.locator('link[rel=apple-touch-icon]').getAttribute('href')).toBe('icon-192.png');
  const cached = await page.evaluate(async () => {
    const { APP_VERSION } = await import('./js/version.js');
    const key = (await caches.keys()).find(key => key.startsWith(`tracker-${APP_VERSION}-`));
    if (!key) throw new Error('Installed app cache missing');
    const cache = await caches.open(key);
    return Promise.all(['firebase-messaging-sw.js', 'vendor/firebase-messaging-worker.js', 'js/web-push.js'].map(async file => !!await cache.match(new URL(file, location.href))));
  });
  expect(cached).toEqual([true, true, true]);
  await context.setOffline(true); await page.reload();
  await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  await expect(page.locator('.nav-btn[data-page=stats]')).toBeVisible();
  await page.locator('.nav-btn[data-page=stats]').click(); await expect(page.locator('.rank-body')).toHaveCount(2);
});
