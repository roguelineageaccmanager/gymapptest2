import {test,expect,open,tab,createWorkout,scheduleToday,startTodayWorkout,sheetAction} from './helpers.js';

test.beforeEach(async({page})=>{
  await page.route('**/cloud-config.js',route=>route.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:"",anonKey:""};'}));
});

test('dead hangs use seconds in plan, warm-ups, draft resume, saved history and duration analytics',async({page})=>{
  await open(page);await createWorkout(page,'Hold',['Dead Hang']);
  await page.locator('[data-edit="Hold"]').click();
  const exercise=page.locator('[data-ex="Dead Hang"]');
  await expect(exercise.locator('[data-field=measurement]')).toHaveText('Seconds');
  await exercise.locator('[data-field=target]').fill('45');
  await exercise.locator('[data-field=target]').press('Tab');
  await exercise.locator('[data-field=warmup]').check();
  await page.locator('[data-close-editor]').click();await scheduleToday(page,'Hold');
  await tab(page,'today');await startTodayWorkout(page);
  await expect(page.locator('.work-sets th').nth(2)).toHaveText('Seconds');
  await expect(page.locator('.warmup-sets th').nth(2)).toHaveText('Seconds');
  await page.locator('.work-sets .w').first().fill('20');
  await page.locator('.work-sets .r').first().fill('45');
  await page.locator('.warmup-sets .r').first().fill('15');
  await page.locator('.warmup-sets .d').first().check();
  await page.locator('.work-sets .d').first().check();
  await page.locator('#sessionBack').click();
  await page.reload();await page.locator('#loadingScreen').waitFor({state:'detached'});
  await tab(page,'today');await startTodayWorkout(page);
  await expect(page.locator('.work-sets .r').first()).toHaveValue('45');
  await expect(page.locator('.work-sets .r').first()).toHaveAttribute('aria-label',/seconds/);
  await page.locator('#sessionMain').click();await sheetAction(page,'Save workout');
  const saved=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('gymLogs'))).flat().at(-1).exercises[0]);
  expect(saved).toMatchObject({name:'Dead Hang',target:'45 s',sets:[{w:'20',r:'45',done:true}],warmups:[{w:'',r:'15',done:true}]});
  await tab(page,'stats');await page.locator('[data-stats-tab=analytics]').click();
  await page.locator('[data-strength-lift="Dead Hang"]').click();
  await expect(page.locator('.strength-detail')).toContainText('Longest hold');
  await expect(page.locator('.strength-detail')).toContainText('45 s');
  await sheetAction(page,'Done');
  await page.evaluate(async()=>{const {ymd}=await import('/js/core/dates.js');void(await import('/js/ui/calendar.js')).openDay(ymd());});
  await expect(page.locator('.sheet-backdrop.open .log-sets')).toContainText('45 s');
  await page.locator('.sheet-backdrop.open [data-edit]').click();
  await expect(page.locator('.work-sets th').nth(2)).toHaveText('Seconds');
  const stats=await page.evaluate(async()=>{const {state}=await import('/js/state.js');return(await import('/js/domain/ranks.js')).strengthStats(state.logs,state.weights);});
  expect(stats.volume).toBe(0);expect(stats.reps).toBe(0);expect(stats.exercises[0].bestSeconds).toBe(45);
});

test('legacy hold logs retain reps and explicit unit overrides do not rewrite old data',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('gymCustomWorkouts',JSON.stringify({Hold:[{name:'Dead Hang',cat:'back',sets:2,target:'8–12',rest:90}]}));
    localStorage.setItem('gymLogs',JSON.stringify({'2026-01-02':[{id:'legacy-hang',day:'Hold',time:'2026-01-02T12:00:00Z',exercises:[{name:'Dead Hang',target:'8–12',sets:[{w:'',r:'3',done:true}]}]}]}));
  });
  await open(page);
  await page.evaluate(async()=>{(await import('/js/ui/session.js')).openSession('Hold','2026-01-02',{key:'legacy-hang'});});
  await expect(page.locator('.work-sets th').nth(2)).toHaveText('Reps');
  await expect(page.locator('.work-sets .r')).toHaveValue('3');
  await page.locator('#sessionBack').click();await tab(page,'plan');await page.locator('[data-edit="Hold"]').click();
  await page.locator('[data-field=measurement]').click();
  await page.getByRole('option', { name: 'Reps Count repetitions', exact: true }).click();
  await expect(page.locator('[data-field=measurement]')).toHaveText('Reps');
  await expect(page.locator('[data-field=target]')).toHaveValue('8–12');
  await page.locator('[data-close-editor]').click();
  await page.evaluate(async()=>{(await import('/js/ui/session.js')).openSession('Hold',undefined,{fresh:true});});
  await expect(page.locator('.work-sets th').nth(2)).toHaveText('Reps');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gymLogs'))['2026-01-02'][0].exercises[0])).toMatchObject({target:'8–12',sets:[{r:'3'}]});
});
