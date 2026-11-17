import{test,expect,open,tab,fillPrompt,scheduleToday,startTodayWorkout,sheetAction}from'./helpers.js';
test.beforeEach(async({page})=>{await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={};'}));});
const option=(page,name)=>page.locator('.sheet-backdrop.open').last().getByRole('option',{name,exact:true});
async function setup(page){await open(page);await tab(page,'plan');await page.getByRole('button',{name:'New workout',exact:true}).click();await fillPrompt(page,'Equipment test');}
async function lateral(page){
 await page.locator('#exSearch').fill('lateral raise');
 const result=page.locator('#exResults [data-add]').filter({has:page.locator('b',{hasText:/^Lateral raise$/})});
 await expect(result).toHaveCount(1);await result.click();
 await option(page,'Cable').click();await option(page,'Cable Lateral Raise').click();await option(page,'One arm').click();
}
test('choose a movement, cable, one arm and cuff; switch equipment without touching old logs',async({page})=>{
 await setup(page);await lateral(page);
 let row=page.locator('[data-ex="Single-Arm Cable Lateral Raises"]');
 await row.locator('[data-choice=attachment]').click();await page.getByRole('option',{name:/^Wrist cuff One cuff on the working arm$/}).click();
 await expect(row.locator('.ex-edit-head b')).toHaveText('Single-Arm Cable Lateral Raises · Wrist cuff');
 await row.locator('[data-field=note]').fill('Pulley low');await row.locator('[data-field=note]').press('Tab');
 await row.locator('[data-field=warmup]').check();
 await page.locator('[data-close-editor]').click();await scheduleToday(page,'Equipment test');await tab(page,'today');await startTodayWorkout(page);
 const card=page.locator('#session .ex-card');await expect(card.locator('h3')).toContainText('Wrist cuff');
 for(let i=0;i<2;i++){await card.locator('.set-row:not(.warmup-row) .w').nth(i).fill('10');await card.locator('.set-row:not(.warmup-row) .r').nth(i).fill('8');await card.locator('.set-row:not(.warmup-row) .check').nth(i).click();}
 await page.getByRole('button',{name:'Finish workout',exact:true}).click();await sheetAction(page,'Save workout');
 const logs=await page.evaluate(()=>localStorage.getItem('gymLogs'));
 expect(Object.values(JSON.parse(logs))[0][0].exercises[0]).toMatchObject({name:'Single-Arm Cable Lateral Raises',attachment:'cuff',unilateral:true});
 await tab(page,'plan');await page.locator('[data-edit="Equipment test"]').click();
 await row.locator('[data-choice=exercise-equipment]').click();await option(page,'Dumbbell').click();await option(page,'Dumbbell Lateral Raise').click();await option(page,'Both arms').click();
 row=page.locator('[data-ex="Dumbbell Lateral Raise"]');
 await expect(row.locator('[data-choice=attachment]')).toHaveCount(0);await expect(row.locator('.ex-edit-fields output')).toHaveText('2');await expect(row.locator('.warmup-count output')).toHaveText('1');
 await expect(row.locator('[data-field=note]')).toHaveValue('Pulley low');
 expect(await page.evaluate(()=>localStorage.getItem('gymLogs'))).toBe(logs);
 await page.reload();await page.locator('#loadingScreen').waitFor({state:'detached'});await tab(page,'plan');await page.locator('[data-edit="Equipment test"]').click();await expect(row).toBeVisible();
});
test('cancelling setup leaves the routine intact and plate-loaded row versions stay distinct',async({page})=>{
 await setup(page);const before=await page.evaluate(()=>localStorage.getItem('gymCustomWorkouts'));
 await page.locator('#exSearch').fill('lateral raise');await page.locator('#exResults [data-add]').filter({has:page.locator('b',{hasText:/^Lateral raise$/})}).click();
 await page.keyboard.press('Escape');expect(await page.evaluate(()=>localStorage.getItem('gymCustomWorkouts'))).toBe(before);
 await page.locator('#exSearch').fill('row');await page.locator('#exResults [data-add]').filter({has:page.locator('b',{hasText:/^Row$/})}).click();await option(page,'Plate-loaded machine').click();
 for(const name of ['Plate-Loaded Row','Plate-Loaded Low Row','Machine High Row'])await expect(option(page,name)).toBeVisible();
 await option(page,'Plate-Loaded Low Row').click();await option(page,'Both arms').click();await expect(page.locator('[data-ex="Plate-Loaded Low Row"]')).toBeVisible();
});
test.describe('offline attachment setup',()=>{
 test.use({serviceWorkers:'allow'});
 test('cuff choice and explicit removal survive a real offline reload',async({page,context})=>{
  await setup(page);await lateral(page);
  const row=page.locator('[data-ex="Single-Arm Cable Lateral Raises"]');
  await row.locator('[data-choice=attachment]').click();await page.getByRole('option',{name:/^Wrist cuff One cuff on the working arm$/}).click();
  await page.evaluate(async()=>{await navigator.serviceWorker.register((await import('./js/core/dom.js')).scriptURL('sw.js'),{scope:'./'});await navigator.serviceWorker.ready;});
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.locator('#loadingScreen').waitFor({state:'detached'});
  await context.setOffline(true);await page.reload();await page.locator('#loadingScreen').waitFor({state:'detached'});
  await tab(page,'plan');await page.locator('[data-edit="Equipment test"]').click();
  await expect(row.locator('[data-choice=attachment]')).toHaveText('Wrist cuff');
  await row.locator('[data-choice=attachment]').click();await page.getByRole('option',{name:/^Upper-arm cuff One cuff on the working arm$/}).click();
  await page.reload();await page.locator('#loadingScreen').waitFor({state:'detached'});await tab(page,'plan');await page.locator('[data-edit="Equipment test"]').click();
  await expect(row.locator('[data-choice=attachment]')).toHaveText('Upper-arm cuff');
  await row.locator('[data-choice=attachment]').click();await option(page,'Unspecified').click();
  await expect(row.locator('.ex-edit-head b')).toHaveText('Single-Arm Cable Lateral Raises');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gymCustomWorkouts'))['Equipment test'][0].attachment)).toBe('none');
  await context.setOffline(false);
 });
});

test('setup controls align on a narrow phone and Smith machine is named as equipment',async({page})=>{
 await page.setViewportSize({width:320,height:800});await setup(page);await lateral(page);
 const row=page.locator('[data-ex="Single-Arm Cable Lateral Raises"]');
 const equipment=await row.locator('[data-choice=exercise-equipment]').boundingBox(),attachment=await row.locator('[data-choice=attachment]').boundingBox();
 expect(Math.abs(equipment.y-attachment.y)).toBeLessThanOrEqual(1);expect(Math.abs(equipment.width-attachment.width)).toBeLessThanOrEqual(1);
 const tracking=await row.locator('[data-choice=variant]').boundingBox();expect(tracking.y).toBeGreaterThan(equipment.y+equipment.height);
 const warmup=await row.locator('.warmup-toggle').boundingBox();expect(Math.abs(warmup.y-tracking.y)).toBeLessThanOrEqual(1);expect(Math.abs(warmup.height-tracking.height)).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#exSearch').fill('smith machine shoulder press');
 const smith=page.locator('#exResults [data-add="Smith Machine Shoulder Press"]');await expect(smith.locator('b')).toHaveText('Smith Machine Shoulder Press');
 await smith.click();const press=page.locator('[data-ex="Smith Machine Shoulder Press"]');
 await expect(press.locator('.ex-edit-head b')).toHaveText('Smith Machine Shoulder Press');await expect(press.locator('[data-choice=exercise-equipment]')).toHaveText('Smith machine');
 await expect(press.locator('[data-choice=attachment]')).toHaveCount(0);
 const smithEquipment=await press.locator('[data-choice=exercise-equipment]').boundingBox(),smithWarmup=await press.locator('.warmup-toggle').boundingBox();
 expect(Math.abs(smithEquipment.y-smithWarmup.y)).toBeLessThanOrEqual(1);expect(smithWarmup.x).toBeGreaterThan(smithEquipment.x);
});

test('single-leg calf presses save with two sets per leg; X removal confirms, cancels and preserves history',async({page})=>{
 await setup(page);const history=await page.evaluate(()=>localStorage.getItem('gymLogs'));
 await page.locator('#exSearch').fill('Leg Press Calf Raise');await page.locator('[data-add="Leg Press Calf Raise"]').click();await option(page,'One leg').click();
 const row=page.locator('[data-ex="Single-Leg Leg Press Calf Raise"]');await expect(row.locator('.ex-edit-fields output')).toHaveText('2');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gymCustomWorkouts'))['Equipment test'][0])).toMatchObject({sets:4,unilateral:true});
 await row.locator('[data-remove]').click();await expect(page.locator('.confirmation-sheet')).toContainText('Remove exercise?');await sheetAction(page,'Keep exercise');await expect(row).toBeVisible();
 await row.locator('[data-remove]').click();await sheetAction(page,'Remove');await expect(row).toHaveCount(0);await page.locator('#toast .toast-action').click();await expect(row).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('gymLogs'))).toBe(history);
 await page.reload();await page.locator('#loadingScreen').waitFor({state:'detached'});await tab(page,'plan');await page.locator('[data-edit="Equipment test"]').click();await expect(row).toBeVisible();
});
