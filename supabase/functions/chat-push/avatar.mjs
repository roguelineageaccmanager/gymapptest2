const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
const keyFor = secret => crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const payload = (id,expires) => encoder.encode('gym-chat-avatar-v1|'+id+'|'+expires);
export async function avatarLink(base,id,secret,now=Date.now()) {
  if(!uuid.test(id)||secret.length<32)throw new Error('Invalid notification identity');
  const expires=String(Math.floor(now/1000)+900);
  const signature=await crypto.subtle.sign('HMAC',await keyFor(secret),payload(id,expires));
  const url=new URL(base);url.search='';url.searchParams.set('avatar',id);url.searchParams.set('expires',expires);
  url.searchParams.set('signature',[...new Uint8Array(signature)].map(n=>n.toString(16).padStart(2,'0')).join(''));
  return url.href;
}
export async function avatarIdentity(url,secret,now=Date.now()) {
  const id=url.searchParams.get('avatar')||'',expires=url.searchParams.get('expires')||'',signature=url.searchParams.get('signature')||'';
  const time=Math.floor(now/1000);
  if(!uuid.test(id)||!/^\d{10}$/.test(expires)||Number(expires)<=time||Number(expires)>time+900||!/^[0-9a-f]{64}$/.test(signature)||secret.length<32)return null;
  const bytes=Uint8Array.from(signature.match(/../g),n=>parseInt(n,16));
  return await crypto.subtle.verify('HMAC',await keyFor(secret),bytes,payload(id,expires))?id:null;
}
