import { test, expect, open, tab, sheetAction } from './helpers.js';

test('consecutive messages share headers, reset on sender/reply/time/day and retain per-message actions', async ({ page }) => {
  const uid='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002';
  const times=['2026-10-26T12:00:00Z','2026-10-26T12:00:05Z','2026-10-26T12:00:10Z','2026-10-26T12:01:00Z','2026-10-26T12:01:05Z','2026-10-26T12:02:00Z','2026-10-26T12:02:05Z','2026-10-26T12:20:00Z','2026-10-27T12:21:00Z'];
  const text=['Push felt strong today','Added two reps on bench','Ready for Pull tomorrow','Nice work','Same time tomorrow?','Sounds good','See you there','Just finished my warm-ups','New day, new session'];
  const rows=times.map((created_at,i)=>({id:`00000000-0000-4000-8000-${String(i+10).padStart(12,'0')}`,user_id:i===3||i===4?other:uid,username:i===3||i===4?'blake':'avery',body:text[i],created_at}));
  rows[5]={...rows[5],reply_to:rows[3].id,reply_username:'blake',reply_body:rows[3].body};
  await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
  await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
  await page.route('**/rest/v1/rpc/community_chat_v4',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([...rows].reverse())}));
  await page.addInitScript(()=>localStorage.setItem('gymSettings',JSON.stringify({theme:{base:'dark',preset:'custom',color:'#e34768'},buttonColor:'#25171e',borderColor:'#654854'})));
  await open(page);
  await page.evaluate(async id=>{const {account}=await import('/js/cloud/sync.js'),{supabase}=await import('/js/cloud/client.js');account.user={id};account.ready=true;account.profile={username:'avery'};supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'chat-test'}}});},uid);
  await tab(page,'crew'); await expect(page.locator('.chat-message')).toHaveCount(9);
  await expect(page.locator('.chat-person')).toHaveCount(6);await expect(page.locator('.chat-message-meta')).toHaveCount(6);await expect(page.locator('.chat-message.continued')).toHaveCount(3);
  const continued=page.locator(`[data-message="${rows[1].id}"]`);
  await expect(continued.locator('.chat-person,.chat-author')).toHaveCount(0);
  await continued.focus(); await expect(continued.locator('.chat-inline-time')).toHaveCSS('opacity','1');
  await continued.press('Enter');await expect(page.locator('.chat-action-preview')).toHaveCount(0);await expect(page.locator('.chat-quick-reactions')).toBeVisible();await sheetAction(page,'Reply');
  await expect(page.locator('.chat-reply-preview')).toContainText(text[1]);await page.locator('[data-cancel-reply]').click();
  await expect(page.locator('#chatMessages')).toHaveCSS('scrollbar-width','thin');
  const colored=await page.locator('#chatMessages').evaluate(el=>getComputedStyle(el).scrollbarColor);expect(colored).not.toBe('auto');
  await page.setViewportSize({width:320,height:650});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('grouped-chat.png'),animations:'disabled'});
});
