import { test, expect, open, tab } from './helpers.js';

async function swipePanel(page, selector, dx, dy = 0) {
  await expect(page.locator('.tab-slide-stage')).toHaveCount(0);
  const box = await page.locator(selector).boundingBox();
  const x = box.x + box.width / 2, y = box.y + 15;
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x,y}]});
    await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:x+dx,y:y+dy}]});
    await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  } finally { await cdp.detach(); }
}

test('the row rank sheet floats clear of the phone edges and identifies the scoring set', async ({page}) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={};',
  }));
  await page.setViewportSize({width:360, height:640});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(() => {
    const name = 'Single-Arm Plate-Loaded Row';
    const set = reps => ({w:'40', r:String(reps), done:true});
    localStorage.setItem('gymCustomWorkouts', JSON.stringify({Pull:[{name,sets:4,unilateral:true,target:'8'}]}));
    localStorage.setItem('gymPlanSchedule', JSON.stringify({0:'Pull'}));
    localStorage.setItem('gymLogs', JSON.stringify({'2026-01-02':[{day:'Pull',exercises:[{name,sets:[set(8),set(8),set(7),set(7)]}]}]}));
    localStorage.setItem('bodyWeightLogs', JSON.stringify([{date:'2026-01-01',weight:70.5}]));
  });
  await open(page);
  await tab(page, 'stats');
  await page.locator('[data-stats-tab=analytics]').click();
  const rail = page.getByRole('tablist', {name:'Stats sections'});
  const active = rail.getByRole('tab', {selected:true});
  await expect(active).toHaveCSS('border-radius', await rail.evaluate(el => getComputedStyle(el).borderRadius));
  await page.locator('#strengthExerciseResults [data-strength-lift]').click();
  const sheet = page.getByRole('dialog', {name:'Single-Arm Plate-Loaded Row'});
  await expect(sheet.locator('.lift-rank-heading')).toContainText('Gold 1');
  await expect(sheet.locator('.lift-rank-heading b')).toHaveText('20 LP');
  await expect(sheet.locator('.scoring-set')).toContainText('40 kg per side × 8');
  await sheet.locator('.rank-formula summary').click();
  await expect(sheet.locator('.rank-formula b')).toHaveText('380');
  await expect(sheet.locator('.rank-formula')).toContainText('80 kg for everyone');
  for (const width of [320, 390, 800]) {
    await page.setViewportSize({width, height:640});
    const box = await sheet.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(12);
    expect(width - (box.x + box.width)).toBeGreaterThanOrEqual(12);
    expect(640 - (box.y + box.height)).toBeGreaterThanOrEqual(12);
    expect(await sheet.evaluate(el => {
      const style = getComputedStyle(el);
      return parseFloat(style.borderBottomLeftRadius) >= 20 && el.scrollWidth <= el.clientWidth;
    })).toBe(true);
    await expect(sheet.getByRole('button', {name:'Done'})).toBeInViewport();
  }
  await sheet.getByRole('button', {name:'Done'}).click();
});

test('floating glass navigation previews and saves its opacity and solid option', async ({page}) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={};',
  }));
  await open(page);
  const nav = page.locator('#bottomNav');
  await expect(nav).toHaveCSS('backdrop-filter','blur(18px) saturate(1.25)');
  await expect(nav).toHaveCSS('background-color',/0\.91/);
  const openNavigationSettings = async () => {
    await page.locator('.page.active [data-open-settings]').click();
    await page.locator('[data-color-group="Bottom navigation"] summary').click();
  };
  await openNavigationSettings();
  const slider = page.getByRole('slider',{name:'Bottom navigation opacity'});
  const toggle = page.getByRole('checkbox',{name:'Glass effect'});
  await expect(slider).toHaveValue('91');
  await slider.press('ArrowLeft');
  await expect(slider).toHaveValue('90');
  await expect(page.locator('.preview-nav')).toHaveCSS('background-color',/0\.9\)/);
  await toggle.uncheck();
  await expect(slider).toBeDisabled();
  await expect(page.locator('.preview-nav')).toHaveCSS('backdrop-filter','none');
  await page.reload();
  await page.locator('#loadingScreen').waitFor({state:'detached'});
  await expect(nav).toHaveCSS('backdrop-filter','none');
  await openNavigationSettings();
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(slider).toHaveValue('90');
  await expect(nav).toHaveCSS('background-color',/0\.9\)/);
});

