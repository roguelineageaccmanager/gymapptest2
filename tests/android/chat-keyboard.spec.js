import { test, expect, _android as android } from '@playwright/test';
import { makeUser, uniqueName, adminClient } from '../integration/helpers.js';
import { execFileSync } from 'node:child_process';

const PKG = 'com.roguelineage.rattracker';
test('chat composer and Send stay above the real Android keyboard', async () => {
  const [device] = await android.devices();
  if (!device) throw new Error('No Android device connected');
  const user = await makeUser(uniqueName('ime'));
  try {
    await device.shell(`am force-stop ${PKG}`); await device.shell(`pm clear ${PKG}`);
    await device.shell('settings put secure show_ime_with_hard_keyboard 1');
    await device.shell(`am start -W -n ${PKG}/.MainActivity`);
    const webview = await device.webView({ pkg: PKG }, { timeout: 60000 }), page = await webview.page();
    await expect(page.locator('#page-today h1')).toHaveText('Today', { timeout: 30000 });
    await page.locator('#loadingScreen').waitFor({ state: 'detached' });
    const full = await page.evaluate(() => innerHeight);
    const pager=await page.context().newCDPSession(page),heading=await page.locator('#page-today .top').boundingBox(),px=heading.x+heading.width/2,py=heading.y+20;
    await pager.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:px,y:py,id:1}]});
    await pager.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:px-150,y:py,id:1}]});
    await expect(page.locator('#page-plan.swipe-preview')).toBeVisible();
    await expect(page.locator('#page-plan')).toHaveAttribute('aria-hidden','true');
    await pager.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.locator('#page-plan')).toHaveClass(/active/);await expect(page.locator('.swipe-preview')).toHaveCount(0);await pager.detach();
    await page.locator('.page.active [data-open-settings]').click();
    await page.locator('#authForm [name=email]').fill(user.email); await page.locator('#authForm [name=password]').fill(user.password);
    await page.locator('#authForm [type=submit]').click();
    await expect(page.locator('#page-settings .account-identity')).toContainText('@' + user.username, { timeout: 30000 });
    await page.locator('[data-close-settings]').click();
    await page.locator('[data-page=crew]').click(); await page.locator('#crew-tab-dates').click();
    for(let i=0;i<20;i++) {
      const sent=await user.client.rpc('send_chat_reply',{message_id:crypto.randomUUID(),message_body:'Earlier workout message '.repeat(20)+i,reply_id:null});
      expect(sent.error).toBeNull();
    }
    const swipeTarget=crypto.randomUUID();
    expect((await user.client.rpc('send_chat_reply',{message_id:swipeTarget,message_body:'Swipe to reply target',reply_id:null})).error).toBeNull();
    await page.evaluate(async()=>await(await import('/js/ui/chat.js')).loadChat({bottom:true}));
    await expect(page.locator('.chat-message')).toHaveCount(21);
    // Real touch dispatch also reaches the app-wide tab navigation handlers.
    const messageBox=await page.locator('.chat-message p').last().boundingBox();
    const touchX=messageBox.x+Math.min(200,messageBox.width-12),touchY=messageBox.y+Math.min(20,messageBox.height/2);
    expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-message]')?.dataset.message,{x:touchX,y:touchY})).toBe(swipeTarget);
    await page.evaluate(()=>{window.__gestureTrace=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,event=>window.__gestureTrace.push({type,target:event.target.closest?.('[data-message]')?.dataset.message,x:event.clientX??event.touches?.[0]?.clientX,y:event.clientY??event.touches?.[0]?.clientY}),true);});
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchX,y:touchY,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchX-32,y:touchY,id:1}]});
    await expect(page.locator('#page-crew')).toHaveCSS('transform','none');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchX-115,y:touchY,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.locator('.chat-reply-preview')).toBeVisible();
    await expect(page.locator('#page-crew')).toHaveClass(/active/);
    await cdp.detach();
    await page.locator('#chatInput').click(); await page.locator('#chatInput').fill('Real keyboard test');
    await expect.poll(() => {
      try { return /mInputShown=true|mIsInputViewShown=true|mImeWindowVis=0x3/.test(execFileSync('adb', ['shell', 'dumpsys', 'input_method'], { encoding: 'utf8', timeout: 5000 })); }
      catch { return false; }
    }, { timeout: 15000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => Math.min(innerHeight, visualViewport?.height || innerHeight)), { timeout: 15000 }).toBeLessThan(full - 100);
    await expect(page.locator('body')).toHaveClass(/chat-keyboard-open/);
    const visible = () => page.evaluate(() => {
      const top = visualViewport?.offsetTop || 0, bottom = top + (visualViewport?.height || innerHeight);
      return ['#chatInput', '#chatForm [type=submit]'].every(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return r.top >= top && r.bottom <= bottom; });
    });
    await expect.poll(visible).toBe(true);
    await page.locator('#chatForm [type=submit]').click();
    await expect(page.locator('.chat-message.mine').last()).toContainText('Real keyboard test', { timeout: 15000 });
    await expect(page.locator('#chatInput')).toHaveValue('');
    await expect.poll(visible).toBe(true);
    await test.info().attach('Android chat keyboard', { body: await device.screenshot(), contentType: 'image/png' });
    await device.shell('input keyevent KEYCODE_BACK');
    await expect(page.locator('body')).not.toHaveClass(/chat-keyboard-open/);
  } catch(error) {
    try {const webview=await device.webView({pkg:PKG}),page=await webview.page();await test.info().attach('Android gesture failure',{body:await device.screenshot(),contentType:'image/png'});await test.info().attach('Touch event trace',{body:JSON.stringify(await page.evaluate(()=>({events:window.__gestureTrace,viewport:{width:innerWidth,height:innerHeight,top:visualViewport?.offsetTop,visibleHeight:visualViewport?.height},pageTransform:getComputedStyle(document.getElementById('page-crew')).transform}))),contentType:'application/json'});}catch{/* Preserve the original failure if the emulator closed. */}
    throw error;
  } finally { await adminClient().auth.admin.deleteUser(user.id); await device.close(); }
});
