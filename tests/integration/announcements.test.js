import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {makeUser,uniqueName,adminClient,anonClient} from './helpers.js';

it('only server-appointed admins publish; members read and author ownership survives edits',async()=>{
 const a=await makeUser(uniqueName('news')),b=await makeUser(uniqueName('reader'),{role:'admin'});
 const grant=enabled=>execFileSync('docker',['exec','-i','supabase_db_gymapptest2','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q'],{input:enabled?`insert into private.announcement_admins(user_id) values ('${a.id}'::uuid);`:`delete from private.announcement_admins where user_id='${a.id}'::uuid;`,stdio:'pipe'});
 try{
  expect((await b.client.rpc('announcement_admin')).data).toBe(false);
  expect((await anonClient().rpc('announcement_admin')).error).not.toBeNull();
  expect((await anonClient().from('announcements').select('*')).error).not.toBeNull();
  expect((await b.client.from('announcements').insert({title:'Forged',body:'No'})).error).not.toBeNull();
  grant(true);expect((await a.client.rpc('announcement_admin')).data).toBe(true);
  expect((await a.client.from('announcements').insert({author_id:b.id,title:'Spoof',body:'No'})).error).not.toBeNull();
  expect((await a.client.from('announcements').insert({title:' ',body:'No'})).error).not.toBeNull();
  expect((await a.client.from('announcements').insert({title:'Long',body:'x'.repeat(4001)})).error).not.toBeNull();
  const inserted=await a.client.from('announcements').insert({title:'Update',body:'Plain text'}).select().single();
  expect(inserted.error).toBeNull();const post=inserted.data;
  expect((await b.client.from('announcements').select('title').eq('id',post.id)).data).toEqual([{title:'Update'}]);
  expect((await b.client.from('announcements').update({title:'Hijack'}).eq('id',post.id).select()).data).toEqual([]);
  expect((await b.client.from('announcements').delete().eq('id',post.id).select()).data).toEqual([]);
  const changed=await a.client.from('announcements').update({title:'Edited',author_id:b.id,created_at:'2000-01-01T00:00:00Z',updated_at:'2000-01-01T00:00:00Z'}).eq('id',post.id).select().single();
  expect(changed.error).toBeNull();expect(changed.data.author_id).toBe(a.id);expect(changed.data.created_at).toBe(post.created_at);expect(changed.data.updated_at).not.toContain('2000-01-01');
  grant(false);expect((await a.client.rpc('announcement_admin')).data).toBe(false);
  expect((await a.client.from('announcements').delete().eq('id',post.id).select()).data).toEqual([]);
  grant(true);expect((await a.client.from('announcements').delete().eq('id',post.id).select()).data).toHaveLength(1);
 }finally{for(const user of [a,b]){await adminClient().from('announcements').delete().eq('author_id',user.id);await adminClient().auth.admin.deleteUser(user.id);}}
});
