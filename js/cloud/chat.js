import { supabase, requestCommunity } from './client.js';
import { cleanEmoji } from '../domain/emoji.js';
import { account } from './sync.js';

async function session(expectedUser) {
  const uid = account.user?.id;
  const { data, error } = await supabase.auth.getSession();
  if (error || !account.ready || !uid || data.session?.user.id !== uid || account.user?.id !== uid || (expectedUser && uid !== expectedUser)) throw new Error('Sign in to chat.');
  return data.session;
}
export async function messages(before) {
  const captured = await session();
  const rows = await requestCommunity(captured, 'messages', before ? { before_time: before.created_at, before_id: before.id } : {});
  if (account.user?.id !== captured.user.id) return [];
  const reactions=rows.length ? await requestCommunity(captured,'reactions',{message_ids:rows.map(m=>m.id)}) : [];
  return account.user?.id===captured.user.id ? rows.map(m=>({...m,reactions:reactions.filter(r=>r.message_id===m.id)})) : [];
}
export async function sendMessage(id, text, uid, replyId = null) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !text.trim() || text.length > 1000) throw new Error('Write a message of up to 1000 characters.');
  return requestCommunity(await session(uid), 'send', { message_id: id, message_body: text.trim(), reply_id: replyId });
}
export async function removeMessage(id, uid) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  return requestCommunity(await session(uid), 'remove', null, id);
}

export async function reactMessage(id,emoji,enabled,uid) {
  const reaction=cleanEmoji(emoji);if(!reaction || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Choose an emoji.');
  return requestCommunity(await session(uid),'react',{message_id:id,reaction,enabled});
}
export async function editMessage(id,text,uid) {
  if(!/^[0-9a-f-]{36}$/i.test(id)||!text.trim()||text.length>1000)throw new Error('Write a message of up to 1000 characters.');
  return requestCommunity(await session(uid),'edit',{message_id:id,message_body:text.trim()});
}
