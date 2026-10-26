import { supabase, requestProgressPhotos } from './client.js';
import { account } from './sync.js';
import { validProgressImage } from '../domain/progress.js';
import { ymd, parseYmd } from '../core/dates.js';

async function session(expected) {
  const id = account.user?.id, { data, error } = await supabase.auth.getSession();
  if (error || !id || !account.ready || data.session?.user.id !== id || account.user?.id !== id || (expected && expected !== id)) throw new Error('Sign in again to post progress pictures.');
  return data.session;
}
export async function progressPhotos(before) { return requestProgressPhotos(await session(), 'GET', null, before); }
export async function postProgressPhoto(photo, expected) {
  if (!validProgressImage(photo.image_data) || !/^\d{4}-\d{2}-\d{2}$/.test(photo.photo_date) || ymd(parseYmd(photo.photo_date)) !== photo.photo_date || typeof photo.caption !== 'string' || photo.caption.length > 160) throw new Error('Check the picture, date and caption.');
  return requestProgressPhotos(await session(expected), 'POST', { ...photo, user_id: expected });
}
export async function deleteProgressPhoto(id, expected) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  return requestProgressPhotos(await session(expected), 'DELETE', null, id);
}
