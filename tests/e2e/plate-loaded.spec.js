import { exerciseFamily } from '../../js/domain/exercise-families.js';
import { test, expect, open, tab, fillPrompt, startTodayWorkout, sheetAction } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/cloud-config.js', route => route.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:"",anonKey:""};'}));
});

test('plate-loaded equipment is discoverable, saves separately and has working calculator ranks', async ({ page }) => {
  await open(page); await tab(page,'plan');
  await page.getByRole('button',{name:'New workout',exact:true}).click();
  await fillPrompt(page,'Plate machines');
  await page.locator('#exEquipment').click();
  await page.getByRole('option', { name: 'Plate-loaded machine', exact: true }).click();
  await expect(page.locator('#exResults [data-add]')).toHaveCount(25);
  for (const name of ['Plate-Loaded Leg Press','Plate-Loaded Seated Leg Curl','Plate-Loaded Triceps Dip','Iso-Lateral Row Machine']) {
    await page.locator('#exSearch').fill(name);
    await page.locator(`[data-add="${name}"]`).click();
    if (exerciseFamily(name)) await page.locator('.sheet-backdrop.open').getByRole('option',{name:/^Both (arms|legs)/}).click();
    await expect(page.locator(`[data-ex="${name}"] .ex-edit-fields .stepper output`)).toHaveText('2');
  }
  await page.locator('#exSearch').fill('plate loaded high row');
  await expect(page.locator('[data-add="Machine High Row"]')).toBeVisible();
  await page.locator('#exSearch').fill('Plate-Loaded Leg Press');
  await expect(page.locator('[data-exercise-details], .exercise-instructions')).toHaveCount(0);
  await page.goBack();
  await page.reload();await page.locator('#loadingScreen').waitFor({state:'detached'});
  await tab(page,'plan');await page.locator('[data-edit="Plate machines"]').click();
  await expect(page.locator('.ex-edit')).toHaveCount(4);
  await page.goBack();await tab(page,'stats');
  await page.locator('[data-stats-tab=rank]').click(); await page.locator('[data-open-calculator]').click();
  await page.locator('[data-pick-rank-exercise]').click();
  await page.locator('.sheet-backdrop.open #rankExerciseSearch').fill('plate loaded high row');
  await page.locator('.sheet-backdrop.open [data-rank-choice="Machine High Row"]').click();
  await page.getByRole('option',{name:'Both arms',exact:true}).click();
  await page.locator('#rankCalculator [name=weight]').fill('80');
  await page.locator('#rankCalculator [name=reps]').fill('1');
  await page.getByRole('button',{name:'Calculate rank',exact:true}).click();
  await expect(page.locator('#rankCalculatorResult')).toContainText('Gold 4');
  await page.locator('[data-pick-rank-exercise]').click();
  await page.locator('.sheet-backdrop.open #rankExerciseSearch').fill('Plate-Loaded Triceps Dip');
  await page.locator('.sheet-backdrop.open [data-rank-choice="Plate-Loaded Triceps Dip"]').click();
  await page.locator('#rankCalculator [name=weight]').fill('40');
  await page.getByRole('button',{name:'Calculate rank',exact:true}).click();
  await expect(page.locator('#rankCalculatorResult')).toContainText('40 kg equivalent 1RM');
  await expect(page.locator('#rankCalculatorResult')).toContainText('Gold 4');
});

