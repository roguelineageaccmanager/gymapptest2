import { supabase } from './client.js';
import { getActive } from '../ui/session.js';

export function touchActivity() {
  return supabase.rpc('touch_activity', { workout_name: getActive()?.day || null });
}

export function activityLabel(row) {
  if (!row) return '';
  const elapsed = Date.now() - Date.parse(row.seen_at);
  if (!Number.isFinite(elapsed)) return '';
  const seconds = Math.max(0, Math.floor(elapsed / 1000));
  if (seconds < 90) return row.workout ? 'In workout · ' + row.workout : 'Online';
  if (seconds < 120) return 'Last seen ' + seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return 'Last seen ' + minutes + 'm ago';
  if (minutes < 1440) return 'Last seen ' + Math.floor(minutes / 60) + 'h ago';
  return 'Last seen ' + Math.floor(minutes / 1440) + 'd ago';
}
