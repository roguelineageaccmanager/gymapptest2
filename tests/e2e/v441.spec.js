import {test,expect,open,tab,sheetAction,createWorkout,scheduleToday,startTodayWorkout} from './helpers.js';
const uid='00000000-0000-4000-8000-000000000001';
test('swipe left replies while vertical scrolling, short swipes and cancelled gestures do not',async({page})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
 await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 const message={id:'00000000-0000-4000-8000-000000000099',user_id:uid,username:'avery',body:'Reply to this workout message',created_at:'2026-10-28T08:00:00Z'};
 await page.route('**/rest/v1/rpc/community_chat_v4',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([message])}));
 await open(page);await page.evaluate(async id=>{const {account}=await import('/js/cloud/sync.js');account.user={id};account.ready=true;account.profile={username:'avery'};(await import('/js/cloud/client.js')).supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'test'}}});},uid);await tab(page,'crew');
 const row=page.locator('.chat-message');await expect(row).toContainText(message.body);
 const down=()=>row.dispatchEvent('pointerdown',{button:0,pointerType:'touch',pointerId:4,clientX:200,clientY:100});
 const move=(x,y)=>row.dispatchEvent('pointermove',{pointerType:'touch',pointerId:4,clientX:x,clientY:y});
 const up=()=>row.dispatchEvent('pointerup',{pointerType:'touch',pointerId:4,clientX:100,clientY:100});
 await down();await move(110,100);await expect(row).toHaveClass(/swiping/);await up();await expect(page.locator('.chat-reply-preview')).toContainText(message.body);await expect(page.locator('#chatInput')).toBeFocused();await expect(row).not.toHaveClass(/swiping|holding/);
 await page.locator('[data-cancel-reply]').click();
 await down();await move(190,150);await up();await expect(page.locator('.chat-reply-preview')).toHaveCount(0);
 await down();await move(180,100);await up();await expect(page.locator('.chat-reply-preview')).toHaveCount(0);
 await down();await move(110,100);await row.dispatchEvent('pointercancel',{pointerId:4,pointerType:'touch'});await up();await expect(page.locator('.chat-reply-preview')).toHaveCount(0);
 await expect(row).not.toHaveClass(/swiping|holding/);
});
test('warm-ups sit above working controls and full-width workout actions never overlap',async({page})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={};'}));
 await open(page);await createWorkout(page,'Push',['Barbell Bench Press']);await page.locator('[data-edit=Push]').click();await page.getByRole('checkbox',{name:'Warm-up sets for Barbell Bench Press',exact:true}).check();
 const warm=await page.locator('.warmup-count').boundingBox(),work=await page.locator('.ex-edit-fields').boundingBox();expect(warm.y+warm.height).toBeLessThanOrEqual(work.y);
 await page.locator('[data-close-editor]').click();await scheduleToday(page,'Push');await tab(page,'today');await startTodayWorkout(page);
 for(const width of [320,412]){await page.setViewportSize({width,height:839});const a=await page.locator('#sessionMain').boundingBox(),b=await page.locator('#sessionCancel').boundingBox();expect(Math.abs(a.width-b.width)).toBeLessThan(1);expect(Math.abs(a.x-b.x)).toBeLessThan(1);expect(b.y-a.y-a.height).toBeGreaterThanOrEqual(7);expect(b.x+b.width).toBeLessThanOrEqual(width);}
 await page.screenshot({path:test.info().outputPath('workout-actions.png'),animations:'disabled'});
});


test('chat hold menu reacts and edits owned messages without repeating their text',async({page})=>{
 const uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 const messages=[{id:'00000000-0000-4000-8000-000000000051',user_id:uid,username:'avery',body:'Original',created_at:'2026-10-28T12:00:00Z'},{id:'00000000-0000-4000-8000-000000000052',user_id:other,username:'blake',body:'Another message',created_at:'2026-10-28T12:01:00Z'}];let reactions=[];
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
 await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 await page.route('**/rpc/community_chat_v4',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([...messages].reverse())}));
 await page.route('**/rpc/community_reactions_for',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(reactions)}));
 await page.route('**/rpc/set_community_reaction',r=>{const p=r.request().postDataJSON();reactions=p.enabled?[{message_id:p.message_id,emoji:p.reaction,count:1,mine:true}]:[];return r.fulfill({contentType:'application/json',body:'true'});});
 await page.route('**/rpc/edit_community_message',r=>{const p=r.request().postDataJSON();messages.find(m=>m.id===p.message_id).body=p.message_body;return r.fulfill({contentType:'application/json',body:'true'});});
 await open(page);await page.evaluate(async id=>{const {account}=await import('/js/cloud/sync.js');account.user={id};account.ready=true;account.profile={username:'avery'};(await import('/js/cloud/client.js')).supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'test'}}});},uid);await tab(page,'crew');
 const mine=page.locator(`[data-message="${messages[0].id}"]`),theirs=page.locator(`[data-message="${messages[1].id}"]`);
 await expect(mine).toContainText('Original');await mine.press('Enter');await expect(page.locator('.chat-action-preview')).toHaveCount(0);await expect(page.locator('.chat-actions-sheet')).not.toContainText('Original');
 await page.locator('[data-menu-react="🔥"]').click();await expect(mine.locator('.chat-reaction')).toContainText('🔥');await mine.locator('.chat-reaction').click();await expect(mine.locator('.chat-reaction')).toHaveCount(0);
 await mine.press('Enter');await sheetAction(page,'Edit message');await page.locator('.sheet-backdrop.open textarea[name=message]').fill('Edited message');await sheetAction(page,'Save');await expect(mine.locator('p')).toHaveText('Edited message');
 await theirs.press('Enter');await expect(page.locator('.chat-actions-sheet').getByRole('button',{name:'Edit message',exact:true})).toHaveCount(0);await expect(page.locator('.chat-actions-sheet').getByRole('button',{name:'Delete message',exact:true})).toHaveCount(0);await sheetAction(page,'Reply');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
