import { supabase, requestSharedThemes } from './client.js';
import { account } from './sync.js';
import { cleanAppearance } from '../domain/appearance.js';

async function session() {
  const uid = account.user?.id;
  const { data, error } = await supabase.auth.getSession();
  if (error || !account.ready || !uid || data.session?.user.id !== uid || account.user?.id !== uid) throw new Error('Sign in to share themes.');
  return data.session;
}
export async function sharedThemes() {
  const captured = await session();
  const rows = await requestSharedThemes(captured, 'GET');
  return account.user?.id === captured.user.id ? rows : [];
}
export async function shareTheme(preset, recipient, expectedUser) {
  const captured = await session();
  if (captured.user.id !== expectedUser || !/^[0-9a-f-]{36}$/i.test(recipient)) throw new Error('The account changed. Try again.');
  const appearance = cleanAppearance(preset.appearance);
  if (!appearance) throw new Error('This theme is invalid.');
  await requestSharedThemes(captured, 'POST', { owner_id: captured.user.id, recipient_id: recipient, name: preset.name.slice(0, 40), appearance });
}
export async function removeSharedTheme(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await requestSharedThemes(await session(), 'DELETE', null, id);
}
