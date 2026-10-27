import { test, expect, open, tab, sheetAction, startTodayWorkout } from './helpers.js';

test('optional warm-ups persist separately, resume as drafts and never enter working-set totals',async({page})=>{
  await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:"",anonKey:""};'}));
  await page.addInitScript(()=>{
    if(localStorage.getItem('v43-seeded'))return;localStorage.setItem('v43-seeded','1');
    localStorage.setItem('gymCustomWorkouts',JSON.stringify({Push:[{name:'Barbell Bench Press',cat:'chest',sets:2,target:'8',rest:90}]}));
    localStorage.setItem('gymPlanSchedule',JSON.stringify({[(new Date().getDay()+6)%7]:'Push'}));
    localStorage.setItem('gymSettings',JSON.stringify({buttonColor:'#143040',inputColor:'#102030'}));
  });
  await open(page);await tab(page,'plan');await page.locator('[data-edit="Push"]').click();
  await page.getByRole('checkbox',{name:'Warm-up sets for Barbell Bench Press',exact:true}).check();
  await page.getByRole('button',{name:'More warm-up sets for Barbell Bench Press',exact:true}).click();
  await expect(page.locator('.warmup-count output')).toHaveText('2');
  await expect(page.locator('.ex-edit-fields .stepper output')).toHaveText('2');
  await expect(page.locator('.ex-edit-fields .stepper')).toHaveCSS('overflow','hidden');
  await page.getByRole('checkbox',{name:'Left/right for Barbell Bench Press',exact:true}).check();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gymCustomWorkouts')).Push[0])).toMatchObject({sets:4,warmupSets:4});
  await page.getByRole('checkbox',{name:'Left/right for Barbell Bench Press',exact:true}).uncheck();
  await page.screenshot({path:test.info().outputPath('plan-warmups.png'),animations:'disabled'});
  await page.reload();await page.locator('#loadingScreen').waitFor({state:'detached'});
  await tab(page,'today');await page.locator('#startToday').click();
  await expect(page.locator('.warmup-sets tbody tr')).toHaveCount(2);await expect(page.locator('.work-sets tbody tr')).toHaveCount(2);
  await expect(page.locator('.warmup-sets .d').first()).toBeDisabled();
  await page.locator('#sessionMain').click();await sheetAction(page,'Start workout');
  const warm=page.locator('.warmup-sets tbody tr').first();
  await warm.locator('.w').fill('100');await warm.locator('.r').fill('1');await warm.locator('.d').check();
  await expect(page.locator('#sessionSets')).toHaveText('0/2 sets');
  await page.locator('#sessionBack').click();await startTodayWorkout(page);
  await expect(page.locator('.warmup-sets .w').first()).toHaveValue('100');await expect(page.locator('.warmup-sets .d').first()).toBeChecked();
  const work=page.locator('.work-sets tbody tr').first();await work.locator('.w').fill('40');await work.locator('.r').fill('8');await work.locator('.d').check();
  await expect(page.locator('#sessionSets')).toHaveText('1/2 sets');
  await page.screenshot({path:test.info().outputPath('warmups.png'),animations:'disabled'});
  await page.locator('#sessionMain').click();await sheetAction(page,'Save workout');
  const saved=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('gymLogs'))).flat().at(-1).exercises[0]);
  expect(saved.sets).toEqual([{w:'40',r:'8',done:true}]);expect(saved.warmups).toEqual([{w:'100',r:'1',done:true}]);
  const stats=await page.evaluate(async()=>{const {leaderboardStats}=await import('/js/domain/logs.js');return leaderboardStats(JSON.parse(localStorage.getItem('gymLogs')));});
  expect(stats.volume_kg_reps).toBe(320);
});

