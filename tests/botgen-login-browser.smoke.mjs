// Browser + actual Supabase client flow with MOCKED Auth/SQL HTTP endpoints.
// Not a production password login or production owner grant.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
const templates=JSON.parse(await readFile('src/admin/botgen/templates.json','utf8'))
try{
 const context=await browser.newContext(),page=await context.newPage(),calls=[],exceptions=[]
 const id='b0000000-0000-0000-0000-000000000001',exp=Math.floor(Date.now()/1000)+3600
 const user={id,email:'owner@example.org',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}
 const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
 const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
 let credentialMode='invalid',owner=true,ownerMode='ok',role='super_admin'
 await context.route('https://test.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),name=url.pathname.split('/').at(-1);calls.push({name,url:url.href})
  let body=[],status=200
  if(name==='token'){
   if(url.searchParams.get('grant_type')==='refresh_token'){status=400;body={code:'refresh_token_not_found',message:'Fixture session expired'}}
   else if(credentialMode==='invalid'){status=400;body={code:'invalid_credentials',message:'PRIVATE_AUTH_SENTINEL'}}
   else body=session
  }
  if(name==='logout'){await route.fulfill({status:204,body:''});return}
  if(name==='user')body=user
  if(name==='admin_role')body=role
  if(name==='site_settings')body={id:true,brand_name:'Danqel Social Boost',enabled_platforms:[],maintenance_mode:false}
  if(name==='botgen_is_owner'){
   body=owner
   if(ownerMode!=='ok'){status=ownerMode==='missing'?404:403;body={code:ownerMode==='missing'?'PGRST202':'42501',message:'PRIVATE_OWNER_SENTINEL'}}
  }
  if(name==='botgen_templates')body=templates
  await route.fulfill({status,contentType:'application/json',headers:{'content-range':'*/0','x-supabase-api-version':'2024-01-01'},body:JSON.stringify(body)})
 })
 page.on('pageerror',e=>exceptions.push(e.message));page.setDefaultTimeout(15000)
 const base=process.env.TEST_BASE_URL||'http://localhost:5174'
 for(const path of ['/admin/bots','/admin?view=bot_generator']){
  await page.goto(base+path);await page.getByRole('button',{name:'Sign in as owner',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/admin/bots/login');assert.equal(await page.getByRole('link',{name:/register|sign up|create account/i}).count(),0)
 }
 for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){
  await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'owner login layout '+width)
 }
 await page.getByLabel('Owner email',{exact:true}).fill('owner@example.org');await page.getByLabel('Password',{exact:true}).fill('fixture-password-not-real');await page.getByRole('button',{name:'Sign in as owner',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'The email or password is incorrect'}).waitFor();assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'');assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_AUTH_SENTINEL'));assert.equal(calls.filter(c=>c.name==='botgen_templates').length,0)
 credentialMode='valid';owner=false;role='moderator';await page.getByLabel('Password',{exact:true}).fill('fixture-password-not-real');await page.getByRole('button',{name:'Sign in as owner',exact:true}).click();await page.getByRole('heading',{name:'Owner access denied',exact:true}).waitFor();assert.equal(calls.filter(c=>c.name==='botgen_templates').length,0)
 role='super_admin';await page.reload();await page.getByRole('heading',{name:'Owner access denied',exact:true}).waitFor();assert.equal(calls.filter(c=>c.name==='botgen_templates').length,0,'unregistered super-admin denied')
 ownerMode='missing';await page.getByRole('button',{name:'Recheck owner access',exact:true}).click();await page.getByText('Owner access could not be verified. No workspace data has been opened.',{exact:true}).waitFor();assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_OWNER_SENTINEL'));assert.equal(calls.filter(c=>c.name==='botgen_templates').length,0)
 ownerMode='ok';owner=true;await page.getByRole('button',{name:'Recheck owner access',exact:true}).click();await page.getByText('OWNER VERIFIED',{exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('view'),'bot_generator');assert.equal(await page.locator('.bg-cards article').count(),30)
 await page.reload();await page.getByText('OWNER VERIFIED',{exact:true}).waitFor()
 ownerMode='denied';await page.getByRole('button',{name:'Refresh automation',exact:true}).click();await page.getByRole('heading',{name:'Owner service unavailable',exact:true}).waitFor();assert.equal(await page.locator('.bg-cards article').count(),0);assert.equal(await page.getByRole('button',{name:'Configure bot',exact:true}).count(),0)
 ownerMode='ok';await page.getByRole('button',{name:'Retry owner verification',exact:true}).click();await page.getByText('OWNER VERIFIED',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Sign out of Bot Generator',exact:true}).click();await page.getByRole('button',{name:'Sign in as owner',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/admin/bots/login')
 const before=calls.filter(c=>c.name==='botgen_templates').length
 await page.goto(base+'/admin?view=bot_generator');await page.getByRole('button',{name:'Sign in as owner',exact:true}).waitFor();assert.equal(calls.filter(c=>c.name==='botgen_templates').length,before)
 // Expired persisted fixture must fail refresh and never open protected data.
 await page.evaluate(session=>localStorage.setItem('sb-test-auth-token',JSON.stringify({...session,expires_at:1})),session)
 await page.goto(base+'/admin/bots');await page.getByRole('button',{name:'Sign in as owner',exact:true}).or(page.getByRole('heading',{name:'We could not open your account',exact:true})).waitFor();assert.equal(calls.filter(c=>c.name==='botgen_templates').length,before)
 assert.ok(calls.some(c=>c.name==='token'&&c.url.includes('refresh_token')))
 assert.deepEqual(exceptions,[])
 console.log('PASS owner login/routing browser: anonymous deep links, no registration, five layouts, invalid credentials, signed-in nonowner + other-admin denial, missing/denied server lock, owner login+reload, logout, expired refresh denial. Mocked Auth, not real password/session acceptance.')
}finally{await browser.close()}