test('distant main tabs slide the actual intervening pages through the viewport', async ({page}) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={};',
  }));
  await open(page);
  const navBox = await page.locator('#bottomNav').boundingBox();
  const {width,height} = page.viewportSize();
  expect(navBox.x).toBeGreaterThan(0);
  expect(navBox.x + navBox.width).toBeLessThan(width);
  expect(navBox.y + navBox.height).toBeLessThan(height);
  await tab(page, 'plan');
  await expect(page.locator('.tab-slide-stage')).toHaveCount(0);
  const motion = await page.evaluate(async () => {
    const navigate = name => document.querySelector(`.nav-btn[data-page="${name}"]`).click();
    navigate('crew');
    const stage = document.querySelector('.tab-slide-stage');
    const strand = stage.firstElementChild;
    const animation = strand.getAnimations()[0];
    animation.pause();
    await animation.ready;
    const pageNames = [...stage.querySelectorAll('.page')].map(panel => panel.id);
    const namesAtCenter = [1, 2].map(index => {
      // Derive the exact time window during which the middle of each screen
      // crosses the center, without depending on the animation easing.
      const bounds = stage.getBoundingClientRect();
      const center = bounds.left + bounds.width / 2;
      for (let time = 0; time < animation.effect.getTiming().duration; time += 5) {
        animation.currentTime = time;
        const pages = [...strand.children];
        const rect = pages[index].getBoundingClientRect();
        if (rect.left < center && rect.right > center) return pages[index].querySelector('h1').textContent;
      }
      return null;
    });
    const inert = stage.inert && stage.getAttribute('aria-hidden') === 'true';
    const active = document.querySelector('.page.active').id;
    const opacity = getComputedStyle(document.getElementById(active)).opacity;
    navigate('plan');
    const reverse = [...document.querySelectorAll('.tab-slide-stage .page')].map(panel => panel.id);
    return {pageNames, namesAtCenter, active, opacity, inert, reverse};
  });
  expect(motion).toEqual({
    pageNames: ['page-plan','page-calendar','page-stats'], namesAtCenter: ['Calendar','Stats'],
    active: 'page-crew', opacity: '1', inert: true, reverse: ['page-crew','page-stats','page-calendar'],
  });
  await expect(page.locator('.tab-slide-stage')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'reduce'});
  await tab(page, 'crew');
  await expect(page.locator('.tab-slide-stage')).toHaveCount(0);
  await expect(page.locator('#page-crew')).toHaveCSS('transform', 'none');
});

test('Announcements slides sideways and stays animated when posts load', async ({page}) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};',
  }));
  await page.route('**/rest/v1/**', route => route.fulfill({json:[]}));
  await page.route('**/rest/v1/announcements*', route => route.fulfill({json:[{
    id:'1', title:'Gym hours', body:'Open all week', created_at:'2026-11-18T12:00:00Z',
  }]}));
  await open(page);
  await page.evaluate(async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const {account} = await import('/js/cloud/sync.js');
    const {supabase} = await import('/js/cloud/client.js');
    account.user = {id}; account.ready = true; account.profile = {username:'viewer'};
    supabase.auth.getSession = async () => ({data:{session:{user:{id},access_token:'mock'}}});
  });
  await tab(page, 'crew');
  await expect(page.locator('.tab-slide-stage')).toHaveCount(0);
  const transition = await page.evaluate(() => {
    document.getElementById('crew-tab-announcements').click();
    const panel = document.getElementById('crew-panel');
    const incoming = panel.getAnimations()[0];
    incoming.pause();
    incoming.currentTime = 70;
    const slide = document.querySelector('.tab-slide-stage > div').getAnimations()[0];
    slide.pause();
    slide.currentTime = 70;
    return {transform:getComputedStyle(panel).transform, opacity:getComputedStyle(panel).opacity,
      outgoing:!!document.querySelector('.tab-slide-stage [data-key="panel-ranking"]')};
  });
  expect(transition.opacity).toBe('1');
  expect(transition.transform).not.toBe('none');
  expect(transition.outgoing).toBe(true);
  await expect(page.getByText('Gym hours')).toBeAttached();
  await expect(page.locator('.tab-slide-stage [data-key="panel-ranking"]')).toHaveCount(1);
  const headingSizes = await page.evaluate(() => {
    const settled = getComputedStyle(document.querySelector('#crew-panel .announcement-post h2')).fontSize;
    document.getElementById('crew-tab-friends').click();
    return [settled, getComputedStyle(document.querySelector('.tab-slide-stage .announcement-post h2')).fontSize];
  });
  expect(headingSizes[1]).toBe(headingSizes[0]);
  await expect(page.locator('.tab-slide-stage')).toHaveCount(0);
  await expect(page.getByRole('tab', {name:'Friends', exact:true})).toHaveAttribute('aria-selected','true');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width,height:730});
    const tabs = await page.locator('#page-crew [role=tab]').evaluateAll(items =>
      items.map(el => ({width:el.offsetWidth, height:el.offsetHeight, fits:el.scrollWidth <= el.clientWidth})));
    expect(Math.max(...tabs.map(t=>t.width)) - Math.min(...tabs.map(t=>t.width))).toBeLessThanOrEqual(1);
    expect(tabs.every(t=>t.fits && t.height >= 44)).toBe(true);
  }
  await page.setViewportSize({width:390,height:730});
  await swipePanel(page, '#crew-panel', -50);
  await expect(page.getByRole('tab', {name:'Announcements'})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#page-crew')).toHaveClass(/active/);
});