test('two working sets at 40 kg per arm match two 80 kg bilateral pulldowns after saving and reopening', async ({ page }) => {
  const oneArm = 'Single-Arm Plate-Loaded Pulldown';
  const bothArms = 'Plate-Loaded Pulldown';
  await page.addInitScript(({ oneArm, bothArms }) => {
    if (localStorage.getItem('gymCustomWorkouts')) return;
    const pull = [
      { name: oneArm, unilateral: true, sets: 4, rest: 0, target: '10' },
      { name: bothArms, sets: 2, rest: 0, target: '10' },
    ];
    const today = (new Date().getDay() + 6) % 7;
    localStorage.setItem('gymCustomWorkouts', JSON.stringify({ Pull: pull }));
    localStorage.setItem('gymPlanSchedule', JSON.stringify({ [today]: 'Pull' }));
    localStorage.setItem('bodyWeightLogs', JSON.stringify([{ date: '2020-01-01', weight: 80 }]));
  }, { oneArm, bothArms });
  await open(page);
  await startTodayWorkout(page);
  const rowsFor = name => page.getByRole('article', { name: name.replace(' Pulldown', ' Lat Pulldown'), exact: true }).locator('.work-sets tbody tr');
  const setups = [
    { name: oneArm, weight: '40', labels: ['L1', 'R1', 'L2', 'R2'] },
    { name: bothArms, weight: '80', labels: ['1', '2'] },
  ];
  for (const { name, weight, labels } of setups) {
    const rows = rowsFor(name);
    await expect(rows.locator('.set-label')).toHaveText(labels);
    for (const [i, row] of (await rows.all()).entries()) {
      if (name === oneArm && i === 1) {
        await page.getByRole('button', {name:'Log R1 with the same weight and reps as L1'}).click();
        await expect(row.locator('.d')).toBeChecked();
        continue;
      }
      await row.locator('.w').fill(weight);
      await row.locator('.r').fill('10');
      await row.locator('.d').check();
    }
  }
  await expect(page.locator('#sessionSets')).toHaveText('4/4 sets');
  await page.locator('#sessionMain').click();
  await sheetAction(page, 'Save workout');
  await expect(page.locator('.hero-card')).toContainText('4 completed sets');
  await page.reload();
  await page.locator('#loadingScreen').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'View or edit' }).click();
  for (const { name, weight, labels } of setups) {
    const rows = rowsFor(name);
    await expect(rows.locator('.set-label')).toHaveText(labels);
    for (const row of await rows.all()) {
      await expect(row.locator('.w')).toHaveValue(weight);
      await expect(row.locator('.r')).toHaveValue('10');
      await expect(row.locator('.d')).toBeChecked();
    }
  }
  await page.goBack();
  await tab(page, 'stats');
  await page.locator('[data-stats-tab=analytics]').click();
  const results = page.locator('#strengthExerciseResults');
  for (const { name } of setups) {
    await results.locator(`[data-strength-lift="${name}"]`).click();
    const detail = page.locator('.sheet-backdrop.open .strength-detail');
    await expect(detail.locator('.lift-rank-heading h3')).toHaveText('Platinum 4');
    await expect(detail.locator('.lift-rank-heading b')).toHaveText('0 LP');
    const sets = detail.locator('.strength-metrics > div').filter({ has: page.getByText('Working sets', { exact: true }) });
    await expect(sets.locator('b')).toHaveText('2');
    await expect(detail.getByLabel('Workout used for rank').locator('li')).toHaveCount(2);
    await expect(detail.locator('.strength-metrics')).toContainText('106.7 kg');
    if (name === oneArm) await expect(detail).toContainText('Load used for LP is 80 kg');
    await sheetAction(page, 'Done');
  }
});

test('old untagged one-arm sets retain their per-arm load when the other side is blank', async ({ page }) => {
  await page.addInitScript(() => {
    const name = 'Single-Arm Plate-Loaded Pulldown';
    const left = { w: '40', r: '10', done: true };
    const blank = { w: '', r: '', done: false };
    const lighterSide = { w: '20', r: '10', done: true };
    localStorage.setItem('gymCustomWorkouts', JSON.stringify({ Pull: [{ name, sets: 4, unilateral: true, target: '10' }] }));
    localStorage.setItem('gymPlanSchedule', JSON.stringify({ 0: 'Pull' }));
    localStorage.setItem('bodyWeightLogs', JSON.stringify([{ date: '2026-01-01', weight: 80 }]));
    localStorage.setItem('gymLogs', JSON.stringify({
      '2026-01-01': [{ day: 'Pull', exercises: [{ name, target: '10', sets: [lighterSide, lighterSide] }] }],
      '2026-01-02': [{ day: 'Pull', exercises: [{ name, target: '10', sets: [left, blank, left] }] }],
    }));
  });
  await open(page);
  const saved = await page.evaluate(() => localStorage.getItem('gymLogs'));
  await tab(page, 'stats');
  await expect(page.locator('.strength-hero h2')).toContainText('Silver 4');
  await page.locator('[data-stats-tab=analytics]').click();
  await page.locator('#strengthExerciseResults [data-strength-lift="Single-Arm Plate-Loaded Pulldown"]').click();
  const detail = page.locator('.strength-detail');
  await expect(detail.locator('.lift-rank-heading')).toContainText('ESTIMATED STRENGTH');
  await expect(detail.locator('.lift-rank-heading h3')).toHaveText('Platinum 4');
  await expect(detail).toContainText(/confirmed.*Silver 4/i);
  await expect(detail).toContainText('Load used for LP is 80 kg');
  await expect(detail).toContainText('2 one-sided sets');
  expect(await page.evaluate(() => localStorage.getItem('gymLogs'))).toBe(saved);
});
