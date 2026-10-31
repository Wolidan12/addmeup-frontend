// Real local Chromium with explicit network/session fixtures, not production Auth.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
try{
 const context=await browser.newContext(),page=await context.newPage(),calls=[],exceptions=[]
 const id='b0000000-0000-0000-0000-000000000001',exp=Math.floor(Date.now()/1000)+3600
 const profile={id,username:'member_fixture',display_name:'Member Fixture',bio:'Member biography',country:'NG',interests:['music'],avatar_url:null,is_public:true}
 const user={id,email:'member@example.org',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}
 const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
 const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
 let overviewMode='valid',walletMode='missing',missingBalance=false
 await context.route('https://test.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),name=url.pathname.split('/').at(-1);let data=[],status=200
  calls.push({name,url:url.href})
  if(name==='site_settings')data={id:true,brand_name:'Danqel Social Boost',enabled_platforms:['instagram'],maintenance_mode:false}
  if(name==='user')data=user
  if(name==='member_overview')data={profile,balance:overviewMode==='malformed'?null:{user_id:id,balance:90,current_streak:0,last_checkin:null},recent_activity:[],social_count:0,referral_count:0,profile_views:0,unread_notifications:0,restricted:false,role:'user'}
  if(name==='public_directory')data={rows:[],total:0}
  if(name==='dc_wallet'){status=walletMode==='denied'?403:404;data={code:walletMode==='denied'?'42501':'PGRST202',message:'PRIVATE_WALLET_SENTINEL'}}
  if(name==='points_balance')data=missingBalance?null:{balance:90}
  if(name==='points_ledger')data=[{id:'original-credit',user_id:id,points:15,reason:'Original preserved credit',created_at:'2026-10-31T00:00:00Z'}]
  if(name==='bank_point_orders')data=[]
  await route.fulfill({status,contentType:'application/json',headers:{'content-range':name==='points_ledger'?'0-0/6':'*/0'},body:JSON.stringify(data)})
 })
 await context.addInitScript(session=>localStorage.setItem('sb-test-auth-token',JSON.stringify(session)),session)
 page.on('pageerror',e=>exceptions.push(e.message));page.setDefaultTimeout(15000)
 const base=process.env.TEST_BASE_URL||'http://localhost:5174'
 for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){
  await page.setViewportSize({width,height});await page.goto(base+'/dashboard');await page.getByRole('heading',{name:/Hey, Member Fixture/}).waitFor();await page.locator('.member-wallet-chip').filter({hasText:'90'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'dashboard layout '+width)
  await page.goto(base+'/wallet');await page.getByRole('heading',{name:'Original credit ledger'}).waitFor();await page.getByRole('cell',{name:'Original preserved credit',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'wallet layout '+width)
 }
 for(const call of calls.filter(c=>['points_balance','points_ledger','bank_point_orders'].includes(c.name)))assert.equal(new URL(call.url).searchParams.get('user_id'),'eq.'+id)
 await page.getByRole('button',{name:'Deposits',exact:true}).click();await page.getByRole('heading',{name:'Existing deposit records'}).waitFor();await page.getByLabel('Deposit status').selectOption('approved');await page.getByRole('heading',{name:'Existing deposit records'}).waitFor();assert.ok(calls.some(c=>c.name==='bank_point_orders'&&new URL(c.url).searchParams.get('status')==='eq.approved'))
 missingBalance=true;await page.reload();await page.getByText('Balance unavailable',{exact:true}).waitFor();missingBalance=false
 walletMode='denied';const count=calls.filter(c=>c.name==='points_ledger').length;await page.reload();await page.getByRole('alert').waitFor();assert.equal(calls.filter(c=>c.name==='points_ledger').length,count);assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_WALLET_SENTINEL'))
 overviewMode='malformed';await page.goto(base+'/dashboard');await page.getByRole('alert').filter({hasText:'No balance is shown'}).waitFor();assert.match(await page.locator('.member-wallet-chip').innerText(),/—/);assert.equal(await page.getByRole('button',{name:'Check in',exact:true}).isDisabled(),true)
 overviewMode='valid';await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('heading',{name:/Hey, Member Fixture/}).waitFor();await page.locator('.member-wallet-chip').filter({hasText:'90'}).waitFor()
 assert.deepEqual(exceptions,[]);console.log('PASS member browser fixtures: dashboard and read-only wallet at five sizes, original history, owner filters, deposit filters, missing balance not zero, denial without fallback, malformed overview no crash/stale balance, Retry recovery. Not a production login.')
}finally{await browser.close()}
