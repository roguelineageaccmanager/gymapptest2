import { it, expect } from 'vitest';
import { makeUser, uniqueName, adminClient, anonClient } from './helpers.js';
import { planLosses } from '../../js/domain/plan-safety.js';
const plan = {workouts:{Push:[{name:'Bench'},{name:'Fly'}],Pull:[{name:'Row'}]},schedule:{0:'Push',2:'Pull'}};
async function setup() {
  const u=await makeUser(uniqueName('plan'));
  const r=await u.client.from('workout_plans').insert({user_id:u.id,plan}).select('*').single();
  expect(r.error).toBeNull(); return {u,row:r.data};
}
it('rejects legacy empty/truncated saves and preserves the original plan',async()=>{
  const {u,row}=await setup();
  for(const next of [{workouts:{},schedule:{}},{...plan,workouts:{...plan.workouts,Push:[]}},{...plan,schedule:{}}]) {
    const r=await u.client.from('workout_plans').update({plan:next,updated_at:new Date().toISOString()}).eq('user_id',u.id);
    expect(r.error?.code).toBe('23514');
  }
  expect((await u.client.from('workout_plans').select('plan').eq('user_id',u.id).single()).data.plan).toEqual(row.plan);
});
it('accepts precise intentional removals, rejects stale proof and protects immutable revisions',async()=>{
  const {u,row}=await setup(); const stranger=await makeUser(uniqueName('other'));
  const next={workouts:{Push:[{name:'Bench'}]},schedule:{}};
  const approved={...next,_lossApproval:{base_updated_at:row.updated_at,losses:planLosses(plan,next)}};
  const r=await u.client.from('workout_plans').update({plan:approved,plan_revision:999,approved_removals:{forged:true}}).eq('user_id',u.id).select('*').single();
  expect(r.error).toBeNull(); expect(r.data.plan).toEqual(next); expect(r.data.plan_revision).toBe(2);
  expect({...r.data.approved_removals,days:r.data.approved_removals.days.toSorted()}).toEqual(planLosses(plan,next));
  const empty={workouts:{},schedule:{}};
  const stale=await u.client.from('workout_plans').update({plan:{...empty,_lossApproval:{base_updated_at:row.updated_at,losses:planLosses(next,empty)}}}).eq('user_id',u.id);
  expect(stale.error?.code).toBe('23514');
  const history=await u.client.from('plan_revisions').select('*').eq('user_id',u.id);
  expect(history.error).toBeNull(); expect(history.data).toHaveLength(1); expect(history.data[0].plan).toEqual(plan);
  expect((await stranger.client.from('plan_revisions').select('*').eq('user_id',u.id)).data).toEqual([]);
  expect((await anonClient().from('plan_revisions').select('*')).error).not.toBeNull();
  expect((await u.client.from('plan_revisions').update({plan:empty}).eq('user_id',u.id)).error).not.toBeNull();
  expect((await u.client.from('plan_revisions').delete().eq('user_id',u.id)).error).not.toBeNull();
});
it('bounds recovery history and removes it when the account is deleted',async()=>{
  const {u}=await setup();
  for(let i=0;i<23;i++) {
    const r=await u.client.from('workout_plans').update({plan:{...plan,note:String(i)}}).eq('user_id',u.id);
    expect(r.error).toBeNull();
  }
  const history=await u.client.from('plan_revisions').select('id').eq('user_id',u.id);
  expect(history.data).toHaveLength(20);
  expect((await adminClient().auth.admin.deleteUser(u.id)).error).toBeNull();
  expect((await adminClient().from('plan_revisions').select('*').eq('user_id',u.id)).data).toEqual([]);
});
