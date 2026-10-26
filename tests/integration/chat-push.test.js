import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { makeUser, uniqueName, adminClient, anonClient } from './helpers.js';
it('chat push tokens are private, installation-bound, opt-in and exclude senders and blocked members', async () => {
  const a = await makeUser(uniqueName('psa')), b = await makeUser(uniqueName('psb')), c = await makeUser(uniqueName('psc'));
  const device = randomUUID(), key = 'a'.repeat(64), token = 'synthetic-fcm-' + 'b'.repeat(50);
  const register = (client, id, value, secret = key) => client.rpc('register_chat_push', { device_id: id, device_token: value, device_key: secret });
  const message = async () => { const id = randomUUID(); expect((await a.client.rpc('send_chat_reply', { message_id: id, message_body: 'Synthetic push check', reply_id: null })).error).toBeNull(); return id; };
  const claimedRows = new Map();
  const claim = async id => {
    if (claimedRows.has(id)) return claimedRows.get(id);
    for (let i = 0; i < 10; i++) { const response = await adminClient().rpc('claim_chat_pushes', { batch_size: 20 }); expect(response.error).toBeNull(); response.data.forEach(row => claimedRows.set(row.message_id, row)); const row = claimedRows.get(id); if (row) return row; }
    throw new Error('Test message not claimed');
  };
  try {
    expect((await register(a.client, device, token)).error).toBeNull();
    expect((await b.client.from('chat_push_devices').select('*').eq('id', device)).data).toEqual([]);
    expect((await register(b.client, device, token, 'c'.repeat(64))).error).not.toBeNull();
    expect((await register(b.client, device, token)).error).toBeNull();
    expect((await a.client.from('chat_push_devices').select('*').eq('id', device)).data).toEqual([]);
    expect((await register(a.client, randomUUID(), 'sender-' + 'd'.repeat(50))).error).toBeNull();
    expect((await register(c.client, randomUUID(), 'muted-' + 'e'.repeat(50))).error).toBeNull();
    const old = await message();
    expect((await b.client.from('chat_push_settings').upsert({ user_id: b.id, enabled: true })).error).toBeNull();
    expect((await a.client.from('chat_push_settings').upsert({ user_id: a.id, enabled: true })).error).toBeNull();
    const first = await message();
    const claimed = await claim(first); expect(claimed.devices).toEqual([{ id: device, token }]);
    // Enabling notifications never replays messages sent before opt-in.
    expect((await claim(old)).devices).toEqual([]);
    expect((await b.client.from('chat_push_settings').upsert({ user_id: b.id, enabled: false })).error).toBeNull();
    expect((await claim(await message())).devices).toEqual([]);
    expect((await b.client.from('chat_push_settings').upsert({ user_id: b.id, enabled: true })).error).toBeNull();
    expect((await a.client.from('friend_blocks').insert({ blocker_id: a.id, blocked_id: b.id })).error).toBeNull();
    expect((await claim(await message())).devices).toEqual([]);
    expect((await a.client.rpc('claim_chat_pushes', { batch_size: 20 })).error).not.toBeNull();
    expect((await b.client.from('chat_push_queue').select('*')).error).not.toBeNull();
    expect((await anonClient().rpc('register_chat_push', { device_id: randomUUID(), device_token: token, device_key: key })).error).not.toBeNull();
    expect((await b.client.from('chat_push_devices').delete().eq('id', device).select()).data).toHaveLength(1);
  } finally { for (const user of [a, b, c]) await adminClient().auth.admin.deleteUser(user.id); }
});
