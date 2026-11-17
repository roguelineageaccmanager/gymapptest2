import{test,expect,open,tab,sheetAction}from'./helpers.js';
const uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
async function setup(page,isAdmin){
 let posts=[],writes=0,fail=false;
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
 await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.route('**/rest/v1/rpc/announcement_admin',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(isAdmin)}));
 await page.route('**/rest/v1/announcements*',r=>{
  expect(r.request().headers().authorization).toBe('Bearer announcement-test');
  const method=r.request().method();
  if(method!=='GET'){writes++;if(fail)return r.fulfill({status:400,contentType:'application/json',body:'{}'});}
  if(method==='POST'){const p=r.request().postDataJSON();expect(p.author_id).toBe(uid);if(!posts.some(x=>x.id===p.id))posts.unshift({...p,created_at:'2026-11-17T12:00:00Z',updated_at:'2026-11-17T12:00:00Z'});return r.fulfill({status:201,body:''});}
  const id=new URL(r.request().url()).searchParams.get('id')?.slice(3);
  if(method==='PATCH'){const post=posts.find(p=>p.id===id);Object.assign(post,r.request().postDataJSON());return r.fulfill({contentType:'application/json',body:JSON.stringify([post])});}
  if(method==='DELETE'){posts=posts.filter(p=>p.id!==id);return r.fulfill({status:204});}
  return r.fulfill({contentType:'application/json',body:JSON.stringify(posts)});
 });
 await page.addInitScript(()=>localStorage.setItem('gymSettings',JSON.stringify({selectedColor:'#445566',buttonTextColor:'#ff88cc'})));
 await open(page);await page.evaluate(async id=>{
  const{account}=await import('/js/cloud/sync.js'),{supabase}=await import('/js/cloud/client.js');
  account.user={id,user_metadata:{role:'admin'}};account.profile={username:'rat'};account.ready=true;
  supabase.auth.getSession=async()=>({data:{session:{user:{id:account.user.id},access_token:'announcement-test'}}});
 },uid);
 await tab(page,'crew');await expect(page.locator('[data-crew-tab]')).toHaveText(['Leaderboard','Friends','Announcements']);await page.locator('[data-crew-tab=announcements]').click();
 await expect(page.locator('.announcements-panel')).toContainText('No announcements yet.');
 return {writes:()=>writes,setFail:value=>{fail=value;},posts:()=>posts};
}
test('admin publishes escaped text, keeps failed drafts, edits and confirms deletion',async({page})=>{
 const f=await setup(page,true);await expect(page.locator('[data-new-announcement]')).toHaveCount(1);await page.locator('[data-new-announcement]').click();
 await sheetAction(page,'Publish');await expect(page.locator('.announcement-editor .form-status')).toContainText('Add a title and message');expect(f.writes()).toBe(0);
 await page.locator('.announcement-editor [name=title]').fill('Update <img src=x>');await page.locator('.announcement-editor [name=body]').fill('Hello\n<script>bad()</script>');
 f.setFail(true);await sheetAction(page,'Publish');await expect(page.locator('.announcement-editor .form-status')).toContainText('Could not update');await expect(page.locator('.announcement-editor [name=body]')).toHaveValue('Hello\n<script>bad()</script>');
 f.setFail(false);await sheetAction(page,'Publish');await expect(page.locator('.announcement-editor')).toHaveCount(0);await expect(page.locator('.announcement-post h2')).toHaveText('Update <img src=x>');await expect(page.locator('.announcement-post img,.announcement-post script')).toHaveCount(0);
 await page.locator('[data-edit-announcement]').click();await page.locator('.announcement-editor [name=title]').fill('Updated title');await sheetAction(page,'Save');await expect(page.locator('.announcement-post h2')).toHaveText('Updated title');
 await page.locator('[data-delete-announcement]').click();await sheetAction(page,'Cancel');await expect(page.locator('.announcement-post')).toHaveCount(1);
 await page.locator('[data-delete-announcement]').click();await sheetAction(page,'Remove');await expect(page.locator('.announcement-post')).toHaveCount(0);
});
test('regular members cannot compose despite forged metadata; rounded highlight fits the narrow screen',async({page})=>{
 await page.setViewportSize({width:320,height:800});const f=await setup(page,false);
 await expect(page.locator('[data-new-announcement]')).toHaveCount(0);await expect(page.getByRole('tab',{name:'Chat',exact:true})).toHaveCount(0);await expect(page.locator('#chatInput')).toHaveCount(0);
 await expect(page.locator('[data-crew-tab=announcements]')).toHaveCSS('border-radius','14px');await expect(page.locator('[data-crew-tab=announcements]')).toHaveCSS('background-color','rgb(68, 85, 102)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const error=await page.evaluate(async()=>{try{await(await import('/js/cloud/announcements.js')).saveAnnouncement({title:'No',body:'No'},null,'00000000-0000-4000-8000-000000000001');}catch(e){return e.message;}});
 expect(error).toContain('permission');expect(f.writes()).toBe(0);
 await page.locator('.page.active [data-open-settings]').click();await expect(page.locator('[data-chat-notifications],[data-web-notifications]')).toHaveCount(0);
});
test('switching accounts closes an unpublished announcement without posting',async({page})=>{
 const f=await setup(page,true);await page.locator('[data-new-announcement]').click();await page.locator('.announcement-editor [name=title]').fill('Private draft');
 await page.evaluate(async id=>{const{account}=await import('/js/cloud/sync.js');account.user={id};window.dispatchEvent(new CustomEvent('gym:account'));},other);
 await expect(page.locator('.announcement-editor')).toHaveCount(0);expect(f.writes()).toBe(0);
});
