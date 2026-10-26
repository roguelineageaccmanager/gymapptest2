// Supabase client. cloud-config.js holds the project URL and the browser-safe
// publishable key; supabase-js is vendored (vendor/supabase.js), never loaded from a CDN.

const cfg = window.GYM_CLOUD_CONFIG || {};

// Where password-reset emails send people. Inside the Android app the page
// origin is https://localhost, so fall back to the deployed web app.
export const SITE_URL = cfg.siteUrl || 'https://roguelineageaccmanager.github.io/gymapptest2/';

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
