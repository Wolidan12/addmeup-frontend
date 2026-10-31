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
const target={...profile,id:'b0000000-0000-0000-0000-000000000002',username:'other_creator',display_name:'Other Creator',is_connected:false,is_saved:false,social_links:[{platform:'instagram',url:'https://instagram.com/other_creator',is_public:true}]}
const packages=['Profile Spotlight','Visibility Boost','Featured Profile','Social Promotion Campaign','Premium Profile Badge'].map((title,i)=>({id:'package-'+i,title,description:'Reviewed in-app paid visibility. No engagement is guaranteed.',promotion_kind:['spotlight','visibility','featured','social','badge'][i],cost_dc:[500,800,1000,1500,400][i],duration_hours:[24,168,24,168,720][i],is_active:true}))
let bought=[],purchaseRequests=[],relationshipRequests=[],packageRequests=[],promotionReviews=[],filterRequests=[],failed=false,blocked=false
const paid={...target,promotion_id:'paid-1',promotion_kind:'spotlight',promotion_copy:'Original educational creator content'}
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
 if(table==='dc_products')json=packages
 if(table==='my_promotion_campaigns'){if(failed){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_INTERNAL_SENTINEL'})});return}const b=route.request().postDataJSON();filterRequests.push(b);json={rows:bought.filter(c=>!b.p_status||c.effective_status===b.p_status),total:bought.length,balance:5000-bought.reduce((n,c)=>n+c.cost_dc,0)}}
 if(table==='buy_promotion'){const b=route.request().postDataJSON();purchaseRequests.push(b);const p=packages.find(p=>p.id===b.p_product);bought.push({...p,id:b.p_request,effective_status:'pending',created_at:new Date().toISOString(),recorded_profile_opens:0,recorded_social_opens:0});json=b.p_request}
 if(table==='public_directory'){const b=route.request().postDataJSON();filterRequests.push(b);json={rows:blocked?[]:[target],total:blocked?0:1,paid_rows:blocked?[]:[paid]}}
 if(table==='discovery_relationship'){const b=route.request().postDataJSON();relationshipRequests.push(b);if(b.p_action==='block')blocked=b.p_enabled;if(b.p_action==='connect')target.is_connected=b.p_enabled;if(b.p_action==='save')target.is_saved=b.p_enabled;json=null}
 if(table==='discovery_connections'){const b=route.request().postDataJSON();json={rows:b.p_kind==='blocked'?(blocked?[{profile_id:target.id}]:[]):b.p_kind==='connected'?(target.is_connected&&!blocked?[{profile_id:target.id,profile:target}]:[]):target.is_saved&&!blocked?[{profile_id:target.id,profile:target}]:[],total:1}}
 if(table==='discovery_profile')json=blocked?null:target
 if(table==='admin_list'&&route.request().postDataJSON().p_resource==='promotion_campaigns')json={rows:[{id:'pending-other',user_id:target.id,title:'Other Spotlight',cost_dc:500,duration_hours:24,status:'pending',submission:'Original creator promotional content for independent review'}],total:1}
 if(table==='admin_save_promotion_package'){packageRequests.push(route.request().postDataJSON());json=null}
 if(table==='admin_review_promotion'){promotionReviews.push(route.request().postDataJSON());json=null}
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':table==='mission_submissions'?`0-${Math.max(0,submissions.length-1)}/${submissions.length}`:'*/0'},body:JSON.stringify(json)})
})

