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
const bulkRequests=[];let failBulkOnce=true
const testUser={id:userId,email:'member@example.org',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}
const exp=Math.floor(Date.now()/1000)+3600,jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:userId,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.testsignature'
const testSession={access_token:jwt,refresh_token:'test-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user:testUser}
const exceptions=[]
await context.route('https://test.supabase.co/**',async route=>{
 const url=new URL(route.request().url()),table=url.pathname.split('/').at(-1)
 let json=[]
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

 if(table==='site_settings')json=site
 if(table==='member_overview')json=overview
 if(table==='public_directory'||table==='member_referrals')json={rows:[],total:0}
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
const page=await context.newPage();page.on('pageerror',error=>exceptions.push(error.message))
await page.goto('http://localhost:5173/')
await page.getByRole('heading',{name:/Good connections/}).waitFor()
await page.screenshot({path:'/home/user/redesign-landing-desktop.png',fullPage:true})
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/home/user/redesign-landing-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);await page.setViewportSize({width:1440,height:1000})
assert.equal(await page.getByText('Amara Okafor').count(),0)
assert.equal(await page.getByText('Live — connected').count(),0)
await page.evaluate(({userId})=>{
 const payload={sub:userId,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600}
 const jwt=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify(payload))+'.testsignature'
 localStorage.setItem('sb-test-auth-token',JSON.stringify({access_token:jwt,refresh_token:'test-refresh',expires_at:payload.exp,expires_in:3600,token_type:'bearer',user:{id:userId,email:'member@example.org',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}}))
},{userId})
await page.goto('http://localhost:5173/dashboard')
await page.getByRole('heading',{name:/Hey, Test Member/}).waitFor()
await page.screenshot({path:'/home/user/member-desktop-test.png',fullPage:true})
await page.goto('http://localhost:5173/referrals')
await page.getByRole('heading',{name:'Grow together.'}).waitFor()
await page.getByLabel('Your referral link').waitFor()
await page.waitForFunction(()=>document.querySelector('input[aria-label="Your referral link"]')?.value.includes('DQ-TESTMEMBER'));assert.match(await page.getByLabel('Your referral link').inputValue(),/register\?ref=DQ-TESTMEMBER/)
await page.goto('http://localhost:5173/boosts')
await page.getByRole('button',{name:'Select this plan'}).click()
const modal=page.getByRole('dialog');await modal.waitFor();assert.equal(await modal.getByRole('heading',{name:'Activate Test booster?'}).count(),1)
await modal.getByRole('button',{name:'Cancel',exact:true}).click();await modal.waitFor({state:'detached'})
await page.goto('http://localhost:5173/discover');await page.getByRole('heading',{name:'Explore the community.'}).waitFor();await page.getByRole('button',{name:'Instagram',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Instagram',exact:true}).getAttribute('aria-pressed'),'true')
await page.goto('http://localhost:5173/settings');await page.getByRole('heading',{name:'Make it yours.'}).waitFor();await page.getByLabel('Display name',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('input[pattern="[a-z0-9_]{3,24}"]')?.value==='test_member');assert.equal(await page.getByLabel('Display name',{exact:true}).inputValue(),'Test Member')
await page.goto('http://localhost:5173/rewards');await page.getByRole('heading',{name:'Points & wallet.'}).waitFor();await page.getByRole('heading',{name:'Buy points by bank transfer'}).waitFor()
await page.goto('http://localhost:5173/admin?view=boost_plans');await page.getByRole('button',{name:'+ Create booster'}).click();await page.getByRole('dialog').getByRole('heading',{name:'Create booster plan'}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click()
await page.goto('http://localhost:5173/admin?view=site_settings');await page.getByRole('button',{name:'Inspect →'}).click();await page.getByRole('button',{name:'Edit site settings',exact:true}).click();await page.getByRole('dialog').getByRole('heading',{name:'Edit site settings'}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click()
await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:5173/dashboard');await page.getByRole('heading',{name:/Hey, Test Member/}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false)
await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('navigation',{name:'Member workspace'}).getByRole('link',{name:'Referrals',exact:true}).click();await page.getByRole('heading',{name:'Grow together.'}).waitFor()
await page.goto('http://localhost:5173/dashboard');await page.getByRole('heading',{name:/Hey, Test Member/}).waitFor();await page.screenshot({path:'/home/user/member-mobile-test.png',fullPage:true})
// New managed-profile studio: fixture-only create, photo upload, consent and error recovery.
await page.setViewportSize({width:1440,height:1000});await page.goto('http://localhost:5173/admin?view=managed_profiles')
await page.getByRole('button',{name:'Create multiple profiles',exact:true}).click()
const bulk=page.getByRole('dialog');await bulk.getByLabel('Display name for profile 1',{exact:true}).fill('Fixture Creator One');await bulk.getByLabel('Username for profile 1',{exact:true}).fill('fixture_one')
await bulk.getByLabel('Portrait for profile 1').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=','base64')})
await bulk.getByRole('img',{name:'Selected portrait'}).waitFor()
await bulk.getByRole('button',{name:/Add another profile/}).click();await bulk.getByLabel('Display name for profile 2',{exact:true}).fill('Fixture Creator Two');await bulk.getByLabel('Username for profile 2',{exact:true}).fill('fixture_two')
await bulk.getByLabel('Batch creation reason').fill('Owner permission for fixture-only testing')
await bulk.getByRole('button',{name:'Review 2 profiles',exact:true}).click();await bulk.getByRole('heading',{name:'Review your collection.'}).waitFor()
assert.equal(await bulk.getByRole('button',{name:'Create 2 profiles',exact:true}).isDisabled(),true)
await bulk.getByLabel('Confirm permission to publish').check()
await page.screenshot({path:'/home/user/bulk-profiles-desktop.png',fullPage:true})
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/home/user/bulk-profiles-mobile.png',fullPage:true})
await bulk.getByRole('button',{name:'Create 2 profiles',exact:true}).click();await bulk.getByRole('button',{name:'Retry same batch',exact:true}).click();await bulk.waitFor({state:'detached'});await page.getByRole('heading',{name:'Fixture Creator One',exact:true}).waitFor()
assert.equal(bulkRequests.length,2);assert.deepEqual(bulkRequests[0],bulkRequests[1]);assert.equal(bulkRequests[0].p_rows.length,2);assert.equal(bulkRequests[0].p_confirm,true);assert.equal(bulkRequests[0].p_rows[0].is_public,false)
assert.ok(bulkRequests[0].p_rows[0].avatar_url.includes('/managed-avatars/'))
managedError=true;await page.getByRole('button',{name:/Refresh/,exact:false}).click();await page.getByText('Records unavailable',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Fixture Creator One',exact:true}).count(),0);assert.equal(await page.getByText('PRIVATE_INTERNAL_SENTINEL').count(),0)
managedError=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('heading',{name:'Fixture Creator One',exact:true}).waitFor()
await page.screenshot({path:'/home/user/managed-profiles-mobile.png',fullPage:true})

// New commerce views read the signed-in account's records and render honest empty states.
for(const [path,title]of [['promotions','A little more visibility.'],['subscriptions','Your plans, in one place.'],['payments','Your payment history.']]){
 await page.goto('http://localhost:5173/'+path);await page.getByRole('heading',{name:title,exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false)
}
// Staff access behavior is mocked here; server permission enforcement is tested separately in PGlite.
roleMode='ordinary';await page.goto('http://localhost:5173/admin');await page.getByRole('heading',{name:'This workspace is for authorized staff'}).waitFor();assert.equal(await page.getByRole('navigation',{name:'Administration'}).count(),0)
roleMode='error';await page.reload();await page.getByRole('heading',{name:'We could not verify access'}).waitFor();assert.equal(await page.getByText('PRIVATE_INTERNAL_SENTINEL').count(),0)
roleMode='admin';await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('navigation',{name:'Administration'}).waitFor();await page.reload();await page.getByRole('navigation',{name:'Administration'}).waitFor()
await page.screenshot({path:'/home/user/redesign-admin-mobile.png',fullPage:true})
roleMode='timeout';await page.reload();await page.getByRole('heading',{name:'We could not verify access'}).waitFor({timeout:18000});roleMode='admin'
await page.evaluate(()=>localStorage.removeItem('sb-test-auth-token'));await page.goto('http://localhost:5173/admin');await page.waitForURL('**/admin/login');await page.getByRole('heading',{name:'Staff sign in.'}).waitFor()
await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/home/user/redesign-staff-login.png',fullPage:true})
signInRejected=true;await page.getByLabel('Email address',{exact:true}).fill('member@example.org');await page.getByLabel('Password',{exact:true}).fill('test-password-only');await page.getByRole('button',{name:'Continue to staff workspace'}).click();await page.getByRole('alert').filter({hasText:'The email or password is incorrect.'}).waitFor();assert.equal(await page.getByText('PRIVATE_INTERNAL_SENTINEL').count(),0)
signInRejected=false;await page.getByRole('button',{name:'Continue to staff workspace'}).click();await page.getByRole('navigation',{name:'Administration'}).waitFor();await page.reload();await page.getByRole('navigation',{name:'Administration'}).waitFor();await page.screenshot({path:'/home/user/redesign-admin-desktop.png',fullPage:true})
await page.goto('http://localhost:5173/verify?success=true');await page.getByRole('heading',{name:'You’re verified.'}).waitFor()
await page.evaluate(()=>localStorage.removeItem('sb-test-auth-token'));await page.reload();await page.getByRole('heading',{name:'Check your inbox.'}).waitFor();assert.equal(await page.getByRole('heading',{name:'You’re verified.'}).count(),0)
assert.deepEqual(exceptions,[])
await browser.close()
console.log('Browser smoke passed: bulk studio with photo, review/consent, stable ambiguous-result retry and managed-list failure recovery;  commerce, mocked staff sign-in/refresh/denial/error/retry/timeout, verification anti-spoofing, sanitized login errors;  public home, desktop/mobile workspace, referrals, boosters dialog, directory filters, photo/settings, wallet and admin configuration dialogs (mock network fixtures).')
