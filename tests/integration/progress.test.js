import { it, expect } from 'vitest';
import { makeUser, uniqueName, adminClient, anonClient } from './helpers.js';
import { randomUUID } from 'node:crypto';

it('progress pictures are owner/accepted-friend readable and owner-removable only', async () => {
  const owner = await makeUser(uniqueName('pho')), friend = await makeUser(uniqueName('phf')), stranger = await makeUser(uniqueName('phs'));
  try {
    const row = { id: randomUUID(), user_id: owner.id, image_data: 'data:image/jpeg;base64,YQ==', photo_date: '2026-10-26', caption: 'Week one' };
    expect((await owner.client.from('progress_photos').insert(row)).error).toBeNull();
    expect((await stranger.client.from('progress_photos').select('*').eq('id', row.id)).data).toEqual([]);
    const request = await owner.client.from('friend_requests').insert({ requester_id: owner.id, target_id: friend.id, status: 'pending' }).select('id').single();
    expect(request.error).toBeNull();
    expect((await friend.client.from('progress_photos').select('*').eq('id', row.id)).data).toEqual([]);
    expect((await friend.client.from('friend_requests').update({ status: 'accepted' }).eq('id', request.data.id)).error).toBeNull();
    expect((await friend.client.from('progress_photos').select('*').eq('id', row.id)).data).toHaveLength(1);
    expect((await friend.client.from('progress_photos').delete().eq('id', row.id).select()).data).toEqual([]);
    expect((await friend.client.from('progress_photos').insert({ ...row, id: randomUUID() })).error).not.toBeNull();
    expect((await owner.client.from('progress_photos').insert({ ...row, id: randomUUID(), image_data: 'https://invalid.example/photo' })).error).not.toBeNull();
    expect((await anonClient().from('progress_photos').select('*')).error).not.toBeNull();
    expect((await owner.client.from('friend_blocks').insert({ blocker_id: owner.id, blocked_id: friend.id })).error).toBeNull();
    expect((await friend.client.from('progress_photos').select('*').eq('id', row.id)).data).toEqual([]);
    expect((await owner.client.from('progress_photos').delete().eq('id', row.id).select()).data).toHaveLength(1);
  } finally { for (const user of [owner, friend, stranger]) await adminClient().auth.admin.deleteUser(user.id); }
});
