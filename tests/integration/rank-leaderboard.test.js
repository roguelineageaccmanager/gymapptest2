import {it,expect} from 'vitest';
import {makeUser,uniqueName,befriend,anonClient} from './helpers.js';
it('shares bounded strength ranks only with the owner and accepted friends and preserves legacy uploads',async()=>{
 const a=await makeUser(uniqueName('rank')),b=await makeUser(uniqueName('pal')),c=await makeUser(uniqueName('out'));await befriend(a,b);
 const row={user_id:a.id,workouts_count:1,volume_kg_reps:0,rank_score:850};expect((await a.client.from('leaderboard_stats').insert(row)).error).toBeNull();
 expect((await b.client.rpc('friend_summaries')).data.find(r=>r.user_id===a.id)?.rank_score).toBe(850);
 expect((await c.client.rpc('friend_summaries')).data.some(r=>r.user_id===a.id)).toBe(false);expect((await anonClient().rpc('friend_summaries')).error).not.toBeNull();
 for(const rank_score of [-1,1000])expect((await a.client.from('leaderboard_stats').update({rank_score}).eq('user_id',a.id)).error).not.toBeNull();
 const {rank_score,...legacy}=row;expect(rank_score).toBe(850);expect((await a.client.from('leaderboard_stats').upsert(legacy)).error).toBeNull();expect((await a.client.from('leaderboard_stats').select('rank_score').single()).data.rank_score).toBe(850);
 await b.client.from('leaderboard_stats').update({rank_score:999}).eq('user_id',a.id);expect((await a.client.from('leaderboard_stats').select('rank_score').single()).data.rank_score).toBe(850);
 await a.client.from('profiles').update({share_scores:false}).eq('id',a.id);expect((await b.client.rpc('friend_summaries')).data.find(r=>r.user_id===a.id)?.rank_score).toBeNull();
});
it('keeps detailed ranks behind score consent, accepted friendship and owner-only writes',async()=>{
 const a=await makeUser(uniqueName('details')),b=await makeUser(uniqueName('friend')),c=await makeUser(uniqueName('outsider'));
 const rank_details={version:1,exercises:[]};
 expect((await a.client.from('leaderboard_stats').insert({user_id:a.id,workouts_count:1,volume_kg_reps:0,rank_details})).error).toBeNull();
 expect((await b.client.from('leaderboard_stats').select('rank_details').eq('user_id',a.id)).data).toEqual([]);
 await befriend(a,b);
 expect((await b.client.from('leaderboard_stats').select('rank_details').eq('user_id',a.id)).data).toEqual([{rank_details}]);
 expect((await c.client.from('leaderboard_stats').select('rank_details').eq('user_id',a.id)).data).toEqual([]);
 expect((await anonClient().from('leaderboard_stats').select('rank_details')).error).not.toBeNull();
 expect((await b.client.from('leaderboard_stats').update({rank_details:{version:1,exercises:[{name:'fake'}]}}).eq('user_id',a.id).select()).data).toEqual([]);
 for(const invalid of [{},[],{version:1,exercises:{}},{version:1,exercises:Array(2001).fill({})}])expect((await a.client.from('leaderboard_stats').update({rank_details:invalid}).eq('user_id',a.id)).error).not.toBeNull();
 await a.client.from('profiles').update({share_scores:false}).eq('id',a.id);
 expect((await b.client.from('leaderboard_stats').select('rank_details').eq('user_id',a.id)).data).toEqual([]);
 expect((await a.client.from('leaderboard_stats').insert({user_id:a.id,workouts_count:1,volume_kg_reps:0,rank_details})).error).not.toBeNull();
});
