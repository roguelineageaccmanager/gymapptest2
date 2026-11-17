import {test,expect,open,tab,createWorkout,scheduleToday,startTodayWorkout} from './helpers.js';

test('warm-ups sit above working controls and full-width workout actions never overlap',async({page})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={};'}));
 await open(page);await createWorkout(page,'Push',['Barbell Bench Press']);await page.locator('[data-edit=Push]').click();await page.getByRole('checkbox',{name:'Warm-up sets for Barbell Bench Press',exact:true}).check();
 const warm=await page.locator('.warmup-count').boundingBox(),work=await page.locator('.ex-edit-fields').boundingBox();expect(warm.y+warm.height).toBeLessThanOrEqual(work.y);
 await page.locator('[data-close-editor]').click();await scheduleToday(page,'Push');await tab(page,'today');await startTodayWorkout(page);
 for(const width of [320,412]){await page.setViewportSize({width,height:839});const a=await page.locator('#sessionMain').boundingBox(),b=await page.locator('#sessionCancel').boundingBox();expect(Math.abs(a.width-b.width)).toBeLessThan(1);expect(Math.abs(a.x-b.x)).toBeLessThan(1);expect(b.y-a.y-a.height).toBeGreaterThanOrEqual(7);expect(b.x+b.width).toBeLessThanOrEqual(width);}
 await page.screenshot({path:test.info().outputPath('workout-actions.png'),animations:'disabled'});
});
