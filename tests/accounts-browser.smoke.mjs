import {PLATFORMS,PLATFORM_HOSTS} from '../src/lib/validation.js'
// Optional browser smoke test with explicit network fixtures, never production data.
// npm install --no-save --package-lock=false playwright @sparticuz/chromium
// Run a test-only Vite server with VITE_SUPABASE_URL=https://test.supabase.co
// and VITE_SUPABASE_ANON_KEY=test-key, then: node tests/member-browser.smoke.mjs
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000}})
const userId='b0000000-0000-0000-0000-000000000001',planId='c0000000-0000-0000-0000-000000000001'
const profile={id:userId,username:'test_member',display_name:'Test Member',bio:'Test profile',country:'NG',interests:['music'],is_public:true,avatar_url:null}
const site={id:true,brand_name:'Danqel Social Boost',hero_title:'Good connections. Greater reach.',hero_description:'Meet your community.',enabled_platforms:['whatsapp','instagram','snapchat','tiktok','facebook','x','youtube','telegram'],maintenance_mode:false,support_email:null}
const overview={profile,balance:{balance:180,current_streak:2,referral_code:'DQ-TESTMEMBER',last_checkin:null},social_count:1,profile_views:3,referral_count:0,referral_earnings:0,referral_percent:0,referred_by:null,active_boost:null,recent_activity:[],unread_notifications:0,pending_orders:0,restricted:false,role:'super_admin'}
let roleMode='admin',signInRejected=false,managedRows=[],managedError=false
const singleRequests=[];const bulkRequests=[];let failBulkOnce=true
const testUser={id:userId,email:'member@example.org',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}
const exp=Math.floor(Date.now()/1000)+3600,jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:userId,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.testsignature'
const testSession={access_token:jwt,refresh_token:'test-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user:testUser}
let confirmed=false;const signups=[],profileWrites=[],socialWrites=[],recoveryRequests=[],passwordUpdates=[],customWrites=[];let socialRows=[],catalogue=[];
const exceptions=[]
await context.route('https://test.supabase.co/**',async route=>{
 const url=new URL(route.request().url()),table=url.pathname.split('/').at(-1)
 let json=[]
 if(table==='admin_save_managed_profile'){const body=route.request().postDataJSON();singleRequests.push(body);managedRows.push({...body.p_data,id:body.p_id});json=body.p_id}
 if(url.pathname.startsWith('/storage/v1/object/public/managed-avatars/')){await route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=','base64')});return}
 if(url.pathname.startsWith('/storage/v1/object/managed-avatars/'))json={Key:url.pathname}
 if(table==='admin_bulk_create_managed_profiles'){
  const body=route.request().postDataJSON();bulkRequests.push(body)
  managedRows=body.p_rows.map((r,i)=>({...r,id:'fixture-listing-'+i,created_at:new Date().toISOString()}))
  json={count:body.p_rows.length,ids:managedRows.map(r=>r.id),batch_id:body.p_batch}
  if(failBulkOnce){failBulkOnce=false;await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_INTERNAL_SENTINEL'})});return}
 }

 if(table==='social_platforms')json=catalogue
 if(table==='admin_save_social_platform'){const b=route.request().postDataJSON();customWrites.push(b);catalogue=[...PLATFORMS.map(key=>({key,label:key,hosts:PLATFORM_HOSTS[key]||['wa.me']})),{key:b.p_key,label:b.p_label,hosts:b.p_hosts}];site.enabled_platforms.push(b.p_key);json=null}
 if(table==='is_username_available')json=route.request().postDataJSON().p_username!=='already_taken'
 if(table==='signup'){signups.push(route.request().postDataJSON());await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...testUser,email_confirmed_at:null})});return}
 if(table==='recover'||table==='resend'){recoveryRequests.push({type:table,body:route.request().postDataJSON()});json={}}
 if(table==='user'){if(route.request().method()==='PUT'){passwordUpdates.push(route.request().postDataJSON());json=testUser}else json={...testUser,email_confirmed_at:confirmed?testUser.email_confirmed_at:null}}
 if(table==='social_links'){if(route.request().method()==='POST'){const b=route.request().postDataJSON();socialWrites.push(b);const row={...b,id:'social-'+b.platform};socialRows=[...socialRows.filter(l=>l.platform!==b.platform),row];json=row}else if(route.request().method()==='DELETE'){socialRows=[];json=[{id:'social-youtube'}]}else json=socialRows}
 if(url.pathname.startsWith('/storage/v1/object/avatars/'))json={Key:url.pathname}
 if(url.pathname.startsWith('/storage/v1/object/public/avatars/')){await route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=','base64')});return}
 if(table==='token'&&!confirmed){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'email_not_confirmed',error_code:'email_not_confirmed',msg:'Email not confirmed'})});return}
 if(table==='token'){
  await route.fulfill({status:signInRejected?400:200,contentType:'application/json',body:JSON.stringify(signInRejected?{code:'invalid_credentials',error_code:'invalid_credentials',msg:'PRIVATE_INTERNAL_SENTINEL'}:testSession)});return
 }

 if(table==='admin_role'&&roleMode==='error'){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_INTERNAL_SENTINEL'})});return}
 if(table==='admin_role'&&roleMode==='timeout'){await new Promise(r=>setTimeout(r,13000));try{await route.fulfill({status:200,contentType:'application/json',body:'null'})}catch{}return}

 if(table==='site_settings')json=site
 if(table==='member_overview')json=overview
 if(table==='public_directory'||table==='member_referrals')json={rows:[],total:0}
 if(table==='profiles'){if(route.request().method()==='PATCH'){const b=route.request().postDataJSON();if(b.username==='already_taken'){await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'23505',message:'PRIVATE_INTERNAL_SENTINEL'})});return}profileWrites.push(b);Object.assign(profile,b);json=[{id:userId}]}else json=profile}
 if(table==='admin_role')json=roleMode==='ordinary'?'user':'super_admin'
 if(table==='admin_overview')json={profiles:0,social_links:0,open_reports:0,revenue_kobo:0,bank_revenue_kobo:0,pending_bank_orders:0,pending_payments:0,trend:[]}
 if(table==='boost_plans')json=[{id:planId,title:'Test booster',multiplier:2,cost_points:50,duration_hours:24,bonus_cap:100,is_active:true}]
 if(table==='admin_list'){
  const resource=route.request().postDataJSON().p_resource
  if(resource==='managed_profiles'){if(managedError){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_INTERNAL_SENTINEL'})});return}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rows:managedRows,total:managedRows.length})});return}
  json={rows:resource==='site_settings'?[site]:resource==='boost_plans'?[{id:planId,title:'Test booster',multiplier:2,cost_points:50,duration_hours:24,bonus_cap:100,is_active:true}]:[],total:resource==='site_settings'||resource==='boost_plans'?1:0}
 }
 if(table==='activate_point_boost')json=planId
 if(table==='claim_daily_checkin')json='Check-in complete: +10 pts'
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':'*/0'},body:JSON.stringify(json)})
})
async function assertBrand(){
 await page.waitForFunction(()=>document.querySelectorAll('.danqel-brand img').length>=2&&[...document.querySelectorAll('.danqel-brand img')].every(i=>i.complete&&i.naturalWidth>0))
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.danqel-brand')].every(e=>e.getAttribute('aria-label')==='Danqel Social Boost')),true)
}
const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>{exceptions.push(error.message);console.error('BROWSER ERROR',error.message)})
await page.goto('http://localhost:5173/register');await page.getByLabel('Full name',{exact:true}).fill('Jane Creator');await page.getByLabel('Username',{exact:true}).fill('already_taken');await page.getByLabel('Email address',{exact:true}).fill('jane@example.org');await page.getByLabel('Create a password',{exact:true}).fill('test-only-password');await page.getByLabel('Confirm password',{exact:true}).fill('different-password');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create my account'}).click();await page.getByRole('alert').filter({hasText:'The passwords do not match.'}).waitFor();assert.equal(signups.length,0)
await page.getByLabel('Confirm password',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Create my account'}).click();await page.getByRole('alert').filter({hasText:'That username is already taken.'}).waitFor();assert.equal(signups.length,0)
await page.getByLabel('Username',{exact:true}).fill('Jane_Creator');await page.getByRole('button',{name:'Create my account'}).click();await page.getByRole('status').filter({hasText:'Check your email'}).waitFor();assert.equal(signups.length,1);assert.equal(signups[0].data.username,'jane_creator');assert.equal(signups[0].data.full_name,'Jane Creator');assert.equal(signups[0].data.terms_accepted,true);assert.equal(signups[0].data.role,undefined)
await page.goto('http://localhost:5173/login');await page.getByLabel('Email address',{exact:true}).fill('jane@example.org');await page.getByLabel('Password',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('link',{name:'Resend your verification email'}).click();await page.getByRole('heading',{name:'Check your inbox.'}).waitFor();await page.getByLabel('Email address',{exact:true}).fill('jane@example.org');await page.getByRole('button',{name:'Resend verification email'}).click();await page.getByRole('status').filter({hasText:'a new link will be sent'}).waitFor();assert.equal(recoveryRequests.at(-1).type,'resend')
await page.goto('http://localhost:5173/verify?success=true');await page.getByRole('heading',{name:'Check your inbox.'}).waitFor();assert.equal(await page.getByRole('heading',{name:'You’re verified.'}).count(),0)
confirmed=true;await page.goto('http://localhost:5173/login');await page.getByLabel('Email address',{exact:true}).fill('member@example.org');await page.getByLabel('Password',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:/Hey, Test Member/}).waitFor();await page.reload();await page.getByRole('heading',{name:/Hey, Test Member/}).waitFor()
await page.goto('http://localhost:5173/verify');await page.getByRole('heading',{name:'You’re verified.'}).waitFor();await page.getByRole('link',{name:'Continue to my account'}).click();await page.goto('http://localhost:5173/settings');await page.getByLabel('Display name',{exact:true}).fill('Jane Updated');await page.getByLabel('Username',{exact:true}).fill('already_taken');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('alert').filter({hasText:'That username is already taken.'}).waitFor();assert.equal(await page.getByText('PRIVATE_INTERNAL_SENTINEL').count(),0)
await page.getByLabel('Username',{exact:true}).fill('jane_creator');await page.getByLabel('Bio',{exact:true}).fill('A real creator story.');await page.getByLabel('Country',{exact:true}).fill('NG');await page.getByLabel('Location (optional)',{exact:true}).fill('Lagos');await page.getByLabel('Categories (comma separated)',{exact:true}).fill('music, education');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('status').filter({hasText:'Your profile has been updated.'}).waitFor();assert.equal(profileWrites.at(-1).location,'Lagos');assert.deepEqual(profileWrites.at(-1).categories,['music','education']);for(const key of ['balance','creator_xp','creator_level','created_at','is_sponsored','role'])assert.equal(key in profileWrites.at(-1),false)
await page.getByLabel('Upload your picture').setInputFiles('public/icons/icon-192.png');await page.getByRole('status').filter({hasText:'Profile picture saved.'}).waitFor();assert.match(profile.avatar_url,/avatars\//)
await page.getByRole('button',{name:'YouTube',exact:true}).click();await page.getByLabel('YouTube profile URL',{exact:true}).fill('https://youtube.com.evil.org/@jane');await page.getByRole('button',{name:'Save social link',exact:true}).click();await page.getByRole('alert').filter({hasText:'Use a valid official YouTube'}).waitFor();assert.equal(socialWrites.length,0)
await page.getByLabel('YouTube profile URL',{exact:true}).fill('https://youtube.com/@jane');await page.getByRole('button',{name:'Save social link',exact:true}).click();await page.getByRole('status').filter({hasText:'Social link saved.'}).waitFor();assert.equal(socialWrites.at(-1).is_public,false);await page.getByLabel('Make this link public').check();await page.getByRole('button',{name:'Save social link',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.account-links')?.textContent.includes('Public link'));assert.equal(socialWrites.at(-1).is_public,true)
await page.getByRole('button',{name:'Remove YouTube',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(socialRows.length,1);await page.getByRole('button',{name:'Remove YouTube',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm removal'}).click();await page.getByRole('status').filter({hasText:'Social link removed.'}).waitFor();assert.equal(socialRows.length,0)
await page.goto('http://localhost:5173/admin?view=site_settings');await page.getByLabel('Platform key',{exact:true}).fill('video_hub');await page.getByLabel('Platform name',{exact:true}).fill('Video Hub');await page.getByLabel('Allowed hosts (comma separated)',{exact:true}).fill('example.org');await page.locator('.account-platform-settings').getByLabel('Reason',{exact:true}).fill('Enable a custom creator destination');await page.getByRole('button',{name:'Save platform configuration'}).click();await page.getByRole('status').filter({hasText:'Platform configuration saved'}).waitFor();assert.equal(customWrites.at(-1).p_key,'video_hub');assert.deepEqual(customWrites.at(-1).p_hosts,['example.org']);await page.getByLabel('Edit a custom platform').selectOption('video_hub');assert.equal(await page.getByLabel('Platform name',{exact:true}).inputValue(),'Video Hub');
await page.goto('http://localhost:5173/forgot-password');await page.getByLabel('Email address',{exact:true}).fill('member@example.org');await page.locator('form button[type=submit],form button.design-button').click();await page.getByRole('status').waitFor();assert.equal(recoveryRequests.at(-1).type,'recover')
await page.goto('http://localhost:5173/reset-password');await page.getByLabel('New password',{exact:true}).fill('updated-test-password');await page.getByLabel('Confirm new password',{exact:true}).fill('updated-test-password');await page.getByRole('button',{name:'Update password',exact:true}).click();await page.getByRole('status').filter({hasText:'Your password has been updated.'}).waitFor();assert.equal(passwordUpdates.at(-1).password,'updated-test-password')
for(const path of ['/settings','/admin?view=site_settings'])for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){await page.setViewportSize({width,height});await page.goto('http://localhost:5173'+path);await page.locator('h1').waitFor();await page.locator(path==='/settings'?'.account-progress':'.account-platform-settings').waitFor();await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${path} ${width} overflow`)}
await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:5173/settings');await page.locator('.account-progress').waitFor();await page.screenshot({path:'/home/user/accounts-settings-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
await page.goto('http://localhost:5173/dashboard');await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('heading',{name:'Your people await.'}).waitFor();await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('sb-test-auth-token')),null);await page.goto('http://localhost:5173/reset-password');await page.getByText('No valid reset session.').waitFor()
for(const route of ['/register','/login','/verify','/forgot-password','/reset-password'])for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){await page.setViewportSize({width,height});await page.goto('http://localhost:5173'+route);await page.locator('h1').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} ${width} overflow`)}
assert.deepEqual(exceptions,[]);await browser.close();console.log('Account browser fixtures passed: complete registration/confirmation/consent metadata, password mismatch and duplicate username, email-verification reminder/resend/anti-spoofing, mocked verified login/session reload/logout, profile edit/duplicate/portrait, YouTube validation and private/public/edit/removal confirmation, custom platform audited RPC configuration, recovery request/password update/no-session denial, auth/profile/platform-configuration responsive layouts. Not a real Supabase login or delivered email test.')
