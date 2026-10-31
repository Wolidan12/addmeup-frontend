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
const missionRows=[
 {id:'m-login',title:'Daily login',description:'Sign in with a verified account.',instructions:'A trusted sign-in today is required.',cadence:'daily',kind:'daily_login',reward_dc:20,reward_xp:10,requires_approval:false,is_active:true,starts_at:'2026-01-01T00:00:00Z',deadline:null},
 {id:'m-social',title:'Verify a supported social account',description:'Prove independent ownership.',instructions:'Publish your submission challenge and submit independently checkable proof.',cadence:'special',kind:'social',reward_dc:150,reward_xp:75,requires_approval:true,is_active:true,starts_at:'2026-01-01T00:00:00Z',deadline:null},
 {id:'m-weekly',title:'Weekly creator challenge',description:'Publish a useful original project.',instructions:'Submit an original project URL for independent review.',cadence:'weekly',kind:'manual',reward_dc:500,reward_xp:250,requires_approval:true,is_active:true,starts_at:'2026-01-01T00:00:00Z',deadline:null}
],submissions=[],missionRequests=[],reviews=[],missionSaves=[],limitsSaves=[]
let failMission=false
const campaign={status:'active',remaining_slots:47,total_slots:50,reward_dc:5000,awarded_count:3,total_distributed_dc:15000,maximum_distribution_dc:250000,credits_expire:false,eligibility:{registered:true,verified:true,profile_complete:false,already_awarded:false},award:null}
const notificationRows=[{id:'a0000000-0000-0000-0000-000000000001',title:'Payment approved',body:'Finance independently confirmed your transfer.',category:'deposits',url:'/wallet',is_read:false,created_at:new Date().toISOString()},{id:'a0000000-0000-0000-0000-000000000002',title:'A genuine creator event',body:'An original creator campaign is open.',category:'events',url:'/discover',is_read:true,created_at:new Date().toISOString()}]
let preferences={push_enabled:false,daily_enabled:false,reminder_time:'09:00:00',timezone:'Africa/Lagos',quiet_start:null,quiet_end:null,categories:{}},devices=[],preferenceSaves=[],inboxRequests=[],announcements=[],templateSaves=[],releaseRequests=[],inboxFailure=false
const exceptions=[]
await context.route('https://test.supabase.co/**',async route=>{
 const url=new URL(route.request().url()),table=url.pathname.split('/').at(-1)
 let json=[]
 if(table==='launch_status')json=campaign
 if(table==='claim_launch_reward'){campaign.award={slot:4,amount_dc:5000,awarded_at:new Date().toISOString(),activity_reference:'launch:first50:'+userId};campaign.remaining_slots=46;campaign.total_distributed_dc=20000;json=campaign}
 if(table==='mission_overview'){
  const body=route.request().postDataJSON();missionRequests.push(body)
  if(failMission){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_INTERNAL_SENTINEL'})});return}
  const rows=missionRows.filter(m=>!body.p_cadence||m.cadence===body.p_cadence).map(m=>({...m,latest_submission:submissions.find(s=>s.mission_id===m.id)||null}))
  json={rows,total:rows.length,verified:true,profile_complete:false,xp:130,rank:'Rising Creator',next_rank:{min_xp:500,title:'Influencer'},limits:{daily_dc:1000,weekly_dc:3000},earned_today:20,earned_week:120}
 }
 if(table==='submit_mission'){const body=route.request().postDataJSON();missionRequests.push(body);const m=missionRows.find(m=>m.id===body.p_mission);submissions.push({id:body.p_request,user_id:userId,mission_id:m.id,mission_title:m.title,period_key:'once',status:m.requires_approval?'submitted':'awarded',revision:1,evidence:body.p_evidence,reward_dc:m.reward_dc,reward_xp:m.reward_xp,social_link_id:body.p_social,related_user_id:body.p_related,submitted_at:new Date().toISOString()});json=body.p_request}
 if(table==='mission_submissions')json=submissions
 if(table==='mission_limits')json={id:true,daily_dc:1000,weekly_dc:3000}
 if(table==='social_links')json=[{id:'social-1',platform:'instagram',url:'https://instagram.com/test_member',profile_id:userId}]
 if(table==='mission_referral_candidates')json={rows:[],total:0}
 if(table==='admin_save_mission'){missionSaves.push(route.request().postDataJSON());json=null}
 if(table==='admin_mission_limits'){limitsSaves.push(route.request().postDataJSON());json=null}
 if(table==='admin_review_mission'){const body=route.request().postDataJSON();reviews.push(body);submissions.find(s=>s.id===body.p_submission).status=body.p_approve?'awarded':'rejected';json=null}

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

 if(table==='site_settings')json=site
 if(table==='member_overview')json=overview
 if(table==='public_directory'||table==='member_referrals')json={rows:[],total:0}
 if(table==='profiles')json=profile
 if(table==='admin_role')json=roleMode==='ordinary'?'user':'super_admin'
 if(table==='admin_overview')json={profiles:0,social_links:0,open_reports:0,revenue_kobo:0,bank_revenue_kobo:0,pending_bank_orders:0,pending_payments:0,trend:[]}
 if(table==='boost_plans')json=[{id:planId,title:'Test booster',multiplier:2,cost_points:50,duration_hours:24,bonus_cap:100,is_active:true}]
 if(table==='admin_list'){
  const resource=route.request().postDataJSON().p_resource
  if(['missions','mission_submissions','launch_awards','mission_awards'].includes(resource)){const rows=resource==='missions'?missionRows:resource==='mission_submissions'?submissions:[];await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rows,total:rows.length})});return}
  if(resource==='managed_profiles'){if(managedError){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_INTERNAL_SENTINEL'})});return}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rows:managedRows,total:managedRows.length})});return}
  json={rows:resource==='site_settings'?[site]:resource==='boost_plans'?[{id:planId,title:'Test booster',multiplier:2,cost_points:50,duration_hours:24,bonus_cap:100,is_active:true}]:[],total:resource==='site_settings'||resource==='boost_plans'?1:0}
 }
 if(table==='activate_point_boost')json=planId
 if(table==='claim_daily_checkin')json='Check-in complete: +10 pts'
 if(table==='notification_preferences_get')json=preferences
 if(table==='push_config')json={public_key:'A'.repeat(87)}
 if(table==='push_subscriptions')json=devices
 if(table==='push_subscribe'){const b=route.request().postDataJSON();assert.equal(b.p_endpoint,'https://fcm.googleapis.com/fcm/send/browser-fixture');json='device-fixture';devices=[{id:json,device_name:'Mock browser device',active:true,created_at:new Date().toISOString()}]}
 if(table==='push_unsubscribe'){devices=[];json=null}
 if(table==='notification_preferences_save'){const b=route.request().postDataJSON();preferenceSaves.push(b);preferences={push_enabled:b.p_push,daily_enabled:b.p_daily,reminder_time:b.p_time,timezone:b.p_timezone,quiet_start:b.p_quiet_start,quiet_end:b.p_quiet_end,categories:b.p_categories};json=null}
 if(table==='notification_inbox'){if(inboxFailure){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_INTERNAL_SENTINEL'})});return}const b=route.request().postDataJSON();inboxRequests.push(b);const rows=notificationRows.filter(n=>(!b.p_read||n.is_read===(b.p_read==='read'))&&(!b.p_category||n.category===b.p_category));json={rows,total:rows.length,unread:notificationRows.filter(n=>!n.is_read).length}}
 if(table==='notifications_mark_read'){const b=route.request().postDataJSON();notificationRows.forEach(n=>{if(!b.p_id||n.id===b.p_id)n.is_read=true});json=null}
 if(table==='admin_notification_overview')json={announcements:[],total:0,templates:[{key:'daily_reminder',title:'Your daily Danqel moment',body:'Visit, complete missions and explore your Growth Wallet.',category:'daily',url:'/missions'}],delivery_stats:{accepted:2,failed:1},attempts:3,active_devices:devices.length}
 if(table==='admin_notification_save'){announcements.push(route.request().postDataJSON());json=announcements.at(-1).p_id}
 if(table==='admin_notification_template'){templateSaves.push(route.request().postDataJSON());json=null}
 if(table==='publish-app-release'){releaseRequests.push(route.request().postDataJSON());await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'PRIVATE_INTERNAL_SENTINEL'})});return}
 if(table==='app_releases')json=[{commit:'a'.repeat(40),version:'1.0.1',notes:'Actual confirmed release notes from an explicit fixture.',built_at:new Date().toISOString(),confirmed_at:new Date().toISOString()}]
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':table==='mission_submissions'?`0-${Math.max(0,submissions.length-1)}/${submissions.length}`:'*/0'},body:JSON.stringify(json)})
})

