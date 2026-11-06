import { test, expect, open, tab, sheetAction } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
  await page.route('**/rest/v1/**', route => route.fulfill({contentType:'application/json',body:'[]'}));
  await page.addInitScript(() => {
    if (localStorage.getItem('division-seed')) return;
    localStorage.setItem('division-seed', '1');
    localStorage.setItem('bodyWeightLogs', JSON.stringify([{date:'2026-01-01',weight:80}]));
    localStorage.setItem('gymCustomWorkouts', JSON.stringify({Strength:[{name:'Barbell Bench Press',cat:'chest',sets:2,target:'8',rest:90}]}));
    localStorage.setItem('gymPlanSchedule', JSON.stringify({0:'Strength'}));
    localStorage.setItem('gymLogs', JSON.stringify({'2026-01-02':[{day:'Strength',exercises:[{name:'Barbell Bench Press',sets:[{w:'112',r:'1',done:true}],warmups:[{w:'999',r:'1',done:true}]}]}]}));
  });
});

test('division and LP agree in overall, muscle, exercise, calculator and profile without changing saved data', async ({ page }) => {
  await open(page); await tab(page,'stats');
  await expect(page.locator('.strength-hero h2')).toContainText('Platinum 4');
  await expect(page.locator('.strength-hero h2')).toContainText('80 LP');
  await expect(page.locator('.strength-hero')).toContainText('20 LP to Platinum 3');
  await expect(page.locator('.strength-hero [role=progressbar]')).toHaveAttribute('aria-valuenow','80');
  const before=await page.evaluate(()=>[localStorage.getItem('gymLogs'),localStorage.getItem('gymCustomWorkouts'),localStorage.getItem('gymPlanSchedule')]);
  await page.locator('[data-stats-tab=stats]').click();
  const chest=page.locator('[data-rank-muscle=chest]');
  await expect(chest.locator('summary')).toContainText('Platinum 4');
  await expect(chest.locator('summary')).toContainText('80 LP');
  await chest.locator('summary').click();
  await chest.locator('[data-strength-lift="Barbell Bench Press"]').click();
  await expect(page.locator('.strength-detail')).toContainText('Platinum 4');
  await expect(page.locator('.strength-detail')).toContainText('80 LP');
  await sheetAction(page,'Done');
  await page.locator('[data-stats-tab=calculator]').click();
  await page.locator('#rankCalculator [name=bodyweight]').fill('80');
  await page.locator('#rankCalculator [name=weight]').fill('128');
  await page.locator('#rankCalculator [name=reps]').fill('1');
  await page.getByRole('button',{name:'Calculate rank',exact:true}).click();
  await expect(page.locator('#rankCalculatorResult')).toContainText('Platinum 1');
  await expect(page.locator('#rankCalculatorResult')).toContainText('20 LP');
  await page.getByRole('button',{name:'How ranks work'}).click();
  await expect(page.locator('.rank-guide')).toContainText('Platinum 4 → 1');
  await expect(page.locator('.sheet-backdrop.open')).toContainText('100 LP per division');
  await sheetAction(page,'Done');
  await page.evaluate(async()=>{
    const {account}=await import('/js/cloud/sync.js'), {supabase}=await import('/js/cloud/client.js');
    const id='00000000-0000-4000-8000-000000000001';
    account.user={id};account.ready=true;account.profile={username:'rank_test'};
    supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:'test'}}});
    void (await import('/js/ui/profile.js')).openMemberProfile(id);
  });
  await expect(page.locator('.profile-stats')).toContainText('Platinum 4 · 80 LP');
  await page.locator('.member-profile-sheet [data-sheet-close]').click();
  expect(await page.evaluate(()=>[localStorage.getItem('gymLogs'),localStorage.getItem('gymCustomWorkouts'),localStorage.getItem('gymPlanSchedule')])).toEqual(before);
  await page.setViewportSize({width:320,height:650});
  await page.locator('[data-stats-tab=rank]').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('rank-divisions.png'),animations:'disabled'});
});
