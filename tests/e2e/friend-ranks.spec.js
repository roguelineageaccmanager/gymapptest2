import{test,expect,open}from'./helpers.js';
import{strengthStats}from'../../js/domain/ranks.js';
import{sharedRankSnapshot}from'../../js/domain/shared-ranks.js';
const viewer='00000000-0000-4000-8000-000000000001',friend='00000000-0000-4000-8000-000000000002';
const snapshot=sharedRankSnapshot(strengthStats({'2026-01-02':[{exercises:[{name:'Single-Arm Plate-Loaded Row',unilateral:true,target:'8',sets:[{w:'30',r:'8',done:true},{w:'25',r:'8',done:true}]},{name:'Abdominal Crunch Machine',target:'8',sets:[{w:'40',r:'8',done:true}]}]}]},[{date:'2026-01-01',weight:80}]));
test('friend profile shows both body views, regional ranks and the weaker-side calculation, then clears on account switch',async({page})=>{
 let sharing=true;
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
 await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.route('**/rest/v1/rpc/friend_summaries',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{user_id:friend,username:'testfriend',workouts_count:sharing?2:null,rank_score:sharing?snapshot.overall:null}])}));
 await page.route('**/rest/v1/leaderboard_stats*',r=>{
  expect(r.request().headers().authorization).toBe('Bearer local-friend-token');expect(new URL(r.request().url()).searchParams.get('user_id')).toBe('eq.'+friend);
  return r.fulfill({contentType:'application/json',body:JSON.stringify([{rank_details:snapshot,updated_at:'2026-11-17T07:00:00Z'}])});
 });
 await open(page);await page.evaluate(async({viewer,friend})=>{
  const{account}=await import('/js/cloud/sync.js'),{supabase}=await import('/js/cloud/client.js');
  account.user={id:viewer};account.ready=true;account.profile={username:'viewer'};
  supabase.auth.getSession=async()=>({data:{session:{user:{id:viewer},access_token:'local-friend-token'}}});
  void(await import('/js/ui/profile.js')).openMemberProfile(friend);
 },{viewer,friend});
 const sheet=page.locator('.member-profile-sheet');await expect(sheet.locator('.profile-identity')).toContainText('@testfriend');
 await expect(sheet.locator('.rank-body')).toHaveCount(2);await expect(sheet.locator('[data-rank-muscle=traps]')).toContainText('LP');await expect(sheet.locator('[data-rank-muscle=obliques]')).toContainText('LP');
 await sheet.locator('[data-muscle=traps]').first().focus();await page.keyboard.press('Enter');await expect(sheet.locator('[data-rank-muscle=traps]')).toHaveAttribute('open','');
 await sheet.locator('[data-strength-lift="Single-Arm Plate-Loaded Row"]').last().click();
 const calculation=page.locator('.shared-rank-calculation');await expect(calculation).toContainText('25 kg per side × 8 · weaker side');await expect(calculation).toContainText('25 × 2 = 50 kg normalized load');await expect(calculation).not.toContainText('80 kg');
 sharing=false;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gym:crew-updated')));
 await expect(calculation).toHaveCount(0);await expect(sheet.locator('.rank-body')).toHaveCount(0);
 await page.evaluate(async()=>{(await import('/js/cloud/sync.js')).account.user=null;window.dispatchEvent(new CustomEvent('gym:account'));});
 await expect(calculation).toHaveCount(0);await expect(sheet).toHaveCount(0);
});
