// Real local Chromium, mocked Supabase transport/Auth, never production login.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
try{
 const context=await browser.newContext(),page=await context.newPage(),calls=[],exceptions=[]
 const id='b0000000-0000-0000-0000-000000000001',exp=Math.floor(Date.now()/1000)+3600
 const user={id,email:'staff@example.org',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}
 const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
 const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
 let metricsMode='missing',role='super_admin'
 await context.route('https://test.supabase.co/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1);let body={},status=200
  const args=route.request().method()==='POST'?route.request().postDataJSON():null;calls.push({name,args})
  if(name==='user')body=user
  if(name==='admin_role')body=role
  if(name==='site_settings')body={id:true,brand_name:'Danqel Social Boost',enabled_platforms:['instagram'],maintenance_mode:false}
  if(name==='admin_metrics'){
   if(metricsMode==='current')body={registration_series:[{day:'2026-10-31',users:2}],total_users:2}
   else {status=metricsMode==='denied'?403:404;body={code:metricsMode==='denied'?'42501':'PGRST202',message:'PRIVATE_SENTINEL'}}
  }
  if(name==='admin_overview')body={profiles:2,social_links:2,open_reports:0,bank_revenue_kobo:0,trend:[{day:'2026-10-31',users:2}]}
  if(name==='admin_list'){
   if(args.p_resource==='dc_transactions'){status=400;body={code:'P0001',message:'Unsupported resource'}}
   else body={rows:[{id:'original-1',user_id:id,points:15,reason:'Original credit',created_at:'2026-10-31T00:00:00Z'}],total:6}
  }
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
 })
 await context.addInitScript(session=>localStorage.setItem('sb-test-auth-token',JSON.stringify(session)),session)
 page.on('pageerror',e=>exceptions.push(e.message));page.setDefaultTimeout(15000)
 const base=process.env.TEST_BASE_URL||'http://localhost:5174'
 for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){
  await page.setViewportSize({width,height});await page.goto(base+'/admin?view=analytics');await page.getByRole('heading',{name:'Existing database reports',exact:true}).waitFor();assert.equal(await page.getByRole('alert').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 }
 assert.ok(!calls.some(c=>c.name==='admin_list'&&c.args?.p_resource==='analytics'),'analytics never requests a table listing')
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export existing report CSV'}).click();assert.match((await downloadPromise).suggestedFilename(),/existing-records/)
 await page.goto(base+'/admin?view=dc_transactions');await page.getByRole('heading',{name:'This section needs the backend upgrade'}).waitFor();await page.getByRole('button',{name:'View existing rewards ledger'}).click();await page.getByRole('cell',{name:'Original credit',exact:true}).waitFor();assert.equal(await page.getByRole('alert').count(),0)
 metricsMode='denied';const previous=calls.filter(c=>c.name==='admin_overview').length;await page.goto(base+'/admin?view=analytics');await page.getByRole('alert').waitFor();assert.equal(calls.filter(c=>c.name==='admin_overview').length,previous,'denial must not fallback');assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_SENTINEL'));assert.equal(await page.getByRole('button',{name:'Export verified report CSV'}).isDisabled(),true)
 metricsMode='current';await page.goto(base+'/admin?view=analytics');await page.getByText('Total users',{exact:true}).waitFor();assert.equal(await page.getByText('Compatibility mode:',{exact:false}).count(),0)
 role='user';await page.reload();await page.getByRole('heading',{name:'This workspace is for authorized staff'}).waitFor()
 assert.deepEqual(exceptions,[]);console.log('PASS local browser compatibility: legacy metrics/CSV, five responsive layouts, no analytics list call, original ledger navigation, denial no-fallback/no export, modern path and ordinary denial. Mocked Auth, not production login.')
}finally{await browser.close()}
