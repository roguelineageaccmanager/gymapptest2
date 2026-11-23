import{test,expect,open,sheetAction,tab}from'./helpers.js';
import{strengthStats}from'../../js/domain/ranks.js';
import{sharedRankSnapshot}from'../../js/domain/shared-ranks.js';
const viewer='00000000-0000-4000-8000-000000000001',friend='00000000-0000-4000-8000-000000000002';
const snapshot=sharedRankSnapshot(strengthStats({'2026-01-02':[{exercises:[{name:'Single-Arm Plate-Loaded Row',unilateral:true,target:'8',sets:[{w:'30',r:'8',done:true},{w:'25',r:'8',done:true}]},{name:'Abdominal Crunch Machine',target:'8',sets:[{w:'40',r:'8',done:true}]},...['handle','cuff'].map((attachment,i)=>({name:'Cable Lateral Raise',attachment,target:'8',sets:[{w:i?'10':'30',r:'8',done:true}]}))]}]},[{date:'2026-01-01',weight:80}]));
test('friend profile shows both body views, regional ranks and the weaker-side calculation, then clears on account switch',async({page})=>{
 let sharing=true, unavailable=true;
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
 await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.route('**/rest/v1/friend_requests*',r=>r.fulfill({json:[{id:'request',requester_id:viewer,target_id:friend,status:'accepted',requester:{username:'viewer'},target:{username:'testfriend'}}]}));
 await page.route('**/rest/v1/rpc/friend_summaries',r=>r.fulfill({json:[{user_id:friend,username:'testfriend',workouts_count:null,rank_score:sharing?snapshot.overall:null}]}));
 await page.route('**/rest/v1/leaderboard_stats*',r=>{
  expect(r.request().headers().authorization).toBe('Bearer local-friend-token');expect(new URL(r.request().url()).searchParams.get('user_id')).toBe('eq.'+friend);
  if(unavailable)return r.fulfill({status:403,json:{message:'Shared ranks unavailable'}});
  return r.fulfill({json:sharing?[{rank_details:snapshot,updated_at:'2026-11-17T07:00:00Z'}]:[]});
 });
 await open(page);await page.evaluate(async(viewer)=>{
  const{account}=await import('/js/cloud/sync.js'),{supabase}=await import('/js/cloud/client.js');
  account.user={id:viewer};account.ready=true;account.profile={username:'viewer'};
  supabase.auth.getSession=async()=>({data:{session:{user:{id:viewer},access_token:'local-friend-token'}}});
  supabase.channel=()=>({on(){return this;},subscribe(){return this;},unsubscribe(){}});
 },viewer);
 await tab(page,'crew');
 await page.locator('.leaderboard-row[data-view-profile="'+friend+'"]').click();
 const sheet=page.locator('.member-profile-sheet');await expect(sheet.locator('.profile-identity')).toContainText('@testfriend');
 await expect(sheet).toContainText('Could not load the body graph.');
 unavailable=false;
 await sheet.getByRole('button',{name:'Try again'}).click();
 await expect(sheet.locator('.rank-body')).toHaveCount(2);await expect(sheet.locator('[data-rank-muscle=traps]')).toContainText('LP');await expect(sheet.locator('[data-rank-muscle=abs]')).toContainText('LP');
 await sheet.locator('[data-muscle=traps]').first().focus();await page.keyboard.press('Enter');await expect(sheet.locator('[data-rank-muscle=traps]')).toHaveAttribute('open','');
 await sheet.locator('[data-rank-muscle=traps] [data-strength-lift]').first().click();
 const calculation=page.locator('.shared-rank-calculation');await expect(calculation).toContainText('25 kg per side × 8');await expect(calculation).toContainText('Workout used for rank');await expect(calculation).toContainText('All-time heaviest');await expect(calculation.locator('.scoring-set')).toContainText('Used for rank');await expect(calculation.locator('[data-chart-point]')).toHaveCount(1);await expect(calculation.getByText('Remove from Stats')).toHaveCount(0);await expect(calculation.locator('.lift-rank-heading')).toBeVisible();await expect(sheet.getByText('Exercise bests',{exact:true})).toHaveCount(0);
 await sheetAction(page,'Done');await expect(calculation).toHaveCount(0);await sheet.locator('[data-rank-muscle=shoulders] summary').click();await sheet.locator('[data-strength-lift="Cable Lateral Raise"][data-strength-setup=cuff]').last().click();await expect(calculation.locator('h2')).toContainText('Wrist cuff');await expect(calculation).toContainText('10 kg total × 8');
 sharing=false;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gym:crew-updated')));
 await expect(calculation).toHaveCount(0);await expect(sheet.locator('.rank-body')).toHaveCount(0);
 await page.evaluate(async()=>{(await import('/js/cloud/sync.js')).account.user=null;window.dispatchEvent(new CustomEvent('gym:account'));});
 await expect(calculation).toHaveCount(0);await expect(sheet).toHaveCount(0);
});
