import {test,expect,open,tab,fillPrompt} from './helpers.js';
const uid='00000000-0000-4000-8000-000000000001';
test('Leaderboard is first and display names save safely',async({page})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
 await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 const updates=[];
 await page.route('**/rest/v1/rpc/change_display_name',r=>{const value=r.request().postDataJSON();updates.push(value);return r.fulfill({contentType:'application/json',body:'null'});});
 await open(page);await page.evaluate(async id=>{const {account}=await import('/js/cloud/sync.js');account.user={id,email:'local@example.test'};account.ready=true;account.profile={username:'leonard_2'};(await import('/js/cloud/client.js')).supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'test'}}});},uid);
 await tab(page,'crew');await expect(page.locator('[data-crew-tab]')).toHaveText(['Leaderboard','Friends','Announcements']);await expect(page.locator('#crew-tab-ranking')).toHaveAttribute('aria-selected','true');
 await page.locator('.page.active [data-open-settings]').click();await page.locator('[data-edit-names]').click();await page.locator('[data-change-display-name]').click();await fillPrompt(page,'Leo <b>Gym</b>');
 expect(updates).toEqual([{name:'Leo <b>Gym</b>',expected_user:uid}]);await expect(page.locator('.sheet-backdrop.open')).toHaveCount(0);
});
test('Calendar does not auto-jump on entry and has no Jump to today control',async({page})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={};'}));
 await open(page);await page.evaluate(async()=>{const {state}=await import('/js/state.js');state.logs={'2025-01-01':[{day:'Earlier workout',exercises:[]}]};});
 await tab(page,'calendar');await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);await page.waitForTimeout(350);expect(await page.evaluate(()=>scrollY)).toBe(0);await expect(page.locator('#page-calendar .top')).toBeInViewport();
 await expect(page.locator('[data-jump-today]')).toHaveCount(0);await page.locator('.cal-month').last().scrollIntoViewIfNeeded();await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(100);
 await tab(page,'plan');await tab(page,'calendar');await page.waitForTimeout(350);expect(await page.evaluate(()=>scrollY)).toBe(0);
});
