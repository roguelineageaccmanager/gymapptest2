import {test,expect,open,tab,sheetAction,createWorkout,scheduleToday,startTodayWorkout} from './helpers.js';
const uid='00000000-0000-4000-8000-000000000001';
test('swipe left replies while vertical scrolling, short swipes and cancelled gestures do not',async({page})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
 await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 const message={id:'00000000-0000-4000-8000-000000000099',user_id:uid,username:'avery',body:'Reply to this workout message',created_at:'2026-10-28T08:00:00Z'};
 await page.route('**/rest/v1/rpc/community_chat_v4',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([message])}));
 await open(page);await page.evaluate(async id=>{const {account}=await import('/js/cloud/sync.js');account.user={id};account.ready=true;account.profile={username:'avery'};(await import('/js/cloud/client.js')).supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'test'}}});},uid);await tab(page,'crew');await page.locator('#crew-tab-dates').click();
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
 await open(page);await page.evaluate(async id=>{const {account}=await import('/js/cloud/sync.js');account.user={id};account.ready=true;account.profile={username:'avery'};(await import('/js/cloud/client.js')).supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'test'}}});},uid);await tab(page,'crew');await page.locator('#crew-tab-dates').click();
 const mine=page.locator(`[data-message="${messages[0].id}"]`),theirs=page.locator(`[data-message="${messages[1].id}"]`);
 await expect(mine).toContainText('Original');await mine.press('Enter');await expect(page.locator('.chat-action-preview')).toHaveCount(0);await expect(page.locator('.chat-actions-sheet')).not.toContainText('Original');
 await page.locator('[data-menu-react="🔥"]').click();await expect(mine.locator('.chat-reaction')).toContainText('🔥');await mine.locator('.chat-reaction').click();await expect(mine.locator('.chat-reaction')).toHaveCount(0);
 await mine.press('Enter');await sheetAction(page,'Edit message');await page.locator('.sheet-backdrop.open textarea[name=message]').fill('Edited message');await sheetAction(page,'Save');await expect(mine.locator('p')).toHaveText('Edited message');
 await theirs.press('Enter');await expect(page.locator('.chat-actions-sheet').getByRole('button',{name:'Edit message',exact:true})).toHaveCount(0);await expect(page.locator('.chat-actions-sheet').getByRole('button',{name:'Delete message',exact:true})).toHaveCount(0);await sheetAction(page,'Reply');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('real touch swipes reply without moving the chat page or switching tabs',async({page})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
 await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
 const rows=Array.from({length:20},(_,i)=>({id:`00000000-0000-4000-8000-${String(200+i).padStart(12,'0')}`,user_id:uid,username:'avery',body:'A long workout message for scrolling. '.repeat(8)+i,created_at:new Date(Date.UTC(2026,9,28,8,i)).toISOString()}));
 await page.route('**/rpc/community_chat_v4',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([...rows].reverse())}));
 await open(page);await page.evaluate(async id=>{const {account}=await import('/js/cloud/sync.js');account.user={id};account.ready=true;account.profile={username:'avery'};(await import('/js/cloud/client.js')).supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'test'}}});},uid);await tab(page,'crew');await page.locator('#crew-tab-dates').click();
 await expect(page.locator('.chat-message')).toHaveCount(20);
 const target=page.locator('.chat-message p').last(),box=await target.boundingBox(),x=box.x+Math.min(200,box.width-12),y=box.y+Math.min(20,box.height/2);
 const layout=()=>page.locator('#page-crew').evaluate(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,transform:getComputedStyle(el).transform}));
 const before=await layout(),cdp=await page.context().newCDPSession(page);
 const touch=async(type,px,py)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:px,y:py,id:1}]});
 await touch('touchStart',x,y);await touch('touchMove',x-32,y);await expect(page.locator('#page-crew')).toHaveCSS('transform','none');
 expect(await layout()).toEqual(before);
 await touch('touchMove',x-115,y);await touch('touchEnd');
 await expect(page.locator('.chat-reply-preview')).toBeVisible();await expect(page.locator('#chatInput')).toBeFocused();await expect(page.locator('#page-crew')).toHaveClass(/active/);
 expect(await layout()).toEqual(before);await page.locator('[data-cancel-reply]').click();await page.locator('#chatInput').blur();
 const list=page.locator('#chatMessages'),lb=await list.boundingBox(),cx=lb.x+lb.width/2,cy=lb.y+lb.height/2,scroll=await list.evaluate(el=>el.scrollTop);
 await touch('touchStart',cx,cy);await touch('touchMove',cx,cy+70);await touch('touchMove',cx,cy+120);await touch('touchEnd');
 await expect.poll(()=>list.evaluate(el=>el.scrollTop)).toBeLessThan(scroll);await expect(page.locator('.chat-reply-preview')).toHaveCount(0);expect(await layout()).toEqual(before);
 await touch('touchStart',cx,cy);await touch('touchMove',cx+110,cy);await expect(page.locator('#page-crew')).toHaveCSS('transform','none');await touch('touchEnd');await expect(page.locator('#page-crew')).toHaveClass(/active/);
 await tab(page,'today');const heading=await page.locator('#page-today .top').boundingBox(),hx=heading.x+heading.width/2,hy=heading.y+20;
 await touch('touchStart',hx,hy);await touch('touchMove',hx-110,hy);await expect(page.locator('#page-today')).not.toHaveCSS('transform','none');await touch('touchEnd');await expect(page.locator('#page-plan')).toHaveClass(/active/);
 await cdp.detach();
});
