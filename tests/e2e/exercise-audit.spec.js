import {test,expect,open,tab,fillPrompt} from './helpers.js';

test.use({serviceWorkers:'allow'});
test('reviewed additional movement versions save and reopen offline without rewriting history',async({page,context})=>{
 await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={};'}));
 await open(page);
 await page.evaluate(async()=>{
  await navigator.serviceWorker.register((await import('./js/core/dom.js')).scriptURL('sw.js'),{scope:'./'});
  await navigator.serviceWorker.ready;
 });
 await page.reload();
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.locator('#loadingScreen').waitFor({state:'detached'});
 const history=await page.evaluate(()=>localStorage.getItem('gymLogs'));
 await tab(page,'plan');
 await page.getByRole('button',{name:'New workout',exact:true}).click();
 await fillPrompt(page,'Final exercise audit');
 const names=['Single-Arm Chest-Supported Row','Single Leg Glute Bridge','Single-Arm Push-Up','Alternate Hammer Curl','Alternate Incline Dumbbell Curl','Single-Arm Cable Wood Chop','Single-Arm Farmer Carry','Dumbbell Alternate Bicep Curl','One-Arm Open Palm Kettlebell Clean'];
 for(const name of names){
  await page.locator('#exSearch').fill(name);
  const pick=page.locator(`#exResults [data-add="${name}"]`);
  await expect(pick).toHaveCount(1);
  await pick.click();
  await page.getByRole('option',{name:/^One (arm|leg)/}).click();
  await expect(page.locator(`[data-ex="${name}"] .ex-edit-fields .stepper output`)).toHaveText('2');
 }
 const saved=await page.evaluate(()=>localStorage.getItem('gymCustomWorkouts'));
 await context.setOffline(true);
 await page.reload();
 await page.locator('#loadingScreen').waitFor({state:'detached'});
 await tab(page,'plan');
 await page.locator('[data-edit="Final exercise audit"]').click();
 await expect(page.locator('.ex-edit')).toHaveCount(names.length);
 await page.locator('#exSearch').fill('Dumbbell Bicep Curl');
 await expect(page.locator('#exResults [data-movement="biceps curl"]')).toHaveCount(1);
 expect(await page.evaluate(()=>localStorage.getItem('gymCustomWorkouts'))).toBe(saved);
 expect(await page.evaluate(()=>localStorage.getItem('gymLogs'))).toBe(history);
 await context.setOffline(false);
});
