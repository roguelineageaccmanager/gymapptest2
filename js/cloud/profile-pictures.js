// Account-bound picture requests. Only tiny, locally re-encoded JPEGs are stored.
import { supabase, requestProfilePictures } from './client.js';
import { account } from './sync.js';
import { emit } from '../core/store.js';

let owner = null;
let revision = 0;
const pictures = new Map();
export const validProfilePicture = value => typeof value === 'string' && value.length <= 100000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value);
function resetForAccount() {
  const id = account.user?.id || null;
  if (owner !== id) { owner = id; pictures.clear(); revision++; }
  return id;
}
export function profilePicture(id) { resetForAccount(); return pictures.get(id) || ''; }
export function pictureRevision() { resetForAccount(); return revision; }
export function cacheChatPictures(rows, accountId, started) {
  if (resetForAccount() !== accountId || revision !== started) return;
  for (const row of rows) {
    if (validProfilePicture(row.image_data)) pictures.set(row.user_id, row.image_data);
    else pictures.delete(row.user_id);
  }
  emit('gym:pictures');
}

async function sessionFor(id) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== id || account.user?.id !== id) throw new Error('Sign in again to change your picture.');
  return data.session;
}
export async function loadProfilePictures(ids) {
  const id = resetForAccount();
  if (!id || !supabase || !account.ready) return;
  const wanted = [...new Set([id, ...ids])].filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 300);
  const started = revision;
  try {
    const rows = await requestProfilePictures(await sessionFor(id), wanted);
    if (account.user?.id !== id || started !== revision) return;
    wanted.forEach(key => pictures.delete(key));
    for (const row of rows) if (validProfilePicture(row.image_data)) pictures.set(row.user_id, row.image_data);
    emit('gym:pictures');
  } catch { /* Keep initials when offline or on an older server. */ }
}
export async function saveProfilePicture(image, expectedUser) {
  const id = resetForAccount();
  if (!id || id !== expectedUser || !account.ready) throw new Error('The account changed. Choose the picture again.');
  if (image !== null && !validProfilePicture(image)) throw new Error('Choose a JPEG, PNG or WebP picture.');
  await requestProfilePictures(await sessionFor(id), null, image);
  if (account.user?.id !== id) return;
  revision++;
  if (image) pictures.set(id, image); else pictures.delete(id);
  emit('gym:pictures');
}

export async function prepareProfilePicture(file) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Choose a JPEG, PNG or WebP under 10 MB.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 192, 192);
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 192, 192);
    const result = canvas.toDataURL('image/jpeg', 0.82);
    if (!validProfilePicture(result)) throw new Error('This picture could not be resized. Try another one.');
    return result;
  } finally { bitmap.close(); }
}
