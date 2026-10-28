import {test,expect,open,tab} from './helpers.js';
test.beforeEach(async({page})=>{await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={};'}));});
test('tab swipes reveal an inert neighboring page and clean up after commit, cancel and interruption',async({page})=>{
 await open(page);const cdp=await page.context().newCDPSession(page);
 const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:['touchEnd','touchCancel'].includes(type)?[]:[{x,y,id:1}]});
 const start=async()=>{const box=await page.locator('.page.active .top').boundingBox();const point={x:box.x+box.width/2,y:box.y+20};await touch('touchStart',point.x,point.y);return point;};
 let p=await start();await touch('touchMove',p.x-160,p.y);
 const preview=page.locator('#page-plan.swipe-preview');await expect(preview).toBeVisible();await expect(preview).toHaveAttribute('aria-hidden','true');expect(await preview.evaluate(el=>el.inert)).toBe(true);
 const box=await preview.boundingBox();expect(box.x).toBeLessThan(page.viewportSize().width);expect(box.x+box.width).toBeGreaterThan(0);await expect(page.locator('#page-plan h1')).not.toBeEmpty();await expect(page.locator('.nav-btn.active')).toHaveAttribute('data-page','today');
 await page.screenshot({path:test.info().outputPath('swipe-preview.png'),fullPage:false});await touch('touchEnd');await expect(page.locator('#page-plan')).toHaveClass(/active/);await expect(page.locator('.swipe-preview')).toHaveCount(0);await expect(page.locator('#page-plan')).not.toHaveAttribute('aria-hidden');expect(await page.locator('#page-plan').evaluate(el=>el.inert)).toBe(false);
 const history=await page.evaluate(()=>window.history.length);p=await start();await touch('touchMove',p.x+40,p.y);await expect(page.locator('#page-today.swipe-preview')).toBeVisible();await touch('touchEnd');await expect(page.locator('.swipe-preview')).toHaveCount(0);await expect(page.locator('#page-plan')).toHaveClass(/active/);expect(await page.evaluate(()=>window.history.length)).toBe(history);
 p=await start();await touch('touchMove',p.x-120,p.y);await expect(page.locator('#page-calendar.swipe-preview')).toBeVisible();await touch('touchCancel');await expect(page.locator('.swipe-preview')).toHaveCount(0);await expect(page.locator('#page-plan')).toHaveCSS('transform','none');
 p=await start();await touch('touchMove',p.x-120,p.y);await touch('touchEnd');await tab(page,'stats');await page.waitForTimeout(240);await expect(page.locator('#page-stats')).toHaveClass(/active/);await expect(page.locator('.swipe-preview')).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'reduce'});p=await start();await touch('touchMove',p.x+130,p.y);await expect(page.locator('#page-calendar.swipe-preview')).toBeVisible();await touch('touchEnd');await expect(page.locator('#page-calendar')).toHaveClass(/active/);await expect(page.locator('.swipe-preview')).toHaveCount(0);await cdp.detach();
});
