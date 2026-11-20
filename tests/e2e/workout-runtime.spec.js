import { test, expect, open, sheetAction } from './helpers.js';

test.beforeEach(async ({page}) => {
  await page.route('**/cloud-config.js', route => route.fulfill({contentType:'text/javascript', body:'window.GYM_CLOUD_CONFIG={};'}));
  await page.addInitScript(() => {
    localStorage.setItem('gymCustomWorkouts', JSON.stringify({Push:['Leg Press','Leg Extension','Preacher Curl'].map(name => ({name,sets:1}))}));
  });
  await open(page);
});

async function openPush(page) {
  await page.evaluate(async () => {
    const {openSession} = await import('/js/ui/session.js');
    openSession('Push');
  });
}

test('workout wake lock belongs to the open session when requests finish out of order', async ({page}) => {
  await page.evaluate(() => {
    window.screenRequests = [];
    Object.defineProperty(navigator, 'wakeLock', {configurable:true, value:{
      request: () => new Promise(resolve => {
        const lock = new EventTarget();
        lock.released = false;
        lock.release = async () => { lock.released = true; lock.dispatchEvent(new Event('release')); };
        window.screenRequests.push({lock, grant:() => resolve(lock)});
      }),
    }});
  });
  await openPush(page);
  await page.locator('#sessionMain').click();
  await sheetAction(page,'Start workout');
  await expect.poll(() => page.evaluate(() => window.screenRequests.length)).toBe(1);
  await page.goBack();
  await expect(page.locator('#session')).toBeHidden();
  await openPush(page);
  await expect.poll(() => page.evaluate(() => window.screenRequests.length)).toBe(2);
  await page.evaluate(async () => {
    window.screenRequests[1].grant();
    await Promise.resolve();
    window.screenRequests[0].grant();
  });
  await expect.poll(() => page.evaluate(() => window.screenRequests.map(({lock}) => lock.released))).toEqual([true,false]);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(await page.evaluate(() => window.screenRequests.length)).toBe(2);
  await page.goBack();
  await expect.poll(() => page.evaluate(() => window.screenRequests[1].lock.released)).toBe(true);
});

test('timer ticks reuse next exercise progress and undoing a set restores it', async ({page}) => {
  await openPush(page);
  await page.locator('#sessionMain').click();
  await sheetAction(page,'Start workout');
  const cards = page.locator('#sessionList .ex-card');
  await cards.nth(1).locator('.r').first().fill('8');
  await cards.nth(1).locator('.d').first().check();
  await cards.first().locator('.r').first().focus();
  const next = () => page.evaluate(() => JSON.parse(localStorage.getItem('gymActive')).status.nextExercise);
  await expect.poll(next).toBe('Preacher Curl');
  await page.evaluate(() => {
    const list = document.getElementById('sessionList');
    const query = list.querySelectorAll.bind(list);
    window.timerQueries = [];
    list.querySelectorAll = selector => { window.timerQueries.push(selector); return query(selector); };
  });
  const clock = page.locator('#sessionClock');
  await expect(clock).not.toHaveText(await clock.textContent(), {timeout:3000});
  expect(await page.evaluate(() => window.timerQueries)).toEqual([]);
  await cards.last().evaluate(card => {
    const query = card.querySelectorAll.bind(card);
    window.untouchedRowReads = 0;
    card.querySelectorAll = selector => {
      if (selector.includes('tbody tr')) window.untouchedRowReads++;
      return query(selector);
    };
  });
  await cards.nth(1).locator('.d').first().uncheck();
  expect(await page.evaluate(() => window.untouchedRowReads)).toBe(0);
  await cards.first().locator('.r').first().focus();
  await expect.poll(next).toBe('Leg Extension');
});
