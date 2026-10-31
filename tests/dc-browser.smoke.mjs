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
const products=[{id:planId,slug:'profile_spotlight',title:'Profile Spotlight',description:'Staff-reviewed placement request',cost_dc:50,is_active:true}],orders=[],spends=[],configs=[],reviews=[],walletRequests=[]
let walletError=false
const transaction={id:'tx-1',transaction_reference:'DC-fixture-reference',transaction_type:'deposit',credit_amount:100,previous_balance:80,new_balance:180,status:'successful',description:'Verified naira deposit',activity_reference:'bank-order:fixture',snapshot_origin:'recorded',created_at:new Date().toISOString()}
const exceptions=[]
await context.route('https://test.supabase.co/**',async route=>{
 const url=new URL(route.request().url()),table=url.pathname.split('/').at(-1)
 let json=[]
 if(table==='dc_wallet'){
  const body=route.request().postDataJSON();walletRequests.push(body)
  if(walletError){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_INTERNAL_SENTINEL'})});return}
  json={balance:overview.balance.balance,rows:body.p_status&&body.p_status!=='successful'?[]:[transaction],total:body.p_status&&body.p_status!=='successful'?0:21,pending:1,successful:1,failed:0}
 }
 if(table==='dc_products')json=products
 if(table==='dc_orders')json=orders
 if(table==='dc_settings')json={id:true,deposits_enabled:true,spending_enabled:true}
 if(table==='dc_spend'){const body=route.request().postDataJSON();spends.push(body);overview.balance.balance=130;orders.push({id:body.p_request,user_id:userId,product_title:'Profile Spotlight',product_id:planId,cost_dc:50,status:'pending_fulfillment',created_at:new Date().toISOString()});json=body.p_request}
 if(table==='admin_dc_configure'){configs.push(route.request().postDataJSON());json=null}
 if(table==='admin_dc_review_order'){reviews.push(route.request().postDataJSON());orders[0].status='refunded';overview.balance.balance=180;json=null}
 if(table==='point_packages')json=[{id:'pkg-1',title:'100 DC',points:100,price_kobo:10000,is_active:true}]

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
  if(resource==='dc_transactions'||resource==='dc_orders'){json={rows:resource==='dc_transactions'?[transaction]:orders,total:1};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(json)});return}
  if(resource==='managed_profiles'){if(managedError){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'PRIVATE_INTERNAL_SENTINEL'})});return}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rows:managedRows,total:managedRows.length})});return}
  json={rows:resource==='site_settings'?[site]:resource==='boost_plans'?[{id:planId,title:'Test booster',multiplier:2,cost_points:50,duration_hours:24,bonus_cap:100,is_active:true}]:[],total:resource==='site_settings'||resource==='boost_plans'?1:0}
 }
 if(table==='activate_point_boost')json=planId
 if(table==='claim_daily_checkin')json='Check-in complete: +10 pts'
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':table==='dc_orders'?`0-${Math.max(0,orders.length-1)}/${orders.length}`:'*/0'},body:JSON.stringify(json)})
})

await context.addInitScript(session=>localStorage.setItem('sb-test-auth-token',JSON.stringify(session)),testSession)
const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>exceptions.push(e.message))
await page.goto('http://localhost:5173/wallet');await page.getByRole('heading',{name:'Growth Wallet.'}).waitFor();await page.locator('.dc-wallet-hero strong').filter({hasText:'180 DC'}).waitFor();await page.getByRole('link',{name:'Deposit',exact:true}).waitFor();await page.getByRole('button',{name:'Deposits',exact:true}).click();await page.getByLabel('Transaction status',{exact:true}).selectOption('pending');await page.getByRole('heading',{name:'A clear beginning.'}).waitFor();assert.equal(walletRequests.at(-1).p_kind,'deposits');assert.equal(walletRequests.at(-1).p_status,'pending');await page.getByLabel('Transaction status',{exact:true}).selectOption('');await page.getByRole('button',{name:'Next',exact:true}).click();await page.waitForFunction(()=>document.body.textContent.includes('Page 2'));assert.equal(walletRequests.at(-1).p_page,1)
walletError=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal((await page.locator('body').innerText()).includes('PRIVATE_INTERNAL_SENTINEL'),false);walletError=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('.dc-wallet-hero strong').filter({hasText:'180 DC'}).waitFor()
await page.goto('http://localhost:5173/credits');await page.getByRole('heading',{name:'Buy Growth Credits.'}).waitFor();await page.getByRole('heading',{name:'100 DC',exact:true}).waitFor();assert.match(await page.locator('body').innerText(),/₦1 = 1 DC/)
await page.goto('http://localhost:5173/spend-credits');await page.getByRole('button',{name:'Request this feature'}).click();const purchase=page.getByRole('dialog');await purchase.getByLabel('Profile, campaign or request details').fill('Please consider my profile for the spotlight');await purchase.getByRole('checkbox').check();await purchase.getByRole('button',{name:'Spend 50 DC',exact:true}).click();await page.getByRole('status').filter({hasText:'Your credits funded'}).waitFor();assert.equal(spends.length,1);assert.equal(spends[0].p_product,planId);assert.equal('p_cost' in spends[0],false)
await page.goto('http://localhost:5173/admin?view=point_packages');await page.getByRole('heading',{name:'DC controls & premium catalogue'}).waitFor();await page.getByRole('button',{name:'Configure feature',exact:true}).click();const config=page.getByRole('dialog');await config.getByLabel('Feature price in DC').fill('60.25');await config.getByLabel('Reason',{exact:true}).fill('Updated eligible spotlight delivery price');await config.getByRole('checkbox').last().check();await config.getByRole('button',{name:'Confirm configuration',exact:true}).click();await page.getByRole('status').filter({hasText:'Economy configuration saved'}).waitFor();assert.equal(configs[0].p_cost,60.25);assert.equal('rate' in configs[0],false)
await page.goto('http://localhost:5173/admin?view=dc_orders');await page.getByRole('button',{name:'Inspect →',exact:true}).click();await page.getByRole('button',{name:'Refund unfulfilled request in DC',exact:true}).click();const review=page.getByRole('dialog');await review.getByLabel('Reason / internal note').fill('Unable to fulfil this premium request');await review.getByRole('checkbox').check();await review.getByRole('button',{name:'Confirm action',exact:true}).click();await page.getByRole('status').filter({hasText:'completed and audit-logged'}).waitFor();assert.equal(reviews[0].p_complete,false)
for(const path of ['/wallet','/credits','/spend-credits','/admin?view=point_packages','/admin?view=dc_transactions','/admin?view=dc_orders'])for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){await page.setViewportSize({width,height});await page.goto('http://localhost:5173'+path);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${path} ${width} overflow`)}
await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:5173/wallet');await page.locator('.dc-wallet-hero strong').filter({hasText:'180 DC'}).waitFor();await page.screenshot({path:'/home/user/dc-wallet-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/home/user/dc-wallet-desktop.png',fullPage:true})
roleMode='ordinary';await page.goto('http://localhost:5173/admin?view=dc_orders');await page.getByRole('heading',{name:'This workspace is for authorized staff'}).waitFor();assert.deepEqual(exceptions,[]);await browser.close();console.log('DC browser fixtures PASS: server wallet balance, deposit/status filters and pagination, redacted error/retry, exact-rate package display, confirmed spend RPC, catalogue admin and refund confirmation, ordinary-user admin denial, 30 phone/tablet/landscape/desktop checks. Fixtures are not live Auth, provider or bank acceptance.')