test('a bodygraph tap settles the moving screen before scrolling to its rank card', async ({page}) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType: 'text/javascript', body: 'window.GYM_CLOUD_CONFIG={};',
  }));
  await page.setViewportSize({width:720,height:680});
  await open(page);
  await tab(page, 'stats');
  const result = await page.evaluate(async () => {
    document.getElementById('stats-tab-stats').click();
    const panel = document.getElementById('stats-panel');
    const animation = panel.getAnimations()[0];
    animation.pause();
    await animation.ready;
    animation.currentTime = 90;
    const before = getComputedStyle(panel).transform;
    const card = panel.querySelector('[data-rank-muscle=lats]');
    let whenScrolled;
    card.scrollIntoView = function (options) {
      whenScrolled = getComputedStyle(panel).transform;
      Element.prototype.scrollIntoView.call(this, options);
    };
    panel.querySelector('[data-muscle=lats]').dispatchEvent(new MouseEvent('click', {bubbles:true}));
    const box = card.getBoundingClientRect();
    return {before, whenScrolled, open:card.open, fits:box.left >= 0 && box.right <= innerWidth, stage:!!document.querySelector('.tab-slide-stage')};
  });
  expect(result.before).not.toBe('none');
  expect(result).toMatchObject({whenScrolled:'none', open:true, fits:true, stage:false});
});

test('rank dialogs open centered without moving Stats and dismiss on an outside click', async ({page}) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType:'text/javascript', body:'window.GYM_CLOUD_CONFIG={};',
  }));
  for (const width of [390, 1036]) {
    await page.setViewportSize({width,height:800});
    await open(page);
    await tab(page, 'stats');
    const hero = page.locator('.strength-hero');
    await expect.poll(() => page.locator('.tab-slide-stage').count()).toBe(0);
    const original = await hero.boundingBox();
    const trigger = hero.getByRole('button',{name:'Rank ladder'});
    await trigger.click();
    const dialog = page.getByRole('dialog',{name:'Rank ladder'});
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - 400)).toBeLessThan(2);
    expect(await hero.boundingBox()).toEqual(original);
    await page.mouse.click(4, 4);
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await hero.boundingBox()).toEqual(original);
  }
});


test('short swipes inside Stats switch its sections without switching main tabs', async ({page}) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType:'text/javascript', body:'window.GYM_CLOUD_CONFIG={};',
  }));
  await open(page);
  await tab(page, 'stats');
  await swipePanel(page, '#stats-panel', -50);
  await expect(page.getByRole('tab', {name:'Bodygraph'})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#page-stats')).toHaveClass(/active/);
  await swipePanel(page, '#stats-panel', 14, 62);
  await expect(page.getByRole('tab', {name:'Bodygraph'})).toHaveAttribute('aria-selected','true');
  await swipePanel(page, '#stats-panel', 50);
  await expect(page.getByRole('tab', {name:'Your rank'})).toHaveAttribute('aria-selected','true');
});

test('distant Stats tabs slide through the intermediate panels in both directions', async ({page}) => {
  await page.route('**/cloud-config.js', route => route.fulfill({
    contentType:'text/javascript', body:'window.GYM_CLOUD_CONFIG={};',
  }));
  await open(page);
  await tab(page, 'stats');
  await expect(page.locator('.tab-slide-stage')).toHaveCount(0);
  const motion = await page.evaluate(async () => {
    const select = id => document.getElementById('stats-tab-' + id).click();
    const selected = () => document.querySelector('.stats-tabs [aria-selected=true]').dataset.statsTab;
    const stagedPanels = () => [...document.querySelectorAll('.tab-slide-stage [data-stats-panel]')].map(el => el.dataset.statsPanel);
    select('progress');
    const stage = document.querySelector('.tab-slide-stage');
    const strip = stage.firstElementChild;
    const animation = strip.getAnimations()[0];
    animation.pause();
    await animation.ready;
    const center = stage.getBoundingClientRect().left + stage.clientWidth / 2;
    const panelsAtCenter = [1, 2].map(index => {
      const tile = strip.children[index];
      for (let time = 0; time < animation.effect.getTiming().duration; time += 5) {
        animation.currentTime = time;
        const rect = tile.getBoundingClientRect();
        if (rect.left < center && rect.right > center) return tile.querySelector('h2')?.textContent;
      }
      return null;
    });
    const forward = stagedPanels();
    const active = selected();
    const inert = stage.inert && stage.getAttribute('aria-hidden') === 'true';
    select('rank');
    return {forward, panelsAtCenter, active, inert, reverse:stagedPanels()};
  });
  expect(motion).toEqual({
    forward:['rank','stats','analytics'], panelsAtCenter:['Ranked bodygraph','Body weight'],
    active:'progress', inert:true, reverse:['progress','analytics','stats'],
  });
  await expect(page.locator('.tab-slide-stage')).toHaveCount(0);
  await expect(page.getByRole('tab', {name:'Your rank'})).toHaveAttribute('aria-selected','true');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('tab', {name:'Progress'}).click();
  await expect(page.locator('.tab-slide-stage')).toHaveCount(0);
  await expect(page.locator('#stats-panel')).toHaveCSS('transform','none');
});
