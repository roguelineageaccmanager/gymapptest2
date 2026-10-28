import { it, expect } from 'vitest';
import { makeUser, uniqueName, befriend, anonClient } from './helpers.js';
const picture=async a=>{const r=await a.client.from('progress_photos').insert({user_id:a.id,image_data:'data:image/jpeg;base64,AAAA',photo_date:'2026-10-28'}).select('id').single();expect(r.error).toBeNull();return r.data.id;};
const read=(a,id,before)=>a.client.rpc('progress_photo_comments',{target_photo:id,before_at:before?.created_at||null,before_id:before?.id||null});
it('photo viewers can comment; outsiders/spoofed authors cannot; only authors delete and nobody edits',async()=>{
 const a=await makeUser(uniqueName('owner')),b=await makeUser(uniqueName('pal')),c=await makeUser(uniqueName('out'));
 const friendship=await befriend(a,b),id=await picture(a);
 const posted=await b.client.from('progress_comments').insert({photo_id:id,user_id:b.id,body:'  Great session <img src=x>  ',created_at:'2099-01-01T00:00:00Z'}).select('id').single();expect(posted.error).toBeNull();
 const rows=await read(a,id);expect(rows.error).toBeNull();expect(rows.data).toHaveLength(1);expect(rows.data[0]).toMatchObject({user_id:b.id,username:b.username,body:'Great session <img src=x>'});expect(new Date(rows.data[0].created_at).getTime()).toBeLessThan(Date.now()+10000);
 expect((await read(c,id)).data).toEqual([]);expect((await c.client.from('progress_comments').select('*')).data).toEqual([]);
 expect((await c.client.from('progress_comments').insert({photo_id:id,user_id:c.id,body:'No'})).error).not.toBeNull();
 expect((await a.client.from('progress_comments').insert({photo_id:id,user_id:b.id,body:'Spoof'})).error).not.toBeNull();
 expect((await b.client.from('progress_comments').update({body:'Edit'}).eq('id',posted.data.id)).error).not.toBeNull();
 await a.client.from('progress_comments').delete().eq('id',posted.data.id);expect((await read(a,id)).data).toHaveLength(1);
 expect((await anonClient().rpc('progress_photo_comments',{target_photo:id})).error).not.toBeNull();
 await b.client.from('progress_comments').delete().eq('id',posted.data.id);expect((await read(a,id)).data).toEqual([]);
 expect((await b.client.from('progress_comments').insert({photo_id:id,user_id:b.id,body:'Before removing friendship'})).error).toBeNull();
 await a.client.from('friend_requests').delete().eq('id',friendship);expect((await read(b,id)).data).toEqual([]);
 expect((await b.client.from('progress_comments').select('*').eq('photo_id',id)).data).toEqual([]);
 expect((await b.client.from('progress_comments').insert({photo_id:id,user_id:b.id,body:'After removing friendship'})).error).not.toBeNull();
});
it('validates comment length and uses a server-side rate limit that survives deleting a comment',async()=>{
 const a=await makeUser(uniqueName('limit')),id=await picture(a);
 for(const body of ['  ','x'.repeat(1001)])expect((await a.client.from('progress_comments').insert({photo_id:id,user_id:a.id,body})).error).not.toBeNull();
 let first;
 for(let i=0;i<20;i++){const r=await a.client.from('progress_comments').insert({photo_id:id,user_id:a.id,body:'Comment '+i}).select('id').single();expect(r.error).toBeNull();if(!i)first=r.data.id;}
 await a.client.from('progress_comments').delete().eq('id',first);
 expect((await a.client.from('progress_comments').insert({photo_id:id,user_id:a.id,body:'Too many'})).error?.code).toBe('54000');
});
it('paginates comments without duplication and cascades photo deletion',async()=>{
 const a=await makeUser(uniqueName('page')),b=await makeUser(uniqueName('pal'));await befriend(a,b);const id=await picture(a);
 for(let i=0;i<31;i++){const who=i%2?a:b;expect((await who.client.from('progress_comments').insert({photo_id:id,user_id:who.id,body:'Page '+i})).error).toBeNull();}
 const first=(await read(a,id)).data;expect(first).toHaveLength(30);const second=(await read(a,id,first.at(-1))).data;expect(second).toHaveLength(1);expect(new Set([...first,...second].map(row=>row.id)).size).toBe(31);
 await a.client.from('progress_photos').delete().eq('id',id);expect((await a.client.from('progress_comments').select('*').eq('photo_id',id)).data).toEqual([]);
});
it('validates the full standard emoji catalog on the server without opening private data',async()=>{
 const a=await makeUser(uniqueName('emoji')),id=await picture(a);
 for(const emoji of ['🥰','👍🏽','👨‍👩‍👧‍👦','🇷🇴','1️⃣','🏳️‍🌈','❤️'])expect((await a.client.from('progress_photo_reactions').insert({photo_id:id,user_id:a.id,emoji})).error).toBeNull();
 for(const emoji of ['🔥🔥','hello','<script>'])expect((await a.client.from('progress_photo_reactions').insert({photo_id:id,user_id:a.id,emoji})).error).not.toBeNull();
 expect((await a.client.schema('private').from('progress_emoji').select('*')).error).not.toBeNull();
});
