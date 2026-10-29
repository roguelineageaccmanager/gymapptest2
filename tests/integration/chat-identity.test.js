import {it,expect} from 'vitest';
import {makeUser,uniqueName,adminClient,anonClient} from './helpers.js';
it('keeps handles unique while allowing shared display names, safe replies and owner-only editing',async()=>{
 const a=await makeUser(uniqueName('namea')),b=await makeUser(uniqueName('nameb'));
 try {
  expect((await anonClient().rpc('change_display_name',{name:'No',expected_user:a.id})).error).not.toBeNull();
  expect((await a.client.rpc('change_display_name',{name:'Wrong',expected_user:b.id})).error?.code).toBe('42501');
  for(const value of ['x'.repeat(41),'Bad\nName','Bad\u202eName'])expect((await a.client.rpc('change_display_name',{name:value,expected_user:a.id})).error).not.toBeNull();
  for(const u of [a,b])expect((await u.client.rpc('change_display_name',{name:'Leonard Gym',expected_user:u.id})).error).toBeNull();
  const original=crypto.randomUUID(),reply=crypto.randomUUID();
  expect((await a.client.rpc('send_chat_reply',{message_id:original,message_body:'Original',reply_id:null})).error).toBeNull();
  expect((await b.client.rpc('send_chat_reply',{message_id:reply,message_body:'Reply',reply_id:original})).error).toBeNull();
  const result=await b.client.rpc('community_chat_v4');expect(result.error).toBeNull();
  expect(result.data.find(m=>m.id===reply)).toMatchObject({display_name:'Leonard Gym',reply_display_name:'Leonard Gym',username:b.username,reply_username:a.username});
  expect((await a.client.rpc('change_display_name',{name:'',expected_user:a.id})).error).toBeNull();
  expect((await a.client.from('profiles').select('username,display_name').eq('id',a.id).single()).data).toEqual({username:a.username,display_name:null});
 }finally{await adminClient().auth.admin.deleteUser(a.id);await adminClient().auth.admin.deleteUser(b.id);}
});