const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>exceptions.push(e.message))
const base=process.env.TEST_BASE_URL||'http://localhost:5174'
try{
await page.goto(base);await page.evaluate(session=>localStorage.setItem('sb-test-auth-token',JSON.stringify(session)),testSession)
await page.goto(base+'/boosts');await page.getByRole('heading',{name:'Boost Center.'}).waitFor();await page.getByRole('button',{name:'Review purchase'}).first().click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Promotional submission').fill('Original educational content submitted for promotion');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:/Confirm 500/}).click();await page.getByRole('status').filter({hasText:'Campaign funded'}).waitFor();assert.equal(purchaseRequests.length,1);assert.ok(purchaseRequests[0].p_request);assert.equal('p_cost' in purchaseRequests[0],false);assert.equal(purchaseRequests[0].p_expected_cost,500);assert.equal(purchaseRequests[0].p_expected_hours,24)
await page.getByLabel('Campaign status').selectOption('pending');await page.waitForTimeout(300);assert.equal(filterRequests.at(-1).p_status,'pending')
failed=true;await page.getByRole('button',{name:'Refresh campaigns'}).click();await page.getByRole('alert').waitFor();assert.equal((await page.locator('body').innerText()).includes('PRIVATE_INTERNAL_SENTINEL'),false);failed=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('button',{name:'Review purchase'}).first().waitFor()
await page.goto(base+'/discover');await page.getByRole('region',{name:'Paid promotions'}).waitFor();await page.getByRole('heading',{name:'Organic community results'}).waitFor();await page.getByRole('button',{name:'Connect · free'}).last().click();await page.getByRole('button',{name:'Disconnect'}).last().waitFor();assert.equal(relationshipRequests.at(-1).p_action,'connect')
await page.getByRole('button',{name:'Save favourite',exact:true}).last().click();await page.getByRole('button',{name:'Unsave',exact:true}).last().waitFor()
await page.getByRole('button',{name:'Block',exact:true}).last().click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Confirm block'}).click();await page.getByRole('heading',{name:'No creators found'}).waitFor()
await page.goto(base+'/connections');await page.getByRole('button',{name:'Blocked accounts',exact:true}).click();await page.getByRole('button',{name:'Unblock account',exact:true}).click();assert.equal(relationshipRequests.at(-1).p_enabled,false)
await page.goto(base+'/discover?report=other_creator');dialog=page.getByRole('dialog');await dialog.getByLabel('Reason',{exact:true}).fill('Suspicious misleading account content');await dialog.getByRole('button',{name:'Submit report'}).click();await page.getByRole('status').filter({hasText:'sent to moderation'}).waitFor()
await page.goto(base+'/admin?view=promotion_campaigns');await page.getByRole('heading',{name:'Promotion packages & booked durations'}).waitFor();await page.getByRole('button',{name:'Configure promotion package'}).first().click();dialog=page.getByRole('dialog');await dialog.getByLabel('Price (DC)').fill('650');await dialog.getByLabel('Duration (hours)').fill('48');await dialog.getByLabel('Reason',{exact:true}).fill('Update reviewed placement booking configuration');await dialog.getByRole('checkbox').last().check();await dialog.getByRole('button',{name:'Save promotion package'}).click();await page.getByRole('status').filter({hasText:'Package saved and audit-logged'}).waitFor();assert.equal(packageRequests[0].p_cost,650);assert.equal(packageRequests[0].p_hours,48)
await page.getByRole('button',{name:'Inspect →',exact:true}).first().click();await page.getByRole('button',{name:'Approve paid placement'}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Reason / internal note').fill('Independently reviewed suitable creator promotional content');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm action',exact:true}).click();await page.getByRole('status').filter({hasText:'completed and audit-logged'}).waitFor();assert.equal(promotionReviews[0].p_action,'approve')
for(const path of ['/boosts','/discover','/connections','/profile/other_creator','/admin?view=promotion_campaigns'])for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){await page.setViewportSize({width,height});await page.goto(base+path);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(220);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${path} ${width} overflow`)}
// Completion mark is based on fresh profile facts, never paid placement flags.
target.avatar_url='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=';
for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){
 await page.setViewportSize({width,height});await page.goto(base+'/profile/other_creator');const badge=page.getByRole('img',{name:'Profile complete',exact:true});await badge.waitFor();assert.match(await badge.getAttribute('title'),/Not identity verification/);assert.equal(await badge.locator('svg').evaluate(el=>getComputedStyle(el).fill),'rgb(168, 85, 247)');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'complete badge layout '+width);
}
target.bio=' ';await page.reload();await page.getByRole('heading').first().waitFor();assert.equal(await page.getByRole('img',{name:'Profile complete',exact:true}).count(),0);
target.bio='Restored biography';target.managed=true;await page.reload();await page.getByRole('heading').first().waitFor();assert.equal(await page.getByRole('img',{name:'Profile complete',exact:true}).count(),0);target.managed=false;
console.log('PASS purple mark browser fixtures: actual SVG purple fill, descriptive tooltip, five responsive layouts, incomplete and managed profiles unmarked.');
assert.deepEqual(exceptions,[]);console.log('PASS browser network fixtures: paid vs organic, free connect/save/block/unblock, profile report, purchase confirmation, safe errors/retry, server filters, admin package editing/review, 25 responsive layouts. Not real production authentication.')
}finally{await browser.close()}
