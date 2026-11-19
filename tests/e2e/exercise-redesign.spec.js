import {test,expect,open,tab,fillPrompt,sheetAction,finishExercisePick} from './helpers.js';
test.use({viewport:{width:393,height:851},isMobile:true,hasTouch:true});
test.beforeEach(async({page})=>{await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={};'}));});
async function editor(page){await open(page);await tab(page,'plan');await page.getByRole('button',{name:'New workout',exact:true}).click();await fillPrompt(page,'New logic');}

test('live plate-loaded versions preserve per-arm sets, warm-ups, notes, history and saved names',async({page})=>{
 await editor(page);
 const history=await page.evaluate(()=>localStorage.getItem('gymLogs'));
 await page.locator('#exSearch').fill('plate loaded pulldown');
 await expect(page.locator('#exResults [data-add]')).toHaveCount(1);
 await page.locator('#exResults [data-add]').click();await page.getByRole('option',{name:/^Both arms/}).click();
 let row=page.locator('[data-ex="Plate-Loaded Pulldown"]');
 await row.locator('[data-field=note]').fill('Seat 3');await row.locator('[data-field=note]').press('Tab');
 await row.locator('[data-field=warmup]').check();
 await row.locator('[data-choice=variant]').click();await page.getByRole('option',{name:/^One arm/}).click();
 row=page.locator('[data-ex="Single-Arm Plate-Loaded Pulldown"]');
 await expect(row).toBeVisible();await expect(row.locator('[data-choice=variant]')).toBeFocused();
 await expect(row.locator('.ex-edit-fields output')).toHaveText('2');await expect(row.locator('.warmup-count output')).toHaveText('1');
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('gymCustomWorkouts'))['New logic'][0]);
 expect(saved).toMatchObject({name:'Single-Arm Plate-Loaded Pulldown',sets:4,warmupSets:2,note:'Seat 3',unilateral:true});
 expect(await page.evaluate(()=>localStorage.getItem('gymLogs'))).toBe(history);
 await page.reload();await page.locator('#loadingScreen').waitFor({state:'detached'});await tab(page,'plan');await page.locator('[data-edit="New logic"]').click();
 await expect(row).toBeVisible();await row.locator('[data-choice=variant]').click();await page.getByRole('option',{name:/^Both arms/}).click();
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('gymCustomWorkouts'))['New logic'][0]);expect(saved).toMatchObject({name:'Plate-Loaded Pulldown',sets:2,warmupSets:1,note:'Seat 3'});
 await expect(page.locator('[data-exercise-details],.exercise-instructions')).toHaveCount(0);
});
test('one picker family supports both versions without overwriting an existing version',async({page})=>{
 await editor(page);await page.locator('#exSearch').fill('single arm cable lateral raise');
 await expect(page.locator('#exResults [data-add]')).toHaveCount(1);
 await page.locator('#exResults [data-add]').click();await page.getByRole('option',{name:/^One arm/}).click();
 await page.locator('#exSearch').fill('Cable Lateral Raise');
 const pick=page.locator('[data-add="Cable Lateral Raise"]');await pick.click();await page.getByRole('option',{name:/^Both arms/}).click();
 await page.locator('[data-ex="Cable Lateral Raise"] [data-choice=variant]').click();await page.getByRole('option',{name:/^One arm/}).click();
 await expect(page.locator('#toast')).toContainText('already in this workout');await expect(page.locator('[data-ex]')).toHaveCount(2);
 await expect(page.locator('[data-ex="Cable Lateral Raise"]')).toBeVisible();
});
test('version selection cancels safely and rejects background changes to the edited movement',async({page})=>{
 await editor(page);await page.locator('#exSearch').fill('Plate-Loaded Pulldown');await page.locator('#exResults [data-add]').click();
 await page.keyboard.press('Escape');await expect(page.locator('[data-ex]')).toHaveCount(0);
 await page.locator('#exResults [data-add]').click();await page.getByRole('option',{name:/^Both arms/}).click();
 await page.locator('[data-choice=variant]').click();
 await page.evaluate(async()=>{const{state,savePlan}=await import('/js/state.js');state.workouts['New logic'][0].note='Remote note';savePlan();});
 await page.getByRole('option',{name:/^One arm/}).click();await expect(page.locator('#toast')).toContainText('Exercise changed');
 await expect(page.locator('[data-ex="Plate-Loaded Pulldown"]')).toBeVisible();
});
test('rank divisions have progressively distinct artwork and consistent colour',async({page})=>{
 await open(page);await tab(page,'stats');
 await page.evaluate(async()=>{const {html,render}=await import('/js/core/dom.js'),{rankBadge,paintStrength}=await import('/js/ui/strength.js'),{rankFromScore}=await import('/js/domain/ranks.js');const root=document.createElement('section');root.id='evolving-ranks';document.querySelector('#page-stats').prepend(root);render(root,html`${[300,325,350,375].map(x=>rankBadge(rankFromScore(x),'large'))}`);paintStrength(root);});
 const badges=page.locator('#evolving-ranks .rank-emblem');
 expect(await badges.evaluateAll(els=>els.map(el=>el.dataset.rankDivision))).toEqual(['4','3','2','1']);
 expect(await badges.evaluateAll(els=>els.map(el=>el.querySelectorAll('.emblem-division path').length))).toEqual([1,2,3,4]);
 expect(new Set(await badges.evaluateAll(els=>els.map(el=>el.querySelector('svg').innerHTML))).size).toBe(4);
 await expect(badges.nth(0)).toHaveCSS('color','rgb(255, 211, 79)');
});
test('bodygraph separates back regions and groups the core with the calculator in Your rank',async({page})=>{
 await open(page);await tab(page,'stats');await expect(page.locator('[data-stats-tab=calculator]')).toHaveCount(0);
 const logs=await page.evaluate(()=>localStorage.getItem('gymLogs'));
 await page.locator('[data-open-calculator]').click();await expect(page.locator('#rankCalculator')).toBeVisible();
 await page.locator('#rankCalculator [name=weight]').fill('80');await page.locator('#rankCalculator [name=reps]').fill('1');await page.getByRole('button',{name:'Calculate rank',exact:true}).click();await expect(page.locator('#rankCalculatorResult')).toContainText('Gold');
 expect(await page.evaluate(()=>localStorage.getItem('gymLogs'))).toBe(logs);
 await page.getByRole('dialog',{name:'Rank calculator'}).getByRole('button',{name:'Close'}).click();
 await page.locator('[data-stats-tab=stats]').click();
 await expect(page.locator('.rank-body').first().locator('[data-region=abs] path')).toHaveCount(6);
 await expect(page.locator('.rank-body').first().locator('[data-region=trapezius]')).toHaveAttribute('aria-label',/^Traps:/);
 await expect(page.locator('[data-rank-muscle=midback] summary')).toContainText('Mid-back');
 await expect(page.locator('[data-rank-muscle=obliques]')).toHaveCount(0);
 await page.locator('.rank-body').first().locator('[data-region=obliques]').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-rank-muscle=abs]')).toHaveAttribute('open','');
 await expect(page.locator('[data-body-explore],.bodygraph-note')).toHaveCount(0);
 await expect(page.locator('.rank-body').first().locator('[data-region=brachialis]')).toHaveAttribute('data-muscle','biceps');
 await expect(page.locator('.rank-body').first().locator('[data-region=adductor]')).toHaveAttribute('aria-label',/^Adductors:/);
 await expect(page.locator('.rank-body').nth(1).locator('[data-region=back-deltoids]')).toHaveAttribute('aria-label',/^Rear delt:/);

});
test('first-use and Stats typography matches Friends and fits a small phone',async({page})=>{
 await open(page);await expect(page.locator('.onboarding')).toBeVisible();
 const today=await page.locator('#page-today .top h1').evaluate(el=>{const s=getComputedStyle(el);return[s.fontFamily,s.fontSize,s.fontWeight];});
 for(const name of ['stats','crew']){await tab(page,name);expect(await page.locator('.page.active .top h1').evaluate(el=>{const s=getComputedStyle(el);return[s.fontFamily,s.fontSize,s.fontWeight];})).toEqual(today);}
 await page.setViewportSize({width:320,height:700});await tab(page,'stats');await page.locator('[data-stats-tab=stats]').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('a version picker cannot save into a different account after an ownership change',async({page})=>{
 await editor(page);await page.locator('#exSearch').fill('Plate-Loaded Pulldown');await page.locator('#exResults [data-add]').click();await page.getByRole('option',{name:/^Both arms/}).click();
 await page.locator('[data-choice=variant]').click();
 const before=await page.evaluate(()=>localStorage.getItem('gymCustomWorkouts'));
 await page.evaluate(async()=>{(await import('/js/cloud/sync.js')).account.user={id:'other-local-account'};});
 await page.getByRole('option',{name:/^One arm/}).click();
 expect(await page.evaluate(()=>localStorage.getItem('gymCustomWorkouts'))).toBe(before);
 await expect(page.locator('[data-ex="Plate-Loaded Pulldown"]')).toHaveCount(1);
});
test('Graphite is the neutral default while saved themes and light/custom colors remain authoritative',async({page})=>{
 await open(page);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#d6e1eb');
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--body-color').trim())).toBe('#525d68');
 await page.evaluate(async()=>{const{state}=await import('/js/state.js');state.settings.theme={base:'dark',preset:'ocean'};state.settings.bodyColor='#123456';(await import('/js/ui/theme.js')).applyTheme();});
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#38bdf8');
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--body-color').trim())).toBe('#123456');
 await page.evaluate(async()=>{const{state}=await import('/js/state.js');state.settings.theme={base:'light',preset:'graphite'};delete state.settings.bodyColor;(await import('/js/ui/theme.js')).applyTheme();});
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--surface').trim())).toBe('#ffffff');
});

test('exact library searches show the setup and the calculator selects the one-arm version',async({page})=>{
 await editor(page);await page.locator('#exSearch').fill('single arm overhead cable extension');
 const results=page.locator('#exResults [data-add]');await expect(results).toHaveCount(1);
 await expect(results.locator('b')).toHaveText('Single-Arm Overhead Cable Extension');
 await expect(results).toContainText('Cable');
 await results.click();await page.getByRole('option',{name:/^One arm/}).click();
 await expect(page.locator('[data-ex="Single-Arm Overhead Cable Extension"]')).toBeVisible();
 await page.locator('[data-close-editor]').click();await tab(page,'stats');await page.locator('[data-open-calculator]').click();
 await page.locator('[data-pick-rank-exercise]').click();await page.locator('#rankExerciseSearch').fill('plate loaded pulldown');
 await expect(page.locator('[data-rank-choice]')).toHaveCount(1);await expect(page.locator('[data-rank-choice]')).toHaveText('Plate-Loaded Pulldown');
 await page.locator('[data-rank-choice]').click();await page.getByRole('option',{name:/^One arm/}).click();
 await expect(page.locator('[data-rank-unit]')).toHaveText('kg per side');
 await page.locator('#rankCalculator [name=weight]').fill('30');await page.locator('#rankCalculator [name=reps]').fill('8');
 await page.getByRole('button',{name:'Calculate rank',exact:true}).click();const one=await page.locator('#rankCalculatorResult h3').textContent();
 await page.locator('[data-pick-rank-exercise]').click();await page.locator('#rankExerciseSearch').fill('plate loaded pulldown');await page.locator('[data-rank-choice]').click();await page.getByRole('option',{name:/^Both arms/}).click();
 await expect(page.locator('[data-rank-unit]')).toHaveText('kg total');await page.locator('#rankCalculator [name=weight]').fill('60');await page.getByRole('button',{name:'Calculate rank',exact:true}).click();await expect(page.locator('#rankCalculatorResult h3')).toHaveText(one);
});
test('saving an unfinished left side preserves pair positions, score and reopened rows',async({page})=>{
 await open(page);
 await page.evaluate(async()=>{const{state,savePlan,saveWeights}=await import('/js/state.js');state.workouts={'Pair test':[{name:'Single-Arm Plate-Loaded Pulldown',cat:'back',sets:4,unilateral:true,target:'8',rest:0}]};savePlan();state.weights=[{date:'2026-01-01',weight:80}];saveWeights();(await import('/js/ui/session.js')).openSession('Pair test','2026-01-02');});
 const rows=page.locator('#session .work-sets tbody tr');await expect(rows).toHaveCount(4);
 for(const [index,w]of [[1,'50'],[2,'20'],[3,'20']]){await rows.nth(index).locator('.w').fill(w);await rows.nth(index).locator('.r').fill('8');await rows.nth(index).locator('.d').check();}
 await page.locator('#sessionMain').click();await sheetAction(page,'Save workout');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('gymLogs'))['2026-01-02'][0].exercises[0]);expect(saved.unilateral).toBe(true);expect(saved.sets).toHaveLength(4);expect(saved.sets[0]).toEqual({w:'',r:'',done:false});expect(saved.sets[1].w).toBe('50');
 await page.reload();await page.locator('#loadingScreen').waitFor({state:'detached'});
 expect(await page.evaluate(async()=>{const{state}=await import('/js/state.js'),{strengthStats,rankSet}=await import('/js/domain/ranks.js');return strengthStats(state.logs,state.weights).overall.score===rankSet('Plate-Loaded Pulldown',40,8,80).score;})).toBe(true);
 await page.evaluate(async()=>{(await import('/js/ui/session.js')).openSession('Pair test','2026-01-02');});
 await expect(rows.nth(0).locator('.w')).toHaveValue('');await expect(rows.nth(1).locator('.w')).toHaveValue('50');await expect(rows.nth(1).locator('.set-label')).toHaveText('R1');
});


