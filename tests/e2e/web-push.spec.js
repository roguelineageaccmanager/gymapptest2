import { test, expect, open } from './helpers.js';

async function accountSetup(page) {
  await page.route('**/cloud-config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock-key"};' }));
  await page.route('**/rest/v1/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await open(page);
  await page.evaluate(async () => {
    const { account } = await import('/js/cloud/sync.js'), { supabase } = await import('/js/cloud/client.js'), { emit } = await import('/js/core/store.js');
    const id = '00000000-0000-4000-8000-000000000001';
    account.user = { id }; account.profile = { username: 'test' }; account.ready = true;
    supabase.auth.getSession = async () => ({ data: { session: { user: { id }, access_token: 'synthetic' } } });
    supabase.channel = () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }); emit('gym:account');
  });
  await page.locator('.page.active [data-open-settings]').click();
}
test('Safari tab explains Home Screen installation without requesting permission', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { value: 'iPhone' });
    Object.defineProperty(navigator, 'standalone', { value: false });
    window.permissionCalls = 0;
    Notification.requestPermission = async () => { window.permissionCalls++; return 'granted'; };
  });
  await accountSetup(page);
  await expect(page.getByText('Share → Add to Home Screen, then open Gym Tracker from its icon to enable notifications.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.permissionCalls)).toBe(0);
});
test('installed iOS app asks on tap, uses its existing worker, handles foreground and opts out', async ({ page }) => {
  let registered, preferences;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { value: 'iPhone' });
    Object.defineProperty(navigator, 'standalone', { value: true });
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => window.mockPermission || 'default' });
    window.permissionCalls = [];
    Notification.requestPermission = async () => { window.permissionCalls.push(navigator.userActivation.isActive); window.mockPermission = 'granted'; return 'granted'; };
    navigator.serviceWorker.getRegistration = async () => ({ scope: location.origin + '/', active: {}, pushManager: { getSubscription: async () => null }, getNotifications: async () => [] });
  });
  await page.route('**/vendor/firebase-messaging.js', r => r.fulfill({ contentType: 'text/javascript', body: `
    export const isSupported=async()=>true,getApps=()=>[],initializeApp=()=>({}),getMessaging=()=>({});
    export const onMessage=(m,callback)=>{window.foregroundMessage=callback;return()=>{}};
    export const getToken=async(m,options)=>{window.tokenOptions={scope:options.serviceWorkerRegistration.scope,vapid:options.vapidKey};return 'synthetic-web-token'};
    export const deleteToken=async()=>{window.tokenDeleted=true};` }));
  await accountSetup(page);
  await page.route('**/rest/v1/rpc/register_chat_push', r => { registered = r.request().postDataJSON(); return r.fulfill({ status: 204 }); });
  await page.route('**/rest/v1/chat_push_settings*', r => { preferences = r.request().postDataJSON(); return r.fulfill({ status: 201 }); });
  expect(await page.evaluate(() => window.permissionCalls)).toEqual([]);
  await page.locator('[data-web-notifications]').click();
  await expect.poll(() => preferences?.enabled).toBe(true);
  expect(registered.device_token).toBe('synthetic-web-token');
  expect(await page.evaluate(() => window.permissionCalls)).toEqual([true]);
  expect(await page.evaluate(() => window.tokenOptions.scope)).toBe(new URL('/', page.url()).href);
  await page.evaluate(() => window.foregroundMessage({ notification: { title: 'Test chat', body: '<img src=x>' }, data: { target: 'chat' } }));
  await expect(page.locator('#toast')).toContainText('Test chat');
  await expect(page.locator('#toast img')).toHaveCount(0);
  await page.locator('[data-web-notifications]').click();
  await expect.poll(() => preferences?.enabled).toBe(false);
  expect(await page.evaluate(() => window.tokenDeleted)).toBe(true);
});

