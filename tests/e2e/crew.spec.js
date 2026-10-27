// Gym dates, friends, ranking and shared routines, end to end with two users.
import { test, expect, tab, friendsPair, createWorkout, fillPrompt } from './helpers.js';

test('automatically shares scores and keeps opt-out controls in Settings',async({browser})=>{
  const {a,b,pa,pb,errors}=await friendsPair(browser,'r');
  await tab(pa,'crew');await pa.locator('[data-crew-tab=ranking]').click();
  await expect(pa.locator('[data-publish], [data-unpublish]')).toHaveCount(0);
  await tab(pb,'crew');await pb.locator('[data-crew-tab=ranking]').click();
  await expect(pb.locator(`[data-key="rank-${a.id}"]`)).toContainText('0 min');
  await pa.locator('.page.active [data-open-settings]').click();
  await expect(pa.locator('[data-share-scores]')).toBeChecked();
  await pa.locator('[data-stop-sharing]').click();
  await expect(pa.locator('[data-share-scores]')).not.toBeChecked();
  await expect.poll(async()=> (await a.client.from('profiles').select('share_scores').eq('id',a.id).single()).data?.share_scores).toBe(false);
  await pb.locator('[data-crew-tab=friends]').click();await pb.locator('[data-crew-tab=ranking]').click();
  await expect(pb.locator(`[data-key="rank-${a.id}"]`)).toContainText('Not shared');
  await expect(pb.locator(`[data-key="rank-${b.id}"]`)).toContainText('0 min');
  await pa.locator('[data-share-scores]').check();await expect(pa.locator('[data-stop-sharing]')).toBeVisible();
  expect(errors.flat()).toEqual([]);
});

test('a shared routine can be copied by a friend', async ({ browser }) => {
  const { pa, pb, errors } = await friendsPair(browser, 's');
  await createWorkout(pa, 'Arms day', ['Hammer Curl']);
  await pa.locator('[data-edit="Arms day"]').click();
  await pa.locator('[data-share]').click();
  await fillPrompt(pa, 'Arms by A');
  await expect(pa.locator('#toast')).toContainText('Shared');
  await tab(pb, 'crew');
  await tab(pb, 'plan');
  await pb.locator('[data-copy-shared]').click();
  await fillPrompt(pb, 'Arms copy');
  await tab(pb, 'plan');
  await expect(pb.locator('[data-edit="Arms copy"]')).toContainText('Arms copy');
  expect(errors.flat()).toEqual([]);
});

test('a background refresh keeps keyboard focus and half-typed text', async ({ browser }) => {
  const { b, pa, errors } = await friendsPair(browser, 'f');
  await tab(pa, 'crew');
  await pa.locator('[data-crew-tab="friends"]').click();
  const input = pa.locator('#friendName');
  await input.click();
  await input.pressSequentially('half_typ');
  // Friend B posts a gym date: A gets a live update and refreshes in the background.
  await b.client.from('gym_dates').insert({ host_id: b.id, starts_at: new Date(Date.now() + 3600000).toISOString(), gym: 'Background Gym' });
  await pa.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => pa.evaluate(() => document.querySelectorAll('.nav-btn .badge:not([hidden])').length), { timeout: 15000 }).toBe(1);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('half_typ');
  await input.pressSequentially('ed');
  await expect(input).toHaveValue('half_typed');
  expect(errors.flat()).toEqual([]);
});
