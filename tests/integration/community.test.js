import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { makeUser, uniqueName, adminClient, anonClient } from './helpers.js';

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
