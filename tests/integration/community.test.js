import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { makeUser, uniqueName, adminClient, anonClient } from './helpers.js';

it('bounds both chat APIs and paginates without duplicate messages', async () => {
  const user = await makeUser(uniqueName('page'));
  try {
    const rows = Array.from({ length: 55 }, (_, i) => ({ id: randomUUID(), user_id: user.id, body: 'Synthetic page ' + i, created_at: new Date(Date.now() + i * 1000).toISOString() }));
    expect((await adminClient().from('community_messages').insert(rows)).error).toBeNull();
    for (const api of ['community_chat', 'community_chat_v4']) {
      const first = await user.client.rpc(api);
      expect(first.error).toBeNull(); expect(first.data).toHaveLength(50);
      const last = first.data.at(-1);
      const next = await user.client.rpc(api, { before_time: last.created_at, before_id: last.id });
      expect(next.error).toBeNull(); expect(next.data.length).toBeGreaterThanOrEqual(5); expect(next.data.length).toBeLessThanOrEqual(50);
      expect(next.data.some(row => first.data.some(previous => row.id === previous.id))).toBe(false);
    }
  } finally { await adminClient().auth.admin.deleteUser(user.id); }
});

it('signed-in strangers share public themes/chat without access to private training data', async () => {
  const a = await makeUser(uniqueName('cma')), b = await makeUser(uniqueName('cmb'));
  try {
    const theme = { owner_id: a.id, recipient_id: null, name: 'Public ice', appearance: { theme: { base: 'dark', preset: 'custom', color: '#aabbcc' } } };
    expect((await a.client.from('shared_themes').insert(theme)).error).toBeNull();
    const gallery = await b.client.rpc('community_themes');
    expect(gallery.error).toBeNull(); expect(gallery.data.find(t => t.owner_id === a.id)).toMatchObject({ name: 'Public ice', username: a.username });
    const id = randomUUID();
    expect((await a.client.rpc('send_community_message', { message_id: id, message_body: 'Gym at six?' })).error).toBeNull();
    expect((await a.client.rpc('send_community_message', { message_id: id, message_body: 'Gym at six?' })).error).toBeNull();
    const chat = await b.client.rpc('community_chat');
    expect(chat.error).toBeNull(); expect(chat.data.filter(m => m.id === id)).toHaveLength(1);
    expect(chat.data.find(m => m.id === id)).toMatchObject({ user_id: a.id, username: a.username, body: 'Gym at six?' });
    const reply = randomUUID();
    expect((await b.client.rpc('send_chat_reply', { message_id: reply, message_body: 'See you there', reply_id: id })).error).toBeNull();
    expect((await b.client.rpc('send_chat_reply', { message_id: reply, message_body: 'Retry', reply_id: null })).error).toBeNull();
    const threaded = await b.client.rpc('community_chat_v4');
    expect(threaded.error).toBeNull();
    expect(threaded.data.find(m => m.id === reply)).toMatchObject({ body: 'See you there', reply_to: id, reply_body: 'Gym at six?', reply_username: a.username });
    expect((await a.client.from('profile_pictures').insert({ user_id: a.id, image_data: 'data:image/jpeg;base64,YQ==' })).error).toBeNull();
    const members = await b.client.rpc('community_members', { member_ids: [a.id] });
    expect(members.error).toBeNull(); expect(members.data[0]).toMatchObject({ user_id: a.id, username: a.username, image_data: 'data:image/jpeg;base64,YQ==' });
    expect((await b.client.from('profile_pictures').select('*').eq('user_id', a.id)).data).toEqual([]);
    expect((await anonClient().rpc('community_chat_v4')).error).not.toBeNull();
    expect((await anonClient().rpc('community_members', { member_ids: [a.id] })).error).not.toBeNull();
    expect((await b.client.from('community_messages').delete().eq('id', id).select()).data).toEqual([]);
    expect((await b.client.from('community_messages').insert({ id: randomUUID(), user_id: a.id, body: 'Forged' })).error).not.toBeNull();
    expect((await a.client.from('workout_plans').insert({ user_id: a.id, plan: { workouts: { Private: [{ name: 'Dips' }] }, schedule: {} } })).error).toBeNull();
    expect((await b.client.from('workout_plans').select('*').eq('user_id', a.id)).data).toEqual([]);
    expect((await anonClient().rpc('community_chat')).error).not.toBeNull();
    expect((await a.client.from('community_messages').delete().eq('id', id).select()).data).toHaveLength(1);
    expect((await b.client.rpc('community_chat_v4')).data.find(m => m.id === reply).reply_to).toBeNull();
  } finally {
    await adminClient().auth.admin.deleteUser(a.id);
    await adminClient().auth.admin.deleteUser(b.id);
  }
});


it('chat edits are owner-only and reactions are bounded, owned and cleaned up with messages',async()=>{
 const a=await makeUser(uniqueName('edit')),b=await makeUser(uniqueName('react')),id=randomUUID();
 try{
  expect((await a.client.rpc('send_community_message',{message_id:id,message_body:'Before'})).error).toBeNull();
  expect((await b.client.rpc('edit_community_message',{message_id:id,message_body:'Forged'})).error).not.toBeNull();
  expect((await a.client.rpc('edit_community_message',{message_id:id,message_body:'After'})).error).toBeNull();
  expect((await b.client.rpc('community_chat_v4')).data.find(m=>m.id===id).body).toBe('After');
  for(const user of [a,b])expect((await user.client.rpc('set_community_reaction',{message_id:id,reaction:'🔥',enabled:true})).error).toBeNull();
  expect((await a.client.rpc('community_reactions_for',{message_ids:[id]})).data).toEqual([{message_id:id,emoji:'🔥',count:2,mine:true}]);
  expect((await a.client.rpc('set_community_reaction',{message_id:id,reaction:'🔥',enabled:false})).error).toBeNull();
  expect((await a.client.rpc('community_reactions_for',{message_ids:[id]})).data[0]).toMatchObject({count:1,mine:false});
  expect((await a.client.rpc('set_community_reaction',{message_id:id,reaction:'<svg>',enabled:true})).error).not.toBeNull();
  expect((await anonClient().rpc('community_reactions_for',{message_ids:[id]})).error).not.toBeNull();
  expect((await a.client.rpc('community_reactions_for',{message_ids:Array(51).fill(id)})).error).not.toBeNull();
  expect((await a.client.from('community_messages').delete().eq('id',id)).error).toBeNull();
  expect((await b.client.rpc('community_reactions_for',{message_ids:[id]})).data).toEqual([]);
 }finally{await adminClient().auth.admin.deleteUser(a.id);await adminClient().auth.admin.deleteUser(b.id);}
});
