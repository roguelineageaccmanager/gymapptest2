import { test, expect, _android as android } from '@playwright/test';

const PKG = 'com.roguelineage.rattracker';
test('ongoing workout notification survives backgrounding and stops on cancel', async () => {
  const [device] = await android.devices();
  if (!device) throw new Error('No Android device connected');
  try {
    await device.shell(`am force-stop ${PKG}`);
    await device.shell(`pm clear ${PKG}`);
    await device.shell(`pm grant ${PKG} android.permission.POST_NOTIFICATIONS`);
    await device.shell(`am start -W -n ${PKG}/.MainActivity`);
    const webview = await device.webView({ pkg: PKG }, { timeout: 60000 });
    const page = await webview.page();
    await expect(page.locator('#page-today h1')).toHaveText('Today', { timeout: 30000 });
    await page.locator('#loadingScreen').waitFor({ state: 'detached' });
    await page.evaluate(async () => {
      const { state, savePlan } = await import('/js/state.js');
      state.workouts.Push = [{ name: 'Dips', cat: 'chest', sets: 3, target: '8', rest: 60 }];
      savePlan();
      const { openSession } = await import('/js/ui/session.js'); openSession('Push');
    });
    const services = async () => String(await device.shell(`dumpsys activity services ${PKG}`));
    expect(await services()).not.toContain('WorkoutStatusService');
    await page.locator('#sessionMain').click();
    await page.locator('.sheet').getByRole('button', { name: 'Start workout', exact: true }).click();
    await expect.poll(services).toContain('WorkoutStatusService');
    await page.locator('.ex-card .d').first().check();
    await expect(page.locator('#restBar')).toBeVisible();
    await page.locator('#sessionBack').click();
    // Give the real native service a short deadline without waiting a full rest.
    await page.evaluate(async () => {
      const { getActive } = await import('/js/ui/session.js');
      const a = getActive();
      await window.Capacitor.Plugins.WorkoutStatus.update({ ...a.status, startedAt: a.startedAt, title: a.day,
        restUntil: Date.now() + 2500, restEnabled: true, restSound: 'chime', restVibration: false,
        nextWorkout: 'Pull', nextExercise: 'Rows' });
    });
    await device.shell('input keyevent KEYCODE_HOME');
    await expect.poll(async () => String(await device.shell('dumpsys notification --noredact'))).toContain('Push');
    await expect.poll(services).toContain('WorkoutStatusService');
    const notifications = async () => String(await device.shell('dumpsys notification --noredact'));
    await expect.poll(notifications, { timeout: 15000 }).toContain('Rest ready');
    await expect.poll(notifications).toContain('rest_ready_v1_chime_quiet');
    await expect.poll(notifications).toContain('Next workout · Pull');
    await device.shell('cmd statusbar expand-notifications');
    await test.info().attach('Ouroboros notification icon',{body:await device.screenshot(),contentType:'image/png'});
    await device.shell('cmd statusbar collapse');
    // Exercise the same intent sent by the notification's content PendingIntent.
    await device.shell(`am start -W -n ${PKG}/.MainActivity --ez openWorkout true`);
    await expect(page.locator('#session')).toBeVisible();
    await expect(page.locator('.ex-card .d').first()).toBeChecked();
    await page.locator('#sessionCancel').click();
    await page.locator('.sheet').getByRole('button', { name: 'Cancel workout', exact: true }).click();
    await expect.poll(services).not.toContain('WorkoutStatusService');
  } finally { await device.close(); }
});
