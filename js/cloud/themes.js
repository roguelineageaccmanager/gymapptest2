import { supabase, requestSharedThemes, requestCommunity } from './client.js';
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
  const rows = await requestCommunity(captured, 'themes');
  return account.user?.id === captured.user.id ? rows : [];
}
export async function shareTheme(preset, expectedUser) {
  const captured = await session();
  if (captured.user.id !== expectedUser) throw new Error('The account changed. Try again.');
  const appearance = cleanAppearance(preset.appearance);
  if (!appearance) throw new Error('This theme is invalid.');
  await requestSharedThemes(captured, 'POST', { owner_id: captured.user.id, recipient_id: null, name: preset.name.slice(0, 40), appearance });
}
export async function removeSharedTheme(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await requestSharedThemes(await session(), 'DELETE', null, id);
}
