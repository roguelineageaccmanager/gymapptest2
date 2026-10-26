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
    expect((await b.client.from('community_messages').delete().eq('id', id).select()).data).toEqual([]);
    expect((await b.client.from('community_messages').insert({ id: randomUUID(), user_id: a.id, body: 'Forged' })).error).not.toBeNull();
    expect((await a.client.from('workout_plans').insert({ user_id: a.id, plan: { workouts: { Private: [{ name: 'Dips' }] }, schedule: {} } })).error).toBeNull();
    expect((await b.client.from('workout_plans').select('*').eq('user_id', a.id)).data).toEqual([]);
    expect((await anonClient().rpc('community_chat')).error).not.toBeNull();
    expect((await a.client.from('community_messages').delete().eq('id', id).select()).data).toHaveLength(1);
  } finally {
    await adminClient().auth.admin.deleteUser(a.id);
    await adminClient().auth.admin.deleteUser(b.id);
  }
});
