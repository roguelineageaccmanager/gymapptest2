import { it, expect } from 'vitest';
import { makeUser, uniqueName, befriend, anonClient, adminClient } from './helpers.js';

it('profile banners allow only owner changes and accepted-friend reads', async () => {
  const a = await makeUser(uniqueName('bna')), b = await makeUser(uniqueName('bnb')), c = await makeUser(uniqueName('bnc'));
  try {
    const banner = { user_id: a.id, color: '#123abc', image_data: 'data:image/jpeg;base64,YQ==' };
    expect((await a.client.from('profile_banners').insert(banner)).error).toBeNull();
    expect((await b.client.from('profile_banners').select('*').eq('user_id', a.id)).data).toEqual([]);
    await befriend(a, b);
    expect((await b.client.from('profile_banners').select('color').eq('user_id', a.id)).data).toEqual([{ color: '#123abc' }]);
    expect((await c.client.from('profile_banners').select('*').eq('user_id', a.id)).data).toEqual([]);
    expect((await b.client.from('profile_banners').update({ color: '#ffffff' }).eq('user_id', a.id).select()).data).toEqual([]);
    expect((await b.client.from('profile_banners').upsert({ ...banner, color: '#ffffff' })).error).not.toBeNull();
    expect((await a.client.from('profile_banners').update({ image_data: 'https://invalid.example/banner.jpg' }).eq('user_id', a.id)).error).not.toBeNull();
    expect((await anonClient().from('profile_banners').select('*')).error).not.toBeNull();
    expect((await a.client.from('friend_blocks').insert({ blocker_id: a.id, blocked_id: b.id })).error).toBeNull();
    expect((await b.client.from('profile_banners').select('*').eq('user_id', a.id)).data).toEqual([]);
    expect((await a.client.from('profile_banners').delete().eq('user_id', a.id).select()).data).toHaveLength(1);
  } finally {
    for (const user of [a, b, c]) await adminClient().auth.admin.deleteUser(user.id);
  }
});
