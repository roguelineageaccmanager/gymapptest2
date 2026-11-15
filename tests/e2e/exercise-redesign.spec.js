import {test,expect,open,tab,fillPrompt} from './helpers.js';
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
test('bodygraph separates back/core regions with six ab shapes and calculator inside Your rank',async({page})=>{
 await open(page);await tab(page,'stats');await expect(page.locator('[data-stats-tab=calculator]')).toHaveCount(0);
 const logs=await page.evaluate(()=>localStorage.getItem('gymLogs'));
 await page.locator('[data-open-calculator]').click();await expect(page.locator('#rankCalculator')).toBeVisible();
 await page.locator('#rankCalculator [name=bodyweight]').fill('80');await page.locator('#rankCalculator [name=weight]').fill('80');await page.locator('#rankCalculator [name=reps]').fill('1');await page.getByRole('button',{name:'Calculate rank',exact:true}).click();await expect(page.locator('#rankCalculatorResult')).toContainText('Gold');
 expect(await page.evaluate(()=>localStorage.getItem('gymLogs'))).toBe(logs);
 await page.locator('[data-stats-tab=stats]').click();
 await expect(page.locator('.rank-body').first().locator('[data-region=abs] path')).toHaveCount(6);
 await expect(page.locator('.rank-body').first().locator('[data-region=trapezius]')).toHaveAttribute('aria-label',/^Traps:/);
 await expect(page.locator('[data-rank-muscle=midback] summary')).toContainText('Mid-back');
 await expect(page.locator('[data-rank-muscle=obliques] summary')).toContainText('Obliques');
 await page.locator('.rank-body').first().locator('[data-region=obliques]').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-rank-muscle=obliques]')).toHaveAttribute('open','');
 await page.locator('[data-body-explore]').click();
 await expect(page.locator('.body-explorer-sheet .rank-body')).toBeVisible();
 await page.locator('.body-explorer-sheet [data-region=brachioradialis] path').first().click();
 await expect(page.locator('.body-explorer-region h3')).toHaveText('Brachioradialis');
 await expect(page.locator('.body-explorer-region header p')).toContainText('Forearms rank');
 await expect(page.locator('.body-explorer-sheet .body-muscle[aria-pressed=true]')).toHaveCount(1);

 await page.locator('[data-body-side=back]').click();await expect(page.locator('.body-explorer-sheet .rank-body')).toHaveAttribute('aria-label','Back muscle ranks');
 await page.locator('[data-body-side=front]').click();
 await page.locator('.body-explorer-sheet [data-region=trapezius]').focus();await page.keyboard.press('Enter');
 await expect(page.locator('.body-explorer-region h3')).toHaveText('Traps');
 await page.locator('.body-explorer-sheet .sheet-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
 await expect(page.locator('.body-explorer-toolbar [data-body-side=back]')).toBeInViewport();
 await page.locator('[data-body-side=back]').click();
 await expect(page.locator('.body-explorer-sheet .rank-body')).toHaveAttribute('aria-label','Back muscle ranks');
 await expect(page.locator('.body-explorer-sheet [data-region=brachioradialis]')).toHaveCount(1);
 await page.locator('.body-explorer-sheet [data-region="mid-back"] path').first().click();
 await expect(page.locator('.body-explorer-region h3')).toHaveText('Mid-back');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page.locator('[data-body-explore]')).toBeFocused();

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
