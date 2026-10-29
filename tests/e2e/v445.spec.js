import {test,expect,open,tab,sheetAction,fillPrompt} from './helpers.js';
const uid='00000000-0000-4000-8000-000000000001';
test('Leaderboard is first, display names save safely, and Chat uses them in authors and replies',async({page})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
 await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 let displayName=null;const updates=[];
 await page.route('**/rest/v1/rpc/change_display_name',r=>{const value=r.request().postDataJSON();updates.push(value);displayName=value.name||null;return r.fulfill({contentType:'application/json',body:'null'});});
 await page.route('**/rest/v1/rpc/community_chat_v4',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{id:'00000000-0000-4000-8000-000000000099',user_id:uid,username:'leonard_2',display_name:displayName,body:'Ready for the gym?',created_at:new Date().toISOString()}])}));
 await open(page);await page.evaluate(async id=>{const {account}=await import('/js/cloud/sync.js');account.user={id,email:'local@example.test'};account.ready=true;account.profile={username:'leonard_2'};(await import('/js/cloud/client.js')).supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'test'}}});},uid);
 await tab(page,'crew');await expect(page.locator('[data-crew-tab]')).toHaveText(['Leaderboard','Friends','Chat']);await expect(page.locator('#crew-tab-ranking')).toHaveAttribute('aria-selected','true');
 await page.locator('.page.active [data-open-settings]').click();await page.locator('[data-edit-names]').click();await page.locator('[data-change-display-name]').click();await fillPrompt(page,'Leo <b>Gym</b>');
 expect(updates).toEqual([{name:'Leo <b>Gym</b>',expected_user:uid}]);await expect(page.locator('.sheet-backdrop.open')).toHaveCount(0);
 await page.locator('[data-close-settings]').click();await page.locator('#crew-tab-dates').click();await expect(page.locator('.chat-author')).toHaveText('Leo <b>Gym</b>');await expect(page.locator('.chat-author b')).toHaveCount(0);
 await page.locator('.chat-message').press('Enter');await sheetAction(page,'Reply');await expect(page.locator('.chat-reply-preview b')).toHaveText('Reply to Leo <b>Gym</b>');
 await page.locator('[data-cancel-reply]').click();await page.locator('.page.active [data-open-settings]').click();await page.locator('[data-edit-names]').click();await page.locator('[data-change-display-name]').click();await fillPrompt(page,'');expect(updates.at(-1)).toEqual({name:'',expected_user:uid});
});
test('Calendar does not auto-jump on entry and Jump to today remains explicit',async({page})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={};'}));
 await open(page);await page.evaluate(async()=>{const {state}=await import('/js/state.js');state.logs={'2025-01-01':[{day:'Earlier workout',exercises:[]}]};});
 await tab(page,'calendar');await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);await page.waitForTimeout(350);expect(await page.evaluate(()=>scrollY)).toBe(0);await expect(page.locator('#page-calendar .top')).toBeInViewport();
 await page.locator('[data-jump-today]').click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(100);
 await tab(page,'plan');await tab(page,'calendar');await page.waitForTimeout(350);expect(await page.evaluate(()=>scrollY)).toBe(0);
});
