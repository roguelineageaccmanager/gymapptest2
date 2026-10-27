import { FIREBASE_WEB_CONFIG, WEB_PUSH_VAPID_KEY } from './firebase-config.js';
import { webPushEligibility } from './domain/web-push.js';

let sdkPromise, messaging, foreground;
const events = new Map();
function fire(name, value) { for (const callback of events.get(name) || []) callback(value); }
export function webPushState() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  return webPushEligibility({ ios, standalone, secure: window.isSecureContext, apis: 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator, configured: /^[A-Za-z0-9_-]{87}$/.test(WEB_PUSH_VAPID_KEY) && !!FIREBASE_WEB_CONFIG.appId });
}
async function load() {
  sdkPromise ||= import('../vendor/firebase-messaging.js');
  const sdk = await sdkPromise;
  if (!await sdk.isSupported()) throw new Error('This browser does not support web notifications.');
  messaging ||= sdk.getMessaging(sdk.getApps().find(app => app.name === 'gym-tracker-web') || sdk.initializeApp(FIREBASE_WEB_CONFIG, 'gym-tracker-web'));
  foreground ||= sdk.onMessage(messaging, message => fire('pushNotificationReceived', { title: message.notification?.title, body: message.notification?.body, data: message.data }));
  return sdk;
}
async function registration() {
  const scope = new URL('./', location.href);
  const reg = await navigator.serviceWorker.getRegistration(scope.href);
  if (!reg || reg.scope !== scope.href) throw new Error('Open Gym Tracker again after its offline setup finishes.');
  // A token must attach to the app's existing scope, never create a second worker.
  if (!reg.active) throw new Error('The app is updating. Reopen it and try again.');
  return reg;
}
export const webPushBridge = {
  addListener: async (name, callback) => { const listeners = events.get(name) || new Set(); listeners.add(callback); events.set(name, listeners); return { remove: () => listeners.delete(callback) }; },
  checkPermissions: async () => ({ receive: Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'prompt' }),
  // Called directly from the user's tap; do not move this behind an await.
  requestPermissions: () => Notification.requestPermission().then(receive => ({ receive: receive === 'default' ? 'prompt' : receive })),
  createChannel: async () => {},
  register: async () => {
    try { const sdk = await load(); const token = await sdk.getToken(messaging, { vapidKey: WEB_PUSH_VAPID_KEY, serviceWorkerRegistration: await registration() }); if (!token) throw new Error(); fire('registration', { value: token }); }
    catch { fire('registrationError', {}); }
  },
  unregister: async () => {
    // Do not create an installation or subscribe just to clean up an unused browser.
    if (sdkPromise) { const sdk = await sdkPromise; if (messaging) await sdk.deleteToken(messaging); }
    if (!('serviceWorker' in navigator)) return;
    const scope = new URL('./', location.href).href;
    const reg = await navigator.serviceWorker.getRegistration(scope);
    if (reg?.scope === scope) { const subscription = await reg.pushManager?.getSubscription(); if (subscription) await subscription.unsubscribe(); for (const alert of await reg.getNotifications()) if (alert.tag.startsWith('gym-chat')) alert.close(); }
  },
};
