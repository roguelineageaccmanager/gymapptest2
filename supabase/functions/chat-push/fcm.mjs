export function messagePayload(row, token, avatar = '') {
  if (!row || !/^[0-9a-f-]{36}$/i.test(row.message_id) || typeof token !== 'string') throw new Error('Invalid queued notification');
  const image=/^https:\/\/[a-z]+\.supabase\.co\/functions\/v1\/chat-push\?avatar=/.test(avatar)?avatar:'';
  return { message: { token, notification: { title: row.display_name?String(row.display_name).slice(0,80):'@' + String(row.username).slice(0, 20), body: String(row.body).slice(0, 160),...(image?{image}:{}) },
    data: { target: 'chat', messageId: row.message_id },
    android: { priority: 'HIGH', ttl: '86400s', collapse_key: 'gym_chat', notification: { channel_id: 'gym_chat_messages_v1', tag: 'gym-chat-' + row.message_id, icon: 'ic_workout_notification', sound: 'default', visibility: 'PRIVATE',...(image?{image}:{}) } },
    webpush: { headers: { TTL: '86400', Urgency: 'high' }, notification: { tag: 'gym-chat-' + row.message_id, icon: image||'https://roguelineageaccmanager.github.io/gymapptest2/icon-192.png' }, fcm_options: { link: 'https://roguelineageaccmanager.github.io/gymapptest2/?open=chat' } },
  } };
}
export function invalidDeviceFailure(failure) {
  const details = failure?.error?.details || [];
  return details.some(detail => detail.errorCode === 'UNREGISTERED') ||
    (failure?.error?.status === 'INVALID_ARGUMENT' && /registration token is not (?:a )?valid|not a valid FCM registration token/i.test(failure?.error?.message || ''));
}
const base64url = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
export async function firebaseAccessToken(service, request = fetch, now = Date.now()) {
  if (!/^[a-z0-9-]+$/.test(service.project_id || '') || !/^[^\s]+@[^\s]+\.iam\.gserviceaccount\.com$/.test(service.client_email || '') || !service.private_key?.includes('BEGIN PRIVATE KEY')) throw new Error('Firebase sender is not configured');
  const encoder = new TextEncoder(), time = Math.floor(now / 1000);
  const encoded = value => base64url(encoder.encode(JSON.stringify(value)));
  const unsigned = encoded({ alg: 'RS256', typ: 'JWT' }) + '.' + encoded({ iss: service.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: time, exp: time + 3600 });
  const bytes = Uint8Array.from(atob(service.private_key.replace(/-----[^-]+-----|\s/g, '')), char => char.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  const response = await request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + base64url(signature) }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Firebase sender authentication failed');
  const result = await response.json();
  if (typeof result.access_token !== 'string') throw new Error('Firebase sender authentication failed');
  return result.access_token;
}