await context.addInitScript(()=>{
 window.__permissionCount=0;window.Notification=class{static permission='default';static async requestPermission(){window.__permissionCount++;this.permission='granted';return 'granted'}}
 const sub={toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/browser-fixture',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}}),unsubscribe:async()=>true}
 const reg={pushManager:{getSubscription:async()=>null,subscribe:async()=>sub},active:{postMessage(){}},update:async()=>{}}
 Object.defineProperty(navigator.serviceWorker,'ready',{get:()=>Promise.resolve(reg)});navigator.serviceWorker.getRegistration=async()=>reg
})
const base=process.env.TEST_BASE_URL||'http://localhost:5174',page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>exceptions.push(e.message))
try{
 await page.goto(base);await page.evaluate(session=>localStorage.setItem('sb-test-auth-token',JSON.stringify(session)),testSession)
 await page.goto(base+'/notifications');await page.getByRole('heading',{name:'Notification preferences',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__permissionCount),0)
 await page.getByLabel('Read status',{exact:true}).selectOption('unread');await page.getByRole('heading',{name:'Payment approved',exact:false}).waitFor();await page.getByLabel('Notification category',{exact:true}).selectOption('deposits');await page.waitForTimeout(250);assert.equal(inboxRequests.at(-1).p_read,'unread');assert.equal(inboxRequests.at(-1).p_category,'deposits');await page.getByRole('button',{name:'Mark all as read'}).click();await page.getByText('No notifications match this view.').waitFor()
 await page.getByRole('button',{name:'Enable notifications on this device'}).click();await page.getByRole('status').filter({hasText:'This device is registered'}).waitFor();assert.equal(await page.evaluate(()=>window.__permissionCount),1);assert.equal(preferenceSaves.at(-1).p_push,true)
 await page.getByLabel('Enable one combined daily visit / mission reminder').check();await page.getByLabel('Preferred reminder time',{exact:true}).fill('18:30');await page.getByLabel('IANA time zone',{exact:true}).fill('Africa/Lagos');await page.getByLabel('Quiet hours start (optional)').fill('22:00');await page.getByLabel('Quiet hours end (optional)').fill('07:00');await page.getByRole('checkbox',{name:'Events & campaigns',exact:true}).uncheck();await page.getByRole('button',{name:'Save notification preferences',exact:true}).click();await page.getByRole('status').filter({hasText:'preferences saved'}).waitFor();assert.equal(await page.evaluate(()=>window.__permissionCount),1);assert.equal(preferenceSaves.at(-1).p_daily,true);assert.equal(preferenceSaves.at(-1).p_categories.events,false)
 await page.getByRole('button',{name:'Unsubscribe this device'}).click();await page.getByRole('status').filter({hasText:'This device unsubscribed'}).waitFor();assert.equal(devices.length,0)
 inboxFailure=true;await page.getByRole('button',{name:'Refresh inbox'}).click();await page.getByRole('alert').waitFor();assert.equal((await page.locator('body').innerText()).includes('PRIVATE_INTERNAL_SENTINEL'),false);inboxFailure=false;await page.getByRole('button',{name:'Retry inbox'}).click();await page.getByRole('button',{name:'Refresh inbox'}).waitFor()
 await page.goto(base+'/admin?view=notifications');await page.getByRole('heading',{name:'Push & announcement control'}).waitFor();await page.getByLabel('Announcement title',{exact:true}).fill('Creator campaign opening');await page.getByLabel('Announcement message',{exact:true}).fill('An original creator campaign with clear participation rules.');await page.getByLabel('Audience',{exact:true}).selectOption('verified');await page.getByRole('button',{name:'Review announcement'}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Reason for notification action').fill('Announce a verified original creator event');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm notification action'}).click();await page.getByRole('status').filter({hasText:'confirmed and audit-logged'}).waitFor();assert.equal(announcements[0].p_audience,'verified')
 await page.getByLabel('Template body',{exact:true}).fill('Complete your daily missions and check the Growth Wallet.');await page.getByRole('button',{name:'Review template changes'}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Reason for notification action').fill('Clarify the combined daily reminder template');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm notification action'}).click();await page.getByRole('status').filter({hasText:'confirmed and audit-logged'}).waitFor();assert.equal(templateSaves.length,1);await dialog.waitFor({state:'hidden'})
 await page.getByLabel('Expected deployed Git commit').fill('a'.repeat(40));await page.getByLabel('Release version / name').fill('1.0.1');await page.getByLabel('Public release notes (features and fixes)').fill('A genuine set of feature additions and fixes.');await page.getByLabel('Expected deployed Git commit').fill('a'.repeat(40));assert.equal(await page.getByLabel('Expected deployed Git commit').inputValue(),'a'.repeat(40));await page.getByRole('button',{name:'Review production announcement'}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Reason for notification action').fill('Confirm only an actually available production version');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm notification action'}).click();await dialog.getByRole('alert').waitFor();assert.equal((await dialog.innerText()).includes('PRIVATE_INTERNAL_SENTINEL'),false);assert.equal(releaseRequests[0].authorized,true);await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
 await page.goto(base+'/release-notes');await page.getByRole('heading',{name:'1.0.1',exact:true}).waitFor()
 for(const path of ['/notifications','/admin?view=notifications','/release-notes'])for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){await page.setViewportSize({width,height});await page.goto(base+path);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${path} ${width} overflow`)}
 const ios=await context.newPage();await ios.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{get:()=> 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1'}));await ios.goto(base+'/notifications');await ios.getByText('Install Danqel on your Home Screen and open it there to enable iOS/iPadOS push.').waitFor();assert.equal(await ios.getByRole('button',{name:'Enable notifications on this device'}).isDisabled(),true);assert.equal(await ios.evaluate(()=>window.__permissionCount),0);await ios.close()
 const declined=await context.newPage();await declined.addInitScript(()=>{window.Notification.permission='denied'});await declined.goto(base+'/notifications');await declined.getByText(/Permission was declined/).waitFor();assert.equal(await declined.getByRole('button',{name:'Enable notifications on this device'}).isDisabled(),true);assert.equal(await declined.evaluate(()=>window.__permissionCount),0);await declined.close()
 assert.deepEqual(exceptions,[]);console.log('PASS browser notification fixtures: inbox/read-all/category filters, explicit-only mock permission, subscription/unsubscribe, category/time/quiet settings, admin announcements/templates, rejected unpublished release, release notes, safe errors and 15 responsive layouts. Browser permission/device transport are mocked; no physical devices tested.')
}finally{await browser.close()}
