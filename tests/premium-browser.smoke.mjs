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
const site={id:true,brand_name:'Danqel Social Boost',hero_title:'Good connections. Greater reach.',hero_description:'Meet your community.',enabled_platforms:['whatsapp','instagram','snapchat','tiktok','facebook','x'],maintenance_mode:false,support_email:null}
const overview={profile,balance:{balance:180,current_streak:2,referral_code:'DQ-TESTMEMBER',last_checkin:null},social_count:1,profile_views:3,referral_count:0,referral_earnings:0,referral_percent:0,referred_by:null,active_boost:null,recent_activity:[],unread_notifications:0,pending_orders:0,restricted:false,role:'super_admin'}
let roleMode='admin',signInRejected=false,managedRows=[],managedError=false
const singleRequests=[];const bulkRequests=[];let failBulkOnce=true
const testUser={id:userId,email:'member@example.org',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}
const exp=Math.floor(Date.now()/1000)+3600,jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:userId,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.testsignature'
const testSession={access_token:jwt,refresh_token:'test-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user:testUser}
const exceptions=[]
let savedConnection=true,notificationRead=false
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

 if(table==='token'){
  await route.fulfill({status:signInRejected?400:200,contentType:'application/json',body:JSON.stringify(signInRejected?{code:'invalid_credentials',error_code:'invalid_credentials',msg:'PRIVATE_INTERNAL_SENTINEL'}:testSession)});return
 }
 if(table==='user')json=testUser
 if(table==='admin_role'&&roleMode==='error'){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_INTERNAL_SENTINEL'})});return}
 if(table==='admin_role'&&roleMode==='timeout'){await new Promise(r=>setTimeout(r,13000));try{await route.fulfill({status:200,contentType:'application/json',body:'null'})}catch{}return}

 if(table==='favourites'){if(route.request().method()==='DELETE'){savedConnection=false;json=[]}else json=savedConnection?[{profile_id:userId,profiles:profile}]:[]}
 if(table==='notifications'){if(route.request().method()==='PATCH'){notificationRead=true;json=[{id:'notice-1'}]}else json=[{id:'notice-1',title:'Account update',body:'Your profile settings were updated.',is_read:notificationRead,created_at:new Date().toISOString()}]}
 if(table==='site_settings')json=site
 if(table==='member_overview')json=overview
 if(table==='public_directory'||table==='member_referrals')json={rows:table==='public_directory'?[profile]:[],total:table==='public_directory'?1:0}
 if(table==='profiles')json=profile
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
const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>{exceptions.push(error.message);console.error('BROWSER ERROR',error.message)})
import {resources} from '../src/admin/resources.js'
const failures=[]
async function visit(path,width=390,height=844){
 await page.setViewportSize({width,height});await page.goto('http://localhost:5173'+path);await page.locator('h1').first().waitFor();await page.waitForFunction(()=>!document.querySelector('.route-state [role="status"]'));await page.evaluate(()=>document.fonts.ready);await page.locator('vite-error-overlay').waitFor({state:'detached'});await page.emulateMedia({reducedMotion:'reduce'});
 const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,items:[...document.querySelectorAll('main input:not([type=checkbox]):not([type=radio]),main textarea')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({font:parseFloat(getComputedStyle(e).fontSize),width:e.getBoundingClientRect().width}))}));if(result.overflow){failures.push(`${path} overflows at ${width}×${height}`);await page.screenshot({path:`/home/user/premium-overflow-${path.replace(/[^a-z0-9]/gi,'-')}-${width}.png`,fullPage:true})}
}
await visit('/',1440,1000);await page.screenshot({path:'/home/user/premium-home-desktop.png',fullPage:true});await visit('/',390);await page.screenshot({path:'/home/user/premium-home-mobile.png',fullPage:true});
const publicRoutes=['/','/discover','/profile/test_member','/login','/register','/forgot-password','/reset-password','/verify','/admin/login','/support','/privacy','/terms','/cookies','/delete-account','/not-a-page'];
for(const path of publicRoutes)for(const width of [320,1440])await visit(path,width,900)
await page.evaluate(session=>localStorage.setItem('sb-test-auth-token',JSON.stringify(session)),testSession)
const memberRoutes=['/dashboard','/discover','/connections','/wallet','/missions','/credits','/notifications','/leaderboard','/referrals','/boosts','/promotions','/subscriptions','/payments','/settings','/rewards','/profile/test_member']
for(const path of memberRoutes)for(const width of [320,1440])await visit(path,width,900)
await visit('/dashboard',390);await page.getByRole('button',{name:'Open navigation',exact:true}).click();const drawer=page.getByRole('dialog',{name:'Member navigation'});await drawer.waitFor();assert.equal(await drawer.evaluate(el=>el.contains(document.activeElement)),true);await page.keyboard.press('Shift+Tab');assert.equal(await drawer.evaluate(el=>el.contains(document.activeElement)),true);await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});await page.getByRole('button',{name:'Open navigation',exact:true}).waitFor();
await visit('/admin?view=overview',390);await page.getByRole('button',{name:'Toggle navigation'}).click();const staffDrawer=page.getByRole('dialog',{name:'Administrator navigation'});await staffDrawer.waitFor();assert.equal(await staffDrawer.evaluate(el=>el.contains(document.activeElement)),true);await page.keyboard.press('Escape');await staffDrawer.waitFor({state:'hidden'});
await visit('/connections');await page.getByRole('link',{name:'Test Member',exact:true}).waitFor();await page.getByRole('button',{name:'Unsave creator'}).click();await page.getByRole('heading',{name:'Your people are out there.'}).waitFor()
await visit('/notifications');await page.getByRole('button',{name:'Mark as read'}).click();await page.getByRole('button',{name:'Mark as read'}).waitFor({state:'detached'})
await visit('/wallet');assert.equal(await page.getByRole('heading',{name:'Transaction history'}).count(),1);assert.equal(await page.getByRole('heading',{name:'Buy points by bank transfer'}).count(),0)
await visit('/credits');assert.equal(await page.getByRole('heading',{name:'Buy points by bank transfer'}).count(),1);assert.equal(await page.getByRole('heading',{name:'Transaction history'}).count(),0)
await visit('/missions');assert.equal(await page.getByRole('button',{name:/Daily check-in/}).count(),1);assert.equal(await page.getByRole('heading',{name:'Buy points by bank transfer'}).count(),0)
await visit('/leaderboard');await page.getByRole('heading',{name:'Public rankings are not published.'}).waitFor()
for(const resource of ['overview',...resources.map(r=>r.key)])for(const width of [320,1440])await visit('/admin?view='+resource,width,900)
for(const [width,height] of [[360,780],[390,844],[844,390],[768,1024],[1024,768],[1440,1000]])for(const path of ['/dashboard','/settings','/credits','/admin?view=managed_profiles'])await visit(path,width,height)
await visit('/dashboard',1440,1000);await page.screenshot({path:'/home/user/premium-member-desktop.png',fullPage:true});await visit('/dashboard');await page.screenshot({path:'/home/user/premium-member-mobile.png',fullPage:true});await visit('/admin?view=overview',1440,1000);await page.screenshot({path:'/home/user/premium-admin-desktop.png',fullPage:true});await visit('/admin?view=managed_profiles');await page.screenshot({path:'/home/user/premium-admin-mobile.png',fullPage:true})
assert.deepEqual(exceptions,[]);assert.deepEqual(failures,[]);await browser.close();console.log('Premium browser fixtures passed: public/member/all 23 admin resources at 320 and 1440; core flows at 360/390/844 landscape/768 tablet/1024/1440, reduced motion, mobile drawer focus containment/Escape, no page overflow, saved connection removal, notification read, distinct wallet/missions/credits compositions and honest unpublished leaderboard. Not a real authentication/payment or physical-device test.')
