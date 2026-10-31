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
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':table==='mission_submissions'?`0-${Math.max(0,submissions.length-1)}/${submissions.length}`:'*/0'},body:JSON.stringify(json)})
})

const base=process.env.TEST_BASE_URL||'http://localhost:5173'
const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>exceptions.push(e.message))
await page.goto(base+'/');await page.getByRole('heading',{name:/Your world/}).waitFor();await page.getByText('47 slots remaining',{exact:true}).waitFor();assert.match(await page.locator('.launch-promotion').innerText(),/15,000 DC awarded/)
await page.goto(base+'/register');await page.getByRole('heading',{name:'Make room for more.'}).waitFor();await page.getByText('47 slots remaining',{exact:true}).waitFor();assert.match(await page.locator('.launch-promotion').innerText(),/Registration alone does not qualify/)
await page.evaluate(session=>localStorage.setItem('sb-test-auth-token',JSON.stringify(session)),testSession)
await page.goto(base+'/missions');await page.getByRole('heading',{name:'Missions & challenges.'}).waitFor();await page.getByRole('heading',{name:'Rising Creator',exact:true}).waitFor();await page.getByRole('button',{name:'Check my eligibility & award'}).click();await page.getByRole('status').filter({hasText:'You received 5,000 DC'}).waitFor()
await page.getByRole('article').filter({has:page.getByRole('heading',{name:'Daily login',exact:true})}).getByRole('button',{name:'Check & claim reward'}).click();let dialog=page.getByRole('dialog');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm eligibility check'}).click();await page.getByRole('status').filter({hasText:'eligibility was checked'}).waitFor();assert.equal(missionRequests.some(r=>r.p_mission==='m-login'&&!('p_reward' in r)),true)
await page.getByRole('article').filter({has:page.getByRole('heading',{name:'Verify a supported social account',exact:true})}).getByRole('button',{name:'Submit evidence'}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Supported account you own',{exact:true}).selectOption('social-1');await dialog.getByLabel('Evidence and original activity URL').fill('https://instagram.com/test_member Independent ownership challenge proof');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Submit for review',exact:true}).click();await page.getByRole('status').filter({hasText:'No credits have been awarded yet'}).waitFor();assert.equal(submissions.find(s=>s.mission_id==='m-social').status,'submitted')
await page.getByLabel('Mission schedule',{exact:true}).selectOption('weekly');await page.getByRole('heading',{name:'Weekly creator challenge',exact:true}).waitFor();assert.equal(missionRequests.at(-1).p_cadence,'weekly')
failMission=true;await page.getByLabel('Mission schedule',{exact:true}).selectOption('daily');await page.getByRole('alert').waitFor();assert.equal((await page.locator('body').innerText()).includes('PRIVATE_INTERNAL_SENTINEL'),false);failMission=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('heading',{name:'Daily login',exact:true}).waitFor()
await page.goto(base+'/admin?view=missions');await page.getByRole('heading',{name:'Launch campaign & earning limits'}).waitFor();await page.getByRole('button',{name:'Configure earning limits'}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Daily DC limit').fill('1500');await dialog.getByLabel('Reason',{exact:true}).fill('Update eligible launch mission budget');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm reward controls'}).click();await page.getByRole('status').filter({hasText:'Reward controls saved'}).waitFor();assert.equal(limitsSaves[0].p_daily,1500)
await page.getByRole('button',{name:'Inspect →',exact:true}).first().click();await page.getByRole('button',{name:'Configure mission',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('DC reward',{exact:true}).fill('25');await dialog.getByLabel('Non-spendable XP reward').fill('12');await dialog.getByLabel('Reason for change').fill('Set independent DC and XP mission rewards');await dialog.getByRole('checkbox').last().check();await dialog.getByRole('button',{name:'Confirm mission configuration'}).click();await page.getByRole('status').filter({hasText:'Mission configuration saved'}).waitFor();assert.equal(missionSaves[0].p_data.reward_dc,25);assert.equal(missionSaves[0].p_data.reward_xp,12)
await page.goto(base+'/admin?view=mission_submissions');await page.locator('tr').filter({hasText:'Verify a supported social account'}).getByRole('button',{name:'Inspect →'}).click();await page.getByRole('button',{name:'Approve verified mission evidence'}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Canonical verified account or original artifact ID').fill('canonical-account-fixture');await dialog.getByLabel('Reason / internal note').fill('Independently verified the public ownership challenge');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm action',exact:true}).click();await page.getByRole('status').filter({hasText:'completed and audit-logged'}).waitFor();assert.equal(reviews[0].p_approve,true);assert.equal(reviews[0].p_revision,1)
for(const path of ['/missions','/admin?view=missions','/admin?view=mission_submissions','/admin?view=launch_awards','/register'])for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){await page.setViewportSize({width,height});await page.goto(base+path);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${path} ${width} overflow`)}
await page.setViewportSize({width:390,height:844});await page.goto(base+'/missions');await page.getByRole('heading',{name:'Rising Creator'}).waitFor();await page.screenshot({path:'/home/user/launch-missions-mobile.png',fullPage:true});assert.deepEqual(exceptions,[]);await browser.close();console.log('Launch/mission browser fixtures PASS: public homepage/registration actual RPC counters, eligibility/award timestamp, mission claims and evidence confirmation, server cadence filtering, safe errors/retry, independent XP/DC configuration, admin limits/evidence approval and 25 responsive layouts. No real GoTrue/mail/ownership acceptance test.')
