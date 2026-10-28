import { test, expect, open, tab, sheetAction } from './helpers.js';
const uid='00000000-0000-4000-8000-000000000001',friend='00000000-0000-4000-8000-000000000002',photo='00000000-0000-4000-8000-000000000003';
async function mock(page){
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
 await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
}
async function sign(page){await page.evaluate(async id=>{const {account}=await import('/js/cloud/sync.js'),{supabase}=await import('/js/cloud/client.js');account.user={id};account.ready=true;account.profile={username:'avery'};supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'v440-test'}}});},uid);}
test('long chat stays above the visual keyboard, touch taps stay neutral and holds visibly cancel or open actions',async({page})=>{
 await mock(page);
 const rows=Array.from({length:50},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+10).padStart(12,'0')}`,user_id:uid,username:'avery',body:'Long training message '.repeat(15)+i,created_at:new Date(Date.UTC(2026,9,28,8,i)).toISOString()}));
 await page.route('**/rest/v1/rpc/community_chat_v4',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([...rows].reverse())}));
 await page.addInitScript(()=>{let height=innerHeight,top=0;Object.defineProperties(visualViewport,{height:{get:()=>height},offsetTop:{get:()=>top}});window.setKeyboardView=(h,t=0)=>{height=h;top=t;visualViewport.dispatchEvent(new Event('resize'));};});
 await open(page);await sign(page);await tab(page,'crew');await expect(page.locator('.chat-message')).toHaveCount(50);
 await page.locator('#chatInput').click();await page.evaluate(()=>window.setKeyboardView(380,30));
 await expect(page.locator('body')).toHaveClass(/chat-keyboard-open/);
 const visible=()=>page.evaluate(()=>['#chatInput','#chatForm [type=submit]'].every(s=>{const b=document.querySelector(s).getBoundingClientRect();return b.top>=30&&b.bottom<=410;}));
 await expect.poll(visible).toBe(true);
 expect(await page.locator('#chatMessages').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 await page.locator('#chatInput').fill('First line\nSecond line\nThird line\nFourth line\nFifth line');
 await expect.poll(visible).toBe(true);expect((await page.locator('#chatInput').boundingBox()).height).toBeGreaterThan(40);
 await page.screenshot({path:test.info().outputPath('long-chat-keyboard.png'),animations:'disabled'});
 // Native WebViews can resize the layout before their visual viewport catches up.
 await page.evaluate(()=>window.setKeyboardView(851));await page.setViewportSize({width:393,height:400});
 await expect.poll(()=>page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--view-height')))).toBe(400);
 await expect.poll(()=>page.locator('#chatInput').evaluate(el=>el.getBoundingClientRect().bottom<=400)).toBe(true);
 await page.setViewportSize({width:393,height:851});await page.evaluate(()=>{document.activeElement.blur();window.setKeyboardView(851);});await expect(page.locator('body')).not.toHaveClass(/keyboard-open/);
 const message=page.locator('.chat-message').last();await message.locator('p').tap();await expect(message).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(message).not.toHaveClass(/holding/);
 await message.dispatchEvent('pointerdown',{button:0,pointerType:'touch',clientX:50,clientY:100});await expect(message).toHaveClass(/holding/);await expect(message).toHaveCSS('animation-name','chat-hold-feedback');
 await message.dispatchEvent('pointermove',{pointerType:'touch',clientX:80,clientY:100});await expect(message).not.toHaveClass(/holding/);await page.waitForTimeout(550);await expect(page.locator('.chat-actions-sheet')).toHaveCount(0);
 await message.dispatchEvent('pointerdown',{button:0,pointerType:'touch',clientX:50,clientY:100});await expect(page.locator('.chat-actions-sheet')).toBeVisible();await expect(message).not.toHaveClass(/holding/);await message.dispatchEvent('pointerup');await sheetAction(page,'Reply');await expect(page.locator('.chat-reply-preview')).toContainText('Long training message');
});
test('full emoji search and photo comments preserve failed drafts, paging, keyboard access and account boundaries',async({page})=>{
 await mock(page);let image,fail=false,attempts=[];
 const entries=Array.from({length:31},(_,i)=>({id:`10000000-0000-4000-8000-${String(i+10).padStart(12,'0')}`,user_id:friend,username:'blake',body:'Progress comment '+i,created_at:new Date(Date.UTC(2026,9,28,9,i)).toISOString()}));
 await page.route('**/rest/v1/progress_photos*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{id:photo,user_id:friend,image_data:image,photo_date:'2026-10-28',caption:'Progress',owner:{username:'blake'}}])}));
 let emoji='';await page.route('**/rest/v1/rpc/progress_photo_reactions_for',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(emoji?[{photo_id:photo,emoji,reaction_count:1,mine:true}]:[])}));
 await page.route('**/rest/v1/progress_photo_reactions*',r=>{emoji=r.request().postDataJSON().emoji;return r.fulfill({status:204});});
 await page.route('**/rest/v1/rpc/progress_photo_comments',r=>{expect(r.request().headers().authorization).toBe('Bearer v440-test');const before=r.request().postDataJSON().before_at;return r.fulfill({contentType:'application/json',body:JSON.stringify(entries.filter(row=>!before||row.created_at<before).slice(-30).reverse())});});
 await page.route('**/rest/v1/progress_comments*',r=>{const body=r.request().postDataJSON();attempts.push(body);expect(r.request().headers().authorization).toBe('Bearer v440-test');if(fail)return r.fulfill({status:400,contentType:'application/json',body:'{}'});entries.push({...body,username:'avery',created_at:'2026-10-28T10:00:00Z'});return r.fulfill({status:204});});
 await open(page);await sign(page);image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=4;c.height=4;return c.toDataURL('image/jpeg');});await tab(page,'stats');await page.locator('[data-stats-tab=progress]').click();
 await page.locator('[data-add-reaction]').click();await page.locator('.sheet-backdrop.open .emoji-picker #emojiSearch').fill('👍🏽');await page.locator('.sheet-backdrop.open .emoji-use').click();await expect(page.locator('[data-photo-reaction]')).toContainText('👍🏽');expect(emoji).toBe('👍🏽');
 await page.locator('[data-add-reaction]').click();await page.locator('.sheet-backdrop.open .emoji-picker #emojiSearch').fill('family');await expect(page.locator('.sheet-backdrop.open .reaction-choices [data-reaction-choice]').first()).toBeVisible();await page.locator('.sheet-backdrop.open .emoji-picker [data-sheet-close]').click();
 await page.locator('[data-photo-comments]').click();await expect(page.locator('.photo-comment')).toHaveCount(30);await page.locator('[data-older-comments]').click();await expect(page.locator('.photo-comment')).toHaveCount(31);await expect(page.locator('[data-older-comments]')).toHaveCount(0);
 await page.locator('#photoCommentInput').fill('<img src=x> Great progress');fail=true;await page.locator('[data-post-comment]').click();await expect(page.locator('.photo-comments-status')).toContainText('Try again');await expect(page.locator('#photoCommentInput')).toHaveValue('<img src=x> Great progress');
 fail=false;await page.locator('[data-post-comment]').click();await expect(page.locator('.photo-comment').last()).toContainText('<img src=x> Great progress');expect(attempts[0].id).toBe(attempts[1].id);await expect(page.locator('.photo-comment p img')).toHaveCount(0);await expect(page.locator('[data-remove-comment]')).toHaveCount(1);
 await page.setViewportSize({width:320,height:400});await page.locator('#photoCommentInput').focus();await expect.poll(()=>page.locator('[data-post-comment]').evaluate(el=>el.getBoundingClientRect().bottom<=400)).toBe(true);await page.screenshot({path:test.info().outputPath('photo-comments-keyboard.png'),animations:'disabled'});
 await page.evaluate(async id=>{(await import('/js/cloud/sync.js')).account.user={id};window.dispatchEvent(new CustomEvent('gym:account'));},friend);await expect(page.locator('.photo-comments-sheet')).toHaveCount(0);
});
test('first-use screens match the current theme, weekly plan edits keep their data and legacy gym dates stay hidden',async({page})=>{
 await mock(page);const dateCalls=[];page.on('request',r=>{if(/rest\/v1\/(gym_dates|gym_date_rsvps|gym_date_invites|rpc\/gym_date_counts)/.test(r.url()))dateCalls.push(r.url());});
 await page.addInitScript(()=>{localStorage.setItem('gymSettings',JSON.stringify({buttonColor:'#173247',surfaceColor:'#102332',textColor:'#e8f2ff'}));});
 await open(page);await expect(page.locator('.onboarding')).toContainText('Make it your routine.');await expect(page.locator('.setup-steps li')).toHaveCount(3);await expect(page.locator('.onboarding')).toHaveCSS('background-color','rgb(16, 35, 50)');await page.screenshot({path:test.info().outputPath('first-use.png'),animations:'disabled'});
 await tab(page,'crew');await expect(page.locator('.crew-intro')).toContainText('Better with friends');await expect(page.locator('#page-crew')).not.toContainText('gym dates');
 await tab(page,'calendar');await expect(page.locator('.legend')).not.toContainText('Gym date');
 await page.evaluate(async()=>{const {state}=await import('/js/state.js');state.workouts={Push:[{name:'T-Bar Row',cat:'back',sets:2,target:'8–12',rest:180,note:''}]};state.schedule={0:'Push',2:'Push'};});
 await tab(page,'plan');await expect(page.locator('.week-slot')).toHaveCount(7);await expect(page.locator('.plan-week h2')).toHaveCount(0);await page.screenshot({path:test.info().outputPath('weekly-plan.png'),animations:'disabled'});
 await page.locator('[data-edit=Push]').click();await page.getByRole('checkbox',{name:'Warm-up sets for T-Bar Row',exact:true}).check();await expect(page.locator('.ex-edit-fields .stepper output')).toHaveText('2');await page.screenshot({path:test.info().outputPath('exercise-editor.png'),animations:'disabled'});
 await sign(page);await tab(page,'crew');expect(dateCalls).toEqual([]);
});
