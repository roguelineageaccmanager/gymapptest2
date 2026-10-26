// Android owns the ongoing notification/clock while the WebView is suspended.
// Older APKs and browsers keep working without this optional bridge.
import { isNativeApp } from './native.js';

let bridge;
let nativeAlerts = false;
export const nativeRestAlerts = () => nativeAlerts;
let last = null;
let queue = Promise.resolve();
function plugin() {
  if (!isNativeApp()) return null;
  const c = window.Capacitor;
  if (c.isPluginAvailable && !c.isPluginAvailable('WorkoutStatus')) return null;
  return bridge ||= c.Plugins?.WorkoutStatus || c.registerPlugin?.('WorkoutStatus');
}

export function initWorkoutStatus(onOpen) {
  try { plugin()?.addListener('openWorkout', onOpen)?.catch?.(() => {}); } catch { /* Older APK. */ }
}

export function publishWorkoutStatus(status, { requestPermission = false } = {}) {
  const p = plugin();
  if (!p) return;
  const value = status ? JSON.stringify(status) : '';
  if (last === value && !requestPermission) return;
  last = value;
  queue = queue.catch(() => {}).then(async () => {
    // Do not post an obsolete snapshot after a permission dialog/account change.
    if (value !== last) return;
    if (!status) { nativeAlerts = false; await p.stop(); return; }
    if (requestPermission) await p.requestPermission();
    if (value !== last) return;
    const result = await p.update(status);
    nativeAlerts = result?.enabled === true;
  }).catch(() => { if (last === value) last = null; });
}
