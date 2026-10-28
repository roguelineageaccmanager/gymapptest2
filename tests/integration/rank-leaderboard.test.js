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
