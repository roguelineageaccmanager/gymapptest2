import { messagePayload, firebaseAccessToken, invalidDeviceFailure } from './fcm.mjs';
import { avatarLink, avatarIdentity } from './avatar.mjs';

let cachedToken = '', tokenExpires = 0;
const env = name => Deno.env.get(name) || '';
async function sameSecret(a, b) {
  if (!a || !b) return false;
  const digest = value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  return new Uint8Array(x).reduce((difference, byte, i) => difference | (byte ^ new Uint8Array(y)[i]), 0) === 0;
}
async function database(route, method = 'POST', body) {
  const response = await fetch(env('SUPABASE_URL') + '/rest/v1/' + route, { method,
    headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY'), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Notification queue unavailable');
  return response.status === 204 || method === 'PATCH' || method === 'DELETE' ? null : response.json();
}
Deno.serve(async request => {
  if(request.method==='GET' && new URL(request.url).searchParams.has('avatar')) {
    try {
      const id=await avatarIdentity(new URL(request.url),env('CHAT_PUSH_WEBHOOK_KEY'));
      if(!id)return new Response(null,{status:403});
      const photos=await database('profile_pictures?user_id=eq.'+id+'&select=image_data','GET');
      const image=photos[0]?.image_data;
      if(typeof image!=='string'||image.length>100000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image))return new Response(null,{status:404});
      const bytes=Uint8Array.from(atob(image.split(',')[1]),c=>c.charCodeAt(0));
      return new Response(bytes,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
    }catch{return new Response(null,{status:503});}
  }
  if (request.method !== 'POST' || !await sameSecret(request.headers.get('x-gym-push-key'), env('CHAT_PUSH_WEBHOOK_KEY'))) return new Response(null, { status: 401 });
  try {
    const service = JSON.parse(env('FIREBASE_SERVICE_ACCOUNT'));
    if (tokenExpires < Date.now()) { cachedToken = await firebaseAccessToken(service); tokenExpires = Date.now() + 3300000; }
    if (new URL(request.url).searchParams.get('health') === '1') return Response.json({ ready: true });
    const token = cachedToken;
    const rows = await database('rpc/claim_chat_pushes', 'POST', { batch_size: 20 });
    let delivered = 0, retries = 0;
    for (const row of rows) {
      let retry = false;
      const profiles=await database('profiles?id=eq.'+row.sender_id+'&select=display_name','GET');
      row.display_name=profiles[0]?.display_name;
      const image=await avatarLink(env('SUPABASE_URL')+'/functions/v1/chat-push',row.sender_id,env('CHAT_PUSH_WEBHOOK_KEY'));
      for (const device of row.devices || []) {
        try {
          const response = await fetch('https://fcm.googleapis.com/v1/projects/' + service.project_id + '/messages:send', {
            method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(messagePayload(row, device.token,image)), signal: AbortSignal.timeout(15000),
          });
          if (response.ok) continue;
          const failure = await response.json().catch(() => ({}));
          if (invalidDeviceFailure(failure)) {
            await database('chat_push_devices?id=eq.' + device.id + '&token=eq.' + encodeURIComponent(device.token), 'DELETE');
          } else retry = true;
        } catch { retry = true; }
      }
      await database('chat_push_queue?message_id=eq.' + row.message_id, 'PATCH', retry ? { claimed_at: null } : { delivered_at: new Date().toISOString() });
      if (retry) retries++; else delivered++;
    }
    return Response.json({ delivered, retries });
  } catch { return Response.json({ error: 'Notification sender unavailable' }, { status: 503 }); }
});
