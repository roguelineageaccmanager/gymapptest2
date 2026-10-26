// Supabase client. cloud-config.js holds the project URL and the browser-safe
// publishable key; supabase-js is vendored (vendor/supabase.js), never loaded from a CDN.

const cfg = window.GYM_CLOUD_CONFIG || {};

export async function requestChatPush(session, action, body) {
  const route = action === 'register' ? 'rpc/register_chat_push' : action === 'settings' ? 'chat_push_settings?on_conflict=user_id' : 'chat_push_devices?id=eq.' + body.device_id + '&user_id=eq.' + session.user.id;
  const response = await boundedFetch(cfg.url.replace(/\/$/, '') + '/rest/v1/' + route, {
    method: action === 'remove' ? 'DELETE' : 'POST', headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    ...(action === 'remove' ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error('Could not save chat notifications. Try again.');
}

export async function requestProgressPhotos(session, method, body, cursor) {
  let query = method === 'GET' ? '?select=id,user_id,image_data,photo_date,caption,created_at,owner:profiles!progress_photos_user_id_fkey(username)&order=created_at.desc,id.desc&limit=30' : method === 'POST' ? '?on_conflict=id' : '?id=eq.' + cursor + '&user_id=eq.' + session.user.id;
  if (method === 'GET' && cursor && /^[0-9a-f-]{36}$/i.test(cursor.id) && /^\d{4}-\d{2}-\d{2}T[0-9:.+Z-]+$/.test(cursor.created_at)) {
    query += '&or=' + encodeURIComponent('(created_at.lt.' + cursor.created_at + ',and(created_at.eq.' + cursor.created_at + ',id.lt.' + cursor.id + '))');
  }
  const response = await boundedFetch(cfg.url.replace(/\/$/, '') + '/rest/v1/progress_photos' + query, {
    method, headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (error.message === 'You can keep up to 200 progress pictures. Remove an older picture first.') throw new Error(error.message);
    throw new Error('Could not load or save pictures. Try again.');
  }
  return method === 'GET' ? response.json() : null;
}

export async function requestProfileBanners(session, ids, banner) {
  const query = ids ? '?select=user_id,color,image_data,avatar_color&user_id=in.(' + ids.join(',') + ')' : '?user_id=eq.' + session.user.id;
  const response = await boundedFetch(cfg.url.replace(/\/$/, '') + '/rest/v1/profile_banners' + query, {
    method: ids ? 'GET' : banner === null ? 'DELETE' : 'POST',
    headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    ...(!ids && banner !== null ? { body: JSON.stringify({ user_id: session.user.id, ...banner, updated_at: new Date().toISOString() }) } : {}),
  });
  if (!response.ok) throw new Error('Could not save or load the banner. Try again.');
  return ids ? response.json() : null;
}

export async function requestProfileSummary(session) {
  const response = await boundedFetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/friend_summaries', {
    method: 'POST', headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!response.ok) throw new Error('Could not load this profile. Try again.');
  return response.json();
}

// Every community request uses the account token captured when the action began.
export async function requestCommunity(session, action, body, id) {
  const routes = {
    themes: ['POST', 'rpc/community_themes'],
    messages: ['POST', 'rpc/community_chat_v4'],
    members: ['POST', 'rpc/community_members'],
    send: ['POST', 'rpc/send_chat_reply'],
    remove: ['DELETE', 'community_messages?id=eq.' + id + '&user_id=eq.' + session.user.id],
  };
  const [method, route] = routes[action];
  const response = await boundedFetch(cfg.url.replace(/\/$/, '') + '/rest/v1/' + route, {
    method, headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (['Wait a moment before sending more messages.', 'This message is no longer available.'].includes(error.message)) throw new Error(error.message);
    throw new Error('Could not connect. Try again.');
  }
  return method === 'POST' ? response.json() : null;
}

// Where password-reset emails send people. Inside the Android app the page
// origin is https://localhost, so fall back to the deployed web app.
export const SITE_URL = cfg.siteUrl || 'https://roguelineageaccmanager.github.io/gymapptest2/';
export async function requestRoutineSharing(session, method, body, id) {
  const filter = '?owner_id=eq.' + session.user.id + (method === 'GET' ? '&select=id,title' : id ? '&id=eq.' + id : '');
  const response = await boundedFetch(cfg.url.replace(/\/$/, '') + '/rest/v1/shared_workouts' + (method === 'POST' ? '' : filter), {
    method, headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error('Could not update routine sharing. Check your connection and try again.');
  return method === 'GET' ? response.json() : null;
}
export async function requestSharedThemes(session, method, body, id) {
  const query = method === 'GET' ? '?select=id,owner_id,recipient_id,name,appearance,owner:profiles!shared_themes_owner_id_fkey(username),recipient:profiles!shared_themes_recipient_id_fkey(username)&order=created_at.desc&limit=100' : id ? '?id=eq.' + id : '';
  const r = await boundedFetch(cfg.url.replace(/\/$/, '') + '/rest/v1/shared_themes' + query, {
    method, headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error('Could not load or share themes. Check your connection and try again.');
  return method === 'GET' ? r.json() : null;
}

export async function requestProfilePictures(session, ids, image) {
  const query = ids ? '?select=user_id,image_data&user_id=in.(' + ids.join(',') + ')' : '?user_id=eq.' + session.user.id;
  const response = await boundedFetch(cfg.url.replace(/\/$/, '') + '/rest/v1/profile_pictures' + query, {
    method: ids ? 'GET' : image === null ? 'DELETE' : 'POST',
    headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    ...(!ids && image !== null ? { body: JSON.stringify({ user_id: session.user.id, image_data: image, updated_at: new Date().toISOString() }) } : {}),
  });
  if (!response.ok) throw new Error('Could not save the profile picture. Check your connection and try again.');
  return ids ? response.json() : null;
}

export function cloudConfigured() {
  return !!(window.supabase && cfg.url && cfg.anonKey && !/YOUR_|PASTE_/i.test(cfg.url + cfg.anonKey));
}

// Fail fast when offline and give up on a stuck request after 15 s, so a sync
// never keeps the user waiting.
function boundedFetch(input, init = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.reject(new TypeError('Failed to fetch (offline)'));
  // AbortSignal.timeout/any are missing in older Android WebViews; build it by hand.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('The request timed out', 'TimeoutError')), 15000);
  if (init.signal) {
    if (init.signal.aborted) controller.abort(init.signal.reason);
    else init.signal.addEventListener('abort', () => controller.abort(init.signal.reason), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = cloudConfigured()
  ? window.supabase.createClient(cfg.url, cfg.anonKey, {
    // PKCE: a sign-in link is accepted only by the browser that asked for it,
    // so nobody can sign this app into their account by sending a link.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    global: { fetch: boundedFetch },
    // Sync retries on its own schedule; built-in backoff (1+2+4 s per request) only delays errors.
    db: { retry: false },
  })
  : null;

// A captured token binds the request to its original account even if another
// tab switches accounts while the request is waiting. Never use preferences
// as authorization data; they are the user's editable appearance choices.
export async function requestAccountPreferences(session, preferences) {
  const response = await boundedFetch(cfg.url.replace(/\/$/, '') + '/auth/v1/user', {
    method: preferences === undefined ? 'GET' : 'PUT',
    headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
    ...(preferences === undefined ? {} : { body: JSON.stringify({ data: { tracker_preferences: preferences } }) }),
  });
  const user = await response.json();
  if (!response.ok) throw new Error(user.msg || user.message || 'Could not save account settings.');
  if (user.id !== session.user.id) throw new Error('The account changed. Settings will sync again.');
  return user.user_metadata?.tracker_preferences;
}

/** True when an error means a table or function from a newer migration is missing. */
export function isMissingSchema(error) {
  return !!error && ['PGRST202', 'PGRST205', '42P01', '42883', '42703'].includes(error.code);
}

/** Short, friendly text for an error from Supabase or the network. */
export function errorText(error, fallback = 'Something went wrong. Try again.') {
  if (!error) return fallback;
  if (error.message && /Failed to fetch|NetworkError|Load failed|aborted|timed? ?out/i.test(error.message)) return 'No connection. Try again when you are online.';
  if (error.code === '23505') return 'That already exists.';
  if (error.code === '54000') return error.message;
  if (error.code === '22023') return error.message;
  return error.message || fallback;
}
