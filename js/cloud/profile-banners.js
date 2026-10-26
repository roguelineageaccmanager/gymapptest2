import { supabase, requestProfileBanners, requestProfileSummary } from './client.js';
import { account } from './sync.js';
import { emit } from '../core/store.js';
import { isHex } from '../domain/theme.js';

let owner = null;
let revision = 0;
const banners = new Map();
export const validBannerImage = value => typeof value === 'string' && value.length <= 180000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value);
export function cleanBanner(value) {
  return value && isHex(value.color) && (value.image_data == null || validBannerImage(value.image_data))
    && (value.avatar_color == null || isHex(value.avatar_color))
    ? { color: value.color.toLowerCase(), image_data: value.image_data || null, avatar_color: value.avatar_color?.toLowerCase() || null } : null;
}
function reset() {
  const id = account.user?.id || null;
  if (owner !== id) { owner = id; banners.clear(); revision++; }
  return id;
}
export function profileBanner(id) { reset(); return banners.get(id) || null; }
async function sessionFor(id) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !account.ready || data.session?.user.id !== id || account.user?.id !== id) throw new Error('The account changed. Try again.');
  return data.session;
}
export async function loadProfileBanners(ids) {
  const id = reset();
  if (!id || !supabase || !account.ready) return;
  const wanted = [...new Set([id, ...ids])].filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  const started = revision;
  try {
    const rows = await requestProfileBanners(await sessionFor(id), wanted);
    if (account.user?.id !== id || started !== revision) return;
    wanted.forEach(key => banners.delete(key));
    for (const row of rows) { const banner = cleanBanner(row); if (banner) banners.set(row.user_id, banner); }
    emit('gym:banners');
  } catch { /* Keep the default banner when offline or on an older server. */ }
}
export async function saveProfileBanner(banner, expectedUser) {
  const id = reset(), safe = banner === null ? null : cleanBanner(banner);
  if (!id || id !== expectedUser || (banner !== null && !safe)) throw new Error('Choose a valid banner for this account.');
  await requestProfileBanners(await sessionFor(id), null, safe);
  if (account.user?.id !== id) return;
  revision++;
  if (safe) banners.set(id, safe); else banners.delete(id);
  emit('gym:banners');
}
export async function loadMemberProfile(userId) {
  const id = reset();
  if (!id || !/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('This profile is unavailable.');
  const rows = await requestProfileSummary(await sessionFor(id));
  if (account.user?.id !== id) throw new Error('The account changed.');
  return rows.find(row => row.user_id === userId) || null;
}
export async function prepareBannerImage(file) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Choose a JPEG, PNG or WebP under 10 MB.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 768, 256);
    const scale = Math.max(768 / bitmap.width, 256 / bitmap.height);
    const width = 768 / scale, height = 256 / scale;
    ctx.drawImage(bitmap, (bitmap.width - width) / 2, (bitmap.height - height) / 2, width, height, 0, 0, 768, 256);
    for (const quality of [0.82, 0.65, 0.45]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (validBannerImage(result)) return result;
    }
    throw new Error('This image could not be resized. Try another one.');
  } finally { bitmap.close(); }
}
