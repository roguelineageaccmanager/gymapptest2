import { it, expect } from 'vitest';
import { makeUser, uniqueName, befriend } from './helpers.js';

it('theme gifts are visible to the chosen recipient only, even among accepted friends', async () => {
  const a = await makeUser(uniqueName('tha')), b = await makeUser(uniqueName('thb')), c = await makeUser(uniqueName('thc'));
  await befriend(a, b); await befriend(a, c);
  const gift = { owner_id: a.id, recipient_id: b.id, name: 'Ice', appearance: { theme: { base: 'dark', preset: 'custom', color: '#aabbcc' }, buttonColor: '#000000', bodyColor: '#70404c' } };
  expect((await a.client.from('shared_themes').insert(gift)).error).toBeNull();
  expect((await b.client.from('shared_themes').select('name')).data).toEqual([{ name: 'Ice' }]);
  expect((await c.client.from('shared_themes').select('name')).data).toEqual([]);
  expect((await c.client.from('shared_themes').insert(gift)).error).not.toBeNull();
  expect((await a.client.from('shared_themes').insert({ ...gift, appearance: { ...gift.appearance, bodyColor: 'red' } })).error).not.toBeNull();
  expect((await a.client.from('shared_themes').insert({ ...gift, appearance: { ...gift.appearance, url: 'https://invalid.example' } })).error).not.toBeNull();
  expect((await b.client.from('shared_themes').delete().eq('owner_id', a.id)).error).toBeNull();
});

it('friends see a bounded next-workout summary but cannot read the underlying plan', async () => {
  const a = await makeUser(uniqueName('nxa')), b = await makeUser(uniqueName('nxb'));
  await befriend(a, b);
  const day = new Date().toISOString().slice(0, 10), index = (new Date().getUTCDay() + 6) % 7;
  expect((await b.client.from('workout_plans').insert({ user_id: b.id, plan: { workouts: { Push: [{ name: 'Dips' }] }, schedule: { [index]: 'Push' } } })).error).toBeNull();
  const r = await a.client.rpc('friend_next_workouts', { from_day: day });
  expect(r.error).toBeNull(); expect(r.data).toHaveLength(1); expect(r.data[0]).toMatchObject({ user_id: b.id, workout_name: 'Push', workout_date: day });
  expect((await a.client.from('workout_plans').select('*').eq('user_id', b.id)).data).toEqual([]);
  expect((await a.client.rpc('friend_next_workouts', { from_day: '2040-01-01' })).data).toEqual([]);
});
