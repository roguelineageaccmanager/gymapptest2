import { supabase, requestChatPush } from './cloud/client.js';
import { account } from './cloud/sync.js';
import { state, saveSettings } from './state.js';
import { isNativeApp } from './native.js';
import { read, write, listen, emit } from './core/store.js';
import { toast, haptic } from './core/dom.js';
import { currentPage } from './core/router.js';
import { webPushBridge, webPushState } from './web-push.js';

let observedUser;
let bridge, generation = 0, registered = null, pending = null, listenersReady = false;
let listenerSetup = null, cleaned = false;
let queue = Promise.resolve(), busy = false, status = '', gesturePermission = null;
function plugin() {
  const c = window.Capacitor;
  if (!isNativeApp()) return webPushState().supported ? webPushBridge : null;
  if (!c?.isPluginAvailable?.('PushNotifications')) return null;
  return bridge ||= c.Plugins?.PushNotifications || c.registerPlugin('PushNotifications');
}
export const chatNotificationState = () => ({ supported: !!plugin(), busy, status, native: isNativeApp(), hint: isNativeApp() ? '' : webPushState().hint, enabled: state.settings.chatNotifications === true && (isNativeApp() || ('Notification' in window && Notification.permission === 'granted')) });
function announce(text = '') { status = text; emit('gym:push-status'); }
function installation() {
  let value = read('gymChatPushInstall', null);
  if (!value || !/^[0-9a-f-]{36}$/i.test(value.id) || !/^[0-9a-f]{64}$/.test(value.key)) {
    value = { id: crypto.randomUUID(), key: [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('') };
    if (!write('gymChatPushInstall', value)) throw new Error('Could not save notification registration on this phone.');
  }
  return value;
}
async function sessionFor(id) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !id || !account.ready || account.user?.id !== id || data.session?.user.id !== id) throw new Error('The account changed. Try again.');
  return data.session;
}
async function clearChatAlerts() {
  try {
    const c = window.Capacitor, p = c?.Plugins?.WorkoutStatus || (c?.isPluginAvailable?.('WorkoutStatus') ? c.registerPlugin('WorkoutStatus') : null);
    await p?.clearChatNotifications();
  } catch { /* Older APK. */ }
}
async function unregister() {
  const old = registered; registered = null;
  if (cleaned && !old) return;
  const c = window.Capacitor;
  const cleanup = !isNativeApp() ? webPushBridge : c?.isPluginAvailable?.('ChatPush') ? c.Plugins?.ChatPush || c.registerPlugin('ChatPush') : plugin();
  try { await cleanup?.unregister(); cleaned = true; } catch { /* No Firebase config or an older APK. */ }
  await clearChatAlerts();
  if (old) await requestChatPush(old.session, 'remove', { device_id: old.install.id }).catch(() => {});
}
async function prepareListeners() {
  if (listenersReady || !plugin()) return;
  if (listenerSetup) return listenerSetup;
  listenerSetup = setupListeners().catch(error => { listenerSetup = null; throw error; });
  return listenerSetup;
}
async function setupListeners() {
  const p = plugin();
  await p.addListener('registration', result => { if (pending) { const current = pending; pending = null; clearTimeout(current.timer); current.resolve(result.value); } });
  await p.addListener('registrationError', () => { if (pending) { const current = pending; pending = null; clearTimeout(current.timer); current.reject(new Error('Chat notifications are not connected yet.')); } });
  await p.addListener('pushNotificationActionPerformed', result => { if (result.notification?.data?.target === 'chat') emit('gym:open-chat'); });
  await p.addListener('pushNotificationReceived', message => {
    if (!account.user || state.settings.chatNotifications !== true || message.data?.target !== 'chat') return;
    if (currentPage() === 'crew' && document.getElementById('chatRoom') && !document.hidden) return;
    haptic(30);
    toast(String(message.title || 'New chat message').slice(0, 80) + ': ' + String(message.body || '').slice(0, 160), { background: true, action: { label: 'Open', onClick: () => emit('gym:open-chat') } });
  });
  listenersReady = true;
}
async function reconcile({ ask = false } = {}) {
  const id = account.user?.id, revision = generation, p = plugin();
  if (!p) return;
  if (!id || !account.ready || state.settings.chatNotifications !== true) { await unregister(); return; }
  if (registered && registered.session.user.id !== id) await unregister();
  const c = window.Capacitor;
  if (c?.isPluginAvailable?.('ChatPush')) { const control = c.Plugins?.ChatPush || c.registerPlugin('ChatPush'); if (!(await control.status()).configured) { if (ask) throw new Error('Chat notifications are not connected yet.'); return; } }
  await prepareListeners();
  const permission = ask ? await (gesturePermission || p.requestPermissions()) : await p.checkPermissions();
  if (revision !== generation || account.user?.id !== id) return;
  if (permission.receive !== 'granted') { await unregister(); if (ask) throw new Error('Allow notifications in your device settings to enable chat alerts.'); announce(permission.receive === 'denied' ? 'Blocked in device settings' : 'Enable notifications on this device'); return; }
  if (registered?.session.user.id === id && Date.now() - registered.at < 86400000) return;
  const session = await sessionFor(id), install = installation();
  await p.createChannel({ id: 'gym_chat_messages_v1', name: 'Chat messages', importance: 4, visibility: 0, vibration: true });
  const token = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { if (pending?.timer === timer) pending = null; reject(new Error('Could not connect chat notifications. Try again.')); }, 20000);
    pending = { resolve, reject, timer };
    cleaned = false;
    p.register().catch(() => { if (pending?.timer === timer) { pending = null; clearTimeout(timer); reject(new Error('Chat notifications are not connected yet.')); } });
  });
  if (revision !== generation || account.user?.id !== id || state.settings.chatNotifications !== true) { await unregister(); return; }
  await requestChatPush(session, 'register', { device_id: install.id, device_token: token, device_key: install.key });
  if (revision !== generation || account.user?.id !== id) { await requestChatPush(session, 'remove', { device_id: install.id }).catch(() => {}); await unregister(); return; }
  registered = { session, install, at: Date.now() };
  await requestChatPush(session, 'settings', { user_id: id, enabled: true }); announce('');
}
function schedule(options) { queue = queue.catch(() => {}).then(() => reconcile(options)).catch(error => announce(error.message)); return queue; }
export async function setChatNotifications(enabled) {
  if (busy) return;
  const id = account.user?.id;
  if (!id || !account.ready) throw new Error('Sign in first.');
  if (enabled && !plugin()) throw new Error(isNativeApp() ? 'Chat notifications are unavailable on this device.' : webPushState().hint);
  // Safari requires this call in the original tap, before session/network awaits.
  gesturePermission = enabled && !isNativeApp() ? webPushBridge.requestPermissions() : null;
  busy = true; emit('gym:push-status');
  const previous = state.settings.chatNotifications === true;
  try {
    const session = await sessionFor(id);
    generation++;
    if (pending) { const old = pending; pending = null; clearTimeout(old.timer); old.reject(new Error('Notification choice changed.')); }
    state.settings.chatNotifications = enabled;
    queue = queue.catch(() => {}).then(() => enabled ? reconcile({ ask: true }) : unregister());
    await queue;
    if (account.user?.id !== id) return;
    await requestChatPush(session, 'settings', { user_id: id, enabled });
    if (account.user?.id === id) { saveSettings(); announce(''); }
  } catch (error) {
    if (account.user?.id === id) { state.settings.chatNotifications = previous; if (!previous) await unregister(); announce(error.message); }
    throw error;
  } finally { gesturePermission = null; busy = false; emit('gym:push-status'); }
}
export function initChatNotifications() {
  if (!isNativeApp() && 'serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', event => { if (event.data?.type === 'gym:open-chat') emit('gym:open-chat'); });
  prepareListeners().catch(() => {});
  listen('gym:account', () => {
    const next = account.user?.id;
    if (next !== observedUser) {
      observedUser = next; generation++;
      if (pending) { const old = pending; pending = null; clearTimeout(old.timer); old.reject(new Error('The account changed.')); }
    }
    if (!busy || next !== registered?.session.user.id) schedule();
  });
  listen('gym:preferences-updated', () => { if (!busy) schedule(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !busy) schedule(); });
  schedule();
  if (!isNativeApp() && new URL(location.href).searchParams.get('open') === 'chat') {
    const url = new URL(location.href); url.searchParams.delete('open'); history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    emit('gym:open-chat');
  }
}