test('picker separates bodygraph muscle regions and saves a selected hamstring exercise',async({page})=>{
 await editor(page);
 await page.locator('#exMuscle').click();
 for(const name of ['Hamstrings','Quads','Calves','Glutes','Adductors','Biceps','Triceps','Forearms','Lats','Mid-back','Traps','Abs'])await expect(page.getByRole('option',{name,exact:true})).toHaveCount(1);
 for(const name of ['Legs','Arms','Core','Abductors'])await expect(page.getByRole('option',{name,exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
 for(const [group,query]of [['Glutes','hip abduction'],['Adductors','hip adduction'],['Lats','lat pulldown'],['Traps','plate loaded row'],['Abs','abdominal crunch']]){
  await page.locator('#exMuscle').click();await page.getByRole('option',{name:group,exact:true}).click();await page.locator('#exSearch').fill(query);
  await expect(page.locator('#exResults [data-add]').first()).toBeVisible();await expect(page.locator('#exResults .picks-count')).toContainText(group);
 }
 await page.locator('[data-reset-library]').click();await expect(page.locator('#exMuscle')).toHaveText('All muscles');await expect(page.locator('#exSearch')).toHaveValue('abdominal crunch');
 await page.locator('#exMuscle').click();await page.getByRole('option',{name:'Hamstrings',exact:true}).click();await page.locator('#exSearch').fill('Seated Leg Curl');await page.locator('[data-add="Seated Leg Curl"]').click();await finishExercisePick(page,'Seated Leg Curl');
 await expect(page.locator('[data-ex="Seated Leg Curl"]')).toContainText('Hamstrings');await page.locator('[data-close-editor]').click();await page.reload();await page.locator('#loadingScreen').waitFor({state:'detached'});await tab(page,'plan');await page.locator('[data-edit="New logic"]').click();await expect(page.locator('[data-ex="Seated Leg Curl"]')).toBeVisible();
});
