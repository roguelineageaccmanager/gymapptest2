import { it, expect } from 'vitest';
import { makeUser, uniqueName, befriend } from './helpers.js';

it('profile pictures belong to their owner and are visible only to accepted friends', async () => {
  const a = await makeUser(uniqueName('pica')), b = await makeUser(uniqueName('picb')), stranger = await makeUser(uniqueName('pics'));
  const picture = { user_id: a.id, image_data: 'data:image/jpeg;base64,AAAA' };
  expect((await a.client.from('profile_pictures').insert(picture)).error).toBeNull();
  expect((await stranger.client.from('profile_pictures').select('*')).data).toEqual([]);
  expect((await b.client.from('profile_pictures').select('*')).data).toEqual([]);
  expect((await stranger.client.from('profile_pictures').insert(picture)).error).not.toBeNull();
  await befriend(a, b);
  expect((await b.client.from('profile_pictures').select('user_id,image_data')).data).toEqual([picture]);
  expect((await b.client.from('profile_pictures').delete().eq('user_id', a.id).select()).data).toEqual([]);
  expect((await a.client.from('profile_pictures').delete().eq('user_id', a.id)).error).toBeNull();
  expect((await b.client.from('profile_pictures').select('*')).data).toEqual([]);
});
