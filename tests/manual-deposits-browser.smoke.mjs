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
const depositOrders=[],depositRequests=[],financeReviews=[],refundRequests=[],depositFilters=[]
let depositFailure=false
const targetOrder={id:'d0000000-0000-0000-0000-000000000001',user_id:'b0000000-0000-0000-0000-000000000002',username:'payer_creator',email:'payer@example.org',package_title:'Manual DC deposit',points:1000,amount_kobo:100000,status:'submitted',account_number:'6977298247',account_name:'LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST',bank_name:'MONIEPOINT',created_at:new Date().toISOString()}
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
 if(url.pathname.startsWith('/functions/v1/'))throw new Error('Online verification must not be invoked')
 if(url.pathname.startsWith('/storage/v1/object/'))json={Key:url.pathname}
 if(table==='dc_settings')json={deposits_enabled:true,spending_enabled:true}
 if(table==='point_packages')json=[{id:planId,title:'100 DC',points:100,price_kobo:10000,is_active:true}]
 if(table==='create_manual_deposit'){const b=route.request().postDataJSON();depositRequests.push(b);const order={...targetOrder,id:b.p_request,user_id:userId,points:b.p_amount,amount_kobo:Math.round(b.p_amount*100),status:'awaiting_transfer'};depositOrders.push(order);json=order.id}
 if(table==='bank_point_orders'){const single=route.request().headers()['accept']?.includes('vnd.pgrst.object');json=single?depositOrders.find(o=>url.searchParams.get('id')==='eq.'+o.id):depositOrders}
 if(table==='submit_bank_point_order'){const b=route.request().postDataJSON();depositOrders.find(o=>o.id===b.p_order).status='submitted';json=null}
 if(table==='admin_manual_deposits'){if(depositFailure){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_INTERNAL_SENTINEL'})});return}depositFilters.push(route.request().postDataJSON());json={rows:[targetOrder],total:1,gross_kobo:100000,refunded_kobo:0,net_kobo:100000}}
 if(table==='admin_confirm_manual_deposit'){financeReviews.push(route.request().postDataJSON());targetOrder.status='approved';json=null}
 if(table==='admin_record_manual_refund'){refundRequests.push(route.request().postDataJSON());targetOrder.status='refunded';json=null}
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':table==='mission_submissions'?`0-${Math.max(0,submissions.length-1)}/${submissions.length}`:'*/0'},body:JSON.stringify(json)})
})

const base=process.env.TEST_BASE_URL||'http://localhost:5174'
const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>exceptions.push(e.message))
try{
 await page.goto(base);await page.evaluate(session=>localStorage.setItem('sb-test-auth-token',JSON.stringify(session)),testSession)
 await page.goto(base+'/credits');await page.getByRole('heading',{name:'Buy Growth Credits.'}).waitFor();await page.getByLabel('Naira amount',{exact:true}).fill('1000');await page.locator('output').filter({hasText:'1,000 DC'}).waitFor();await page.getByRole('button',{name:'Continue with manual transfer'}).click();let dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:/1,000 DC/}).waitFor();assert.match(await dialog.innerText(),/6977298247/);assert.match(await dialog.innerText(),/LUNA ENTRY SERVICES/);await dialog.getByLabel('Payer name',{exact:true}).fill('Actual Bank Payer');await dialog.getByLabel('Bank transfer reference',{exact:true}).fill('bank-claimed-reference');await dialog.getByLabel(/Receipt image/).setInputFiles({name:'receipt.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=','base64')});await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Submit for review'}).click();await page.getByRole('status').filter({hasText:'only after the bank transfer is confirmed'}).waitFor();assert.equal(depositRequests[0].p_amount,1000);assert.equal('p_points' in depositRequests[0],false)
 await page.goto(base+'/payments');await page.getByRole('heading',{name:'Manual bank deposits',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Check with provider'}).count(),0)
 await page.goto(base+'/admin?view=bank_point_orders');await page.getByRole('heading',{name:/Manual deposits only/}).waitFor();await page.getByLabel('From date (UTC)').fill('2026-01-01');await page.getByLabel('To date (UTC)').fill('2026-12-31');await page.getByRole('textbox',{name:'Search username, email or payment reference'}).fill('payer@example.org');await page.waitForTimeout(650);assert.equal(depositFilters.at(-1).p_search,'payer@example.org');assert.equal(depositFilters.at(-1).p_from,'2026-01-01')
 await page.getByRole('button',{name:'Inspect →'}).click();await page.getByRole('button',{name:'Confirm received funds & credit DC'}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Amount actually received on bank statement (NGN)').fill('1000');await dialog.getByLabel('Receiving account from statement').fill('6977298247');await dialog.getByLabel('Unique transaction ID from the receiving bank statement').fill('cleared-bank-statement-id');await dialog.getByLabel('Reason / internal note').fill('Independently checked actual receiving bank statement funds');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm action',exact:true}).click();await page.getByRole('status').filter({hasText:'completed and audit-logged'}).waitFor();assert.equal(financeReviews[0].p_received_kobo,100000);assert.equal(financeReviews[0].p_currency,'NGN');assert.equal(financeReviews[0].p_recipient,'6977298247')
 await page.getByRole('button',{name:'Inspect →'}).click();await page.getByRole('button',{name:'Record confirmed external refund'}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Full amount externally returned (NGN)').fill('1000');await dialog.getByLabel('Confirmed outgoing bank refund reference').fill('outgoing-refund-reference');await dialog.getByLabel('Reason / internal note').fill('Confirmed outgoing full refund to original payer');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm action',exact:true}).click();await page.getByRole('status').filter({hasText:'completed and audit-logged'}).waitFor();assert.equal(refundRequests[0].p_amount_kobo,100000)
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'↓ Export page CSV'}).click();assert.match((await download).suggestedFilename(),/bank_point_orders/)
 depositFailure=true;await page.getByRole('button',{name:'↻ Refresh',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal((await page.locator('body').innerText()).includes('PRIVATE_INTERNAL_SENTINEL'),false);depositFailure=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('button',{name:'Inspect →'}).waitFor()
 for(const path of ['/credits','/payments','/admin?view=bank_point_orders'])for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){await page.setViewportSize({width,height});await page.goto(base+path);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${path} ${width} overflow`)}
 assert.deepEqual(exceptions,[]);console.log('PASS manual browser fixtures: exact amount/DC, official bank details, private receipt submission with pending-only message, no online verification, staff statement approval, confirmed external refund, date/search filters, CSV, safe error/retry and 15 responsive layouts. Not live Auth or real bank settlement.')
}finally{await browser.close()}
