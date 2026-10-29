import {it,expect} from 'vitest';
import {avatarLink,avatarIdentity} from '../../supabase/functions/chat-push/avatar.mjs';
import {messagePayload} from '../../supabase/functions/chat-push/fcm.mjs';
const base='https://example.supabase.co/functions/v1/chat-push',secret='a'.repeat(64),id='00000000-0000-4000-8000-000000000001',now=1793232000000;
it('authenticates notification photo links and rejects expired, tampered and unsigned requests',async()=>{
 const url=new URL(await avatarLink(base,id,secret,now));
 expect(await avatarIdentity(url,secret,now)).toBe(id);
 expect(await avatarIdentity(url,secret,now+900000)).toBeNull();
 expect(await avatarIdentity(url,'b'.repeat(64),now)).toBeNull();
 const changed=new URL(url);changed.searchParams.set('avatar','00000000-0000-4000-8000-000000000002');expect(await avatarIdentity(changed,secret,now)).toBeNull();
 changed.searchParams.set('avatar',id);changed.searchParams.set('expires',String(Math.floor(now/1000)+901));expect(await avatarIdentity(changed,secret,now)).toBeNull();
 expect(await avatarIdentity(new URL(base+'?avatar='+id),secret,now)).toBeNull();
 expect(url.href).not.toContain(secret);
});
it('uses display names and the signed photo on Android and web with a snake fallback',async()=>{
 const image=await avatarLink(base,id,secret,now),row={message_id:id,username:'leonard_2',display_name:'Leo Gym',body:'Ready?'};
 const {message}=messagePayload(row,'synthetic-token',image);
 expect(message.notification.title).toBe('Leo Gym');expect(message.notification.image).toBe(image);
 expect(message.android.notification.image).toBe(image);expect(message.android.notification.icon).toBe('ic_workout_notification');
 expect(message.webpush.notification.icon).toBe(image);
 expect(messagePayload(row,'synthetic-token','https://elsewhere.test/private').message.notification.image).toBeUndefined();
});
