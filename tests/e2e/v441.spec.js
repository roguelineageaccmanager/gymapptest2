import {test,expect,open,tab,createWorkout,scheduleToday,startTodayWorkout} from './helpers.js';
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
