import {test,expect,open,tab,openAccountSettings,fillPrompt,sheetAction} from './helpers.js';

const owner='00000000-0000-4000-8000-000000000001';
test.beforeEach(async({page})=>{
  await page.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.GYM_CLOUD_CONFIG={url:location.origin,anonKey:"mock"};'}));
  await page.route('**/rest/v1/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
  await open(page);
  await page.evaluate(async id=>{
    const {account}=await import('/js/cloud/sync.js');
    account.user={id,email:'owner@example.test'};account.ready=true;account.profile={username:'gym_handle',display_name:'Gym Buddy'};
    const {supabase}=await import('/js/cloud/client.js');
    supabase.auth.getSession=async()=>({data:{session:{user:account.user,access_token:'test'}}});
    window.authUpdates=[];window.refuseEmail=false;
    supabase.auth.updateUser=async(attributes,options)=>{
      window.authUpdates.push({attributes,options});
      if(window.refuseEmail)return {error:{message:'Try again later.'}};
      return {data:{user:{...account.user,...(attributes.email?{new_email:attributes.email}:{})}}};
    };
  },owner);
  await tab(page,'crew');await page.locator('.page.active [data-open-settings]').click();
});

test('profile shows display name and handle; Account is a full screen with private email and a fixed password mask',async({page})=>{
  await expect(page.locator('[data-view-my-profile]')).toHaveText('Gym Buddy');
  await expect(page.locator('.account-name-copy>small')).toHaveText('@gym_handle');
  await expect(page.locator('#page-settings')).not.toContainText('owner@example.test');
  await expect(page.getByRole('button',{name:'Edit names',exact:true})).toBeVisible();
  await openAccountSettings(page);
  await expect(page.locator('[data-account-email]')).toHaveText('owner@example.test');
  await expect(page.getByLabel('Password hidden')).toHaveText('••••••••');
  await expect(page.locator('.sheet-backdrop.open')).toHaveCount(0);
  await expect(page.locator('#bottomNav')).toBeHidden();
  await expect(page.locator('[data-theme-set]')).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath('account-screen.png')});
  await page.goBack();await expect(page.locator('[data-account-settings]')).toBeVisible();await expect(page.locator('body')).not.toHaveClass(/account-settings-open/);
  await page.goBack();await expect(page.locator('#page-crew')).toHaveClass(/active/);await expect(page.locator('#bottomNav')).toBeVisible();
});

test('email change uses the signed-in account, keeps failed input and awaits inbox confirmation',async({page})=>{
  await openAccountSettings(page);await page.getByRole('button',{name:'Change email',exact:true}).click();
  await page.evaluate(()=>{window.refuseEmail=true;});await fillPrompt(page,'next@example.test');
  await expect(page.locator('.sheet-backdrop.open .form-error')).toHaveText('Try again later.');
  await expect(page.locator('.sheet-backdrop.open input[name=value]')).toHaveValue('next@example.test');
  await page.evaluate(()=>{window.refuseEmail=false;});await sheetAction(page,'Save');
  await expect(page.locator('.sheet-backdrop.open')).toHaveCount(0);
  await expect(page.locator('[data-account-email]')).toHaveText('owner@example.test');
  await expect(page.locator('[data-account-page]')).toContainText('Pending confirmation: next@example.test');
  const updates=await page.evaluate(()=>window.authUpdates);
  expect(updates.at(-1).attributes).toEqual({email:'next@example.test'});
  expect(updates.at(-1).options.emailRedirectTo).toBe('https://roguelineageaccmanager.github.io/gymapptest2/');
  await page.locator('[data-close-settings]').click();await expect(page.locator('[data-account-settings]')).toBeVisible();
});

test('password stays hidden, changes preserve spaces and account switches close personal screens and editors',async({page})=>{
  await openAccountSettings(page);await page.getByRole('button',{name:'Change password',exact:true}).click();
  await expect(page.locator('.sheet-backdrop.open input[name=value]')).toHaveAttribute('type','password');
  await fillPrompt(page,' new password 9 ');await expect(page.locator('.sheet-backdrop.open')).toHaveCount(0);
  expect((await page.evaluate(()=>window.authUpdates)).at(-1).attributes).toEqual({password:' new password 9 '});
  await expect(page.getByLabel('Password hidden')).toHaveText('••••••••');
  await page.getByRole('button',{name:'Change email',exact:true}).click();
  await page.evaluate(async()=>{const {account}=await import('/js/cloud/sync.js');account.user={id:'00000000-0000-4000-8000-000000000002',email:'next-user@example.test'};account.profile={username:'next_user'};window.dispatchEvent(new CustomEvent('gym:account'));});
  await expect(page.locator('.sheet-backdrop.open')).toHaveCount(0);await expect(page.locator('[data-account-page]')).toHaveCount(0);
  await expect(page.locator('#page-settings')).not.toContainText('owner@example.test');await expect(page.locator('[data-view-my-profile]')).toHaveText('next_user');
  await expect(page.locator('body')).not.toHaveClass(/account-settings-open/);
  expect((await page.evaluate(()=>window.authUpdates)).length).toBe(1);
});

test('pencil offers both names, closes on account change and narrow Account view remains within the screen',async({page})=>{
  await page.getByRole('button',{name:'Edit names',exact:true}).click();
  await expect(page.locator('[data-change-display-name]')).toContainText('Gym Buddy');await expect(page.locator('[data-change-username]')).toContainText('@gym_handle');
  await page.locator('[data-change-username]').click();await expect(page.locator('.sheet-backdrop.open input[name=value]')).toHaveValue('gym_handle');
  await sheetAction(page,'Cancel');await page.getByRole('button',{name:'Edit names',exact:true}).click();await page.locator('[data-change-display-name]').click();
  await expect(page.locator('.sheet-backdrop.open input[name=value]')).toHaveValue('Gym Buddy');await sheetAction(page,'Cancel');
  await page.setViewportSize({width:320,height:640});await openAccountSettings(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('account-narrow.png')});
  await page.getByRole('button',{name:'Edit names',exact:true}).click();
  await page.evaluate(async()=>{(await import('/js/cloud/sync.js')).account.user=null;window.dispatchEvent(new CustomEvent('gym:account'));});
  await expect(page.locator('.sheet-backdrop.open')).toHaveCount(0);await expect(page.locator('#authForm')).toBeVisible();
});
