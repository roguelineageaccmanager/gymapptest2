import { supabase } from './client.js';
import { account } from './sync.js';
import { emit, listen } from '../core/store.js';
import { getActive } from '../ui/session.js';

const activeWindowSeconds = 18;
let lastSeen = new Map();
let owner;
let reading;
let writing;

function readyUser() {
  return !document.hidden && account.ready ? account.user?.id : undefined;
}

export function activityFor(id) {
  return owner === account.user?.id ? lastSeen.get(id) : undefined;
}

export async function refreshPresence() {
  const user = readyUser();
  if (!user || reading === user) return;
  reading = user;
  try {
    const { data, error } = await supabase.rpc('friend_activity');
    if (error || user !== readyUser()) return;
    owner = user;
    lastSeen = new Map((data || []).map(row => [row.user_id, row]));
    emit('gym:presence');
  } catch {
    // Keep the most recent timestamp through a temporary network failure.
  } finally {
    if (reading === user) reading = undefined;
  }
}

async function heartbeat() {
  const user = readyUser();
  if (!user || writing === user) return;
  writing = user;
  try {
    await supabase.rpc('touch_activity', { workout_name: getActive()?.day || null, fast: true });
  } catch {
    // The next heartbeat retries.
  } finally {
    if (writing === user) writing = undefined;
  }
}

export function initPresence() {
  listen('gym:account', () => {
    if (owner !== account.user?.id) { owner = undefined; lastSeen.clear(); }
    heartbeat();
  });
  listen('gym:active-changed', heartbeat);
  document.addEventListener('visibilitychange', heartbeat);
  setInterval(heartbeat, 8000);
  setInterval(() => {
    if (!readyUser() || !document.querySelector('#page-crew.active [data-member-status], .member-profile-sheet [data-member-avatar]')) return;
    emit('gym:presence');
    refreshPresence();
  }, 1000);
}

export function activityLabel(row) {
  if (!row) return '';
  const elapsed = Date.now() - Date.parse(row.seen_at);
  if (!Number.isFinite(elapsed)) return '';
  const seconds = Math.max(0, Math.floor(elapsed / 1000));
  if (seconds < (row.heartbeat_seconds || activeWindowSeconds)) return row.workout ? 'In workout · ' + row.workout : 'Online';
  if (seconds < 60) return 'Last seen ' + seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return 'Last seen ' + minutes + 'm ago';
  if (minutes < 1440) return 'Last seen ' + Math.floor(minutes / 60) + 'h ago';
  return 'Last seen ' + Math.floor(minutes / 1440) + 'd ago';
}
