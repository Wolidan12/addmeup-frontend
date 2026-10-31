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
const metrics={total_users:2,verified_users:2,active_users_30d:2,registrations_7d:2,dc_issued:0,dc_spent:0,dc_purchased:0,deposit_gross_kobo:0,deposit_refunds_kobo:0,successful_payments:0,pending_payments:0,failed_payments:0,active_promotions:0,launch_slots_remaining:50,launch_distributed_dc:0,pending_reports:0,pending_support:1,registration_series:[{day:'2026-10-30',users:0},{day:'2026-10-31',users:2}],recent_admin_activity:[]}
const ticket={id:'00000000-0000-0000-0000-000000000012',user_id:userId,subject:'Payment dispute fixture',category:'payment',status:'open',body:'A detailed payment request fixture',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}
const saves=[],exceptions=[]
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
 if(table==='admin_manual_deposits')json={rows:[],total:0,gross_kobo:0,refunded_kobo:0,net_kobo:0}
 if(table==='admin_notification_overview')json={templates:[],announcements:[],total:0,attempts:0,active_devices:0,delivery_stats:{}}
 if(table==='admin_metrics')json=metrics
 if(table==='support_tickets')json=[ticket]
 if(table==='support_replies')json=[]
 if(table==='admin_support_thread')json={ticket,replies:[]}
 if(table==='admin_user_detail')json={profile,account:{email:'fixture@example.org',email_confirmed:true},eligibility:{verified:true}}
 if(['admin_support_action','admin_save_coupon','create_support_ticket','support_reply'].includes(table)){saves.push({rpc:table,...route.request().postDataJSON()});json=table==='create_support_ticket'?ticket.id:null}
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
  json={rows:resource==='profiles'?[profile]:resource==='support_tickets'?[ticket]:resource==='site_settings'?[site]:resource==='boost_plans'?[{id:planId,title:'Test booster',multiplier:2,cost_points:50,duration_hours:24,bonus_cap:100,is_active:true}]:[],total:['profiles','support_tickets','site_settings','boost_plans'].includes(resource)?1:0}
 }
 if(table==='activate_point_boost')json=planId
 if(table==='claim_daily_checkin')json='Check-in complete: +10 pts'
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':'0-0/1'},body:JSON.stringify(json)})
})


// Actual Chromium engine, but network/Auth fixtures and synthetic install events.
await context.route(/pwa-register/,route=>route.fulfill({contentType:'application/javascript',body:`export function useRegisterSW(){return {needRefresh:[true,()=>{}],offlineReady:[false,()=>{}],updateServiceWorker:async()=>{window.__updated=true}}}`}))
const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>{exceptions.push(e.message);console.error(e.message)})
try{
 for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1440,1000]]){
  await page.setViewportSize({width,height});await page.goto('http://localhost:5174/install');await page.getByRole('heading',{name:'Keep your community close.'}).waitFor();await page.getByRole('status',{name:'Application update'}).waitFor();await page.getByRole('link',{name:'Read release notes →'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
 }
 await page.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.__prompted=true};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e)})
 await page.getByRole('button',{name:'Install on this device'}).click();assert.equal(await page.evaluate(()=>window.__prompted),true);await page.getByText('Installation requested.',{exact:false}).waitFor();await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));await page.getByRole('heading',{name:'You’re using the installed app'}).waitFor()
 await page.getByRole('button',{name:'Update now'}).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__updated),true)
 assert.deepEqual(exceptions,[])
 const slow=await context.newCDPSession(page);await slow.send('Network.enable');await slow.send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:200000,uploadThroughput:90000});const start=Date.now();await page.goto('http://localhost:5174/register',{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('heading').first().waitFor();await page.locator('input[type=email]').waitFor();console.log('Simulated slow-network registration form rendered in '+(Date.now()-start)+'ms; not a real mobile performance benchmark.')
 const broken=await browser.newContext();await broken.route('https://test.supabase.co/**',route=>route.fulfill({contentType:'application/json',body:'[]'}));await broken.route('**/src/pages/Install.jsx',route=>route.fulfill({contentType:'application/javascript',body:'export default function Broken(){throw new Error("PRIVATE_BOUNDARY_SENTINEL")}'}));const fault=await broken.newPage();await fault.goto('http://localhost:5174/install');await fault.getByRole('heading',{name:'Let’s get you back on track'}).waitFor();assert.ok(!(await fault.locator('body').innerText()).includes('PRIVATE_BOUNDARY_SENTINEL'));await fault.getByRole('link',{name:'Return to Danqel'}).waitFor()
 console.log('PASS install/update/error-boundary UI, keyboard-labelled controls, five responsive layouts and simulated slow network. Synthetic install events, not Android/iOS/desktop installation proof.')
}finally{await browser.close()}