test('Discord rows stay inside the viewport, enter at the bottom and preserve reading position during polls',async({page})=>{
  const uid='00000000-0000-4000-8000-000000000001';
  const rows=Array.from({length:50},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,user_id:uid,username:'avery',body:'Training message '+i,created_at:new Date(Date.UTC(2026,9,27,8,i)).toISOString()}));
  await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
  await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
  await page.route('**/rest/v1/rpc/community_chat_v4',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([...rows].reverse())}));
  await open(page);
  await page.evaluate(async id=>{const {account}=await import('/js/cloud/sync.js'),{supabase}=await import('/js/cloud/client.js');account.user={id};account.ready=true;account.profile={username:'avery'};supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'chat-test'}}});},uid);
  await tab(page,'crew');await expect(page.locator('.chat-message')).toHaveCount(50);
  await expect(page.locator('.chat-heading')).toHaveCount(0);
  await expect(page.locator('.chat-message.mine').first()).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect.poll(()=>page.locator('#chatMessages').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop)).toBeLessThan(3);
  const before=await page.locator('#chatRoom').boundingBox();await page.mouse.move(20,80);await page.mouse.wheel(0,400);
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);expect((await page.locator('#chatRoom').boundingBox()).y).toBe(before.y);
  await page.locator('#chatMessages').evaluate(el=>el.scrollTop=0);await page.evaluate(async()=>await(await import('/js/ui/chat.js')).loadChat());
  expect(await page.locator('#chatMessages').evaluate(el=>el.scrollTop)).toBe(0);
  await page.locator('[data-crew-tab=ranking]').click();await page.locator('[data-crew-tab=dates]').click();
  await expect.poll(()=>page.locator('#chatMessages').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop)).toBeLessThan(3);
  await page.setViewportSize({width:320,height:650});
  await expect.poll(()=>page.locator('#chatMessages').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop)).toBeLessThan(3);
  const input=await page.locator('#chatInput').boundingBox();expect(input.y+input.height).toBeLessThan(650);
  await page.screenshot({path:test.info().outputPath('discord-chat.png'),animations:'disabled'});
});

test('progress reactions show counts and toggle only the signed-in member’s reaction',async({page})=>{
  const uid='00000000-0000-4000-8000-000000000001',friend='00000000-0000-4000-8000-000000000002',photo='00000000-0000-4000-8000-000000000003';
  let image,reactors=[friend];
  await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
  await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
  await page.route('**/rest/v1/progress_photos*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{id:photo,user_id:friend,image_data:image,photo_date:'2026-10-27',created_at:'2026-10-27T12:00:00Z',caption:'Progress',owner:{username:'blake'}}])}));
  await page.route('**/rest/v1/rpc/progress_photo_reactions_for',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(reactors.length ? [{photo_id:photo,emoji:'🔥',reaction_count:reactors.length,mine:reactors.includes(uid)}] : [])}));
  await page.route('**/rest/v1/progress_photo_reactions*',r=>{
    expect(r.request().headers().authorization).toBe('Bearer progress-test');
    if(r.request().method()==='POST'){expect(r.request().postDataJSON()).toEqual({photo_id:photo,user_id:uid,emoji:'🔥'});reactors=[...new Set([...reactors,uid])];}
    else{expect(new URL(r.request().url()).searchParams.get('user_id')).toBe('eq.'+uid);reactors=reactors.filter(id=>id!==uid);}
    return r.fulfill({status:204});
  });
  await open(page);image=await page.evaluate(async id=>{
    const {account}=await import('/js/cloud/sync.js'),{supabase}=await import('/js/cloud/client.js');account.user={id};account.ready=true;account.profile={username:'avery'};
    supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'progress-test'}}});
    const c=document.createElement('canvas');c.width=4;c.height=4;return c.toDataURL('image/jpeg');
  },uid);
  await tab(page,'stats');await page.locator('[data-stats-tab=progress]').click();
  const reaction=page.locator('[data-photo-reaction]');await expect(reaction).toContainText('1');await expect(reaction).toHaveAttribute('aria-pressed','false');
  await page.locator('[data-add-reaction]').click();await page.locator('[data-reaction-choice="🔥"]').click();
  await expect(reaction).toContainText('2');await expect(reaction).toHaveAttribute('aria-pressed','true');
  await reaction.click();await expect(reaction).toContainText('1');await expect(reaction).toHaveAttribute('aria-pressed','false');
  expect(reactors).toEqual([friend]);
  await page.screenshot({path:test.info().outputPath('progress-reactions.png'),animations:'disabled'});
});
