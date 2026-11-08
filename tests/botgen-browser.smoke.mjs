// Real Chromium, mocked Supabase/Auth. Not live owner acceptance or real execution.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const templates=JSON.parse(await readFile('src/admin/botgen/templates.json','utf8'))
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
try{
 const context=await browser.newContext(),page=await context.newPage(),calls=[],exceptions=[]
 const id='b0000000-0000-0000-0000-000000000001',exp=Math.floor(Date.now()/1000)+3600
 const user={id,email:'owner@example.org',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}
 const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
 const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
 let role='super_admin',owner=true,missing=false;const bots=[],audit=[]
 await context.route('https://test.supabase.co/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1),args=route.request().method()==='POST'?route.request().postDataJSON():null
  calls.push({name,args});let body=[],status=200,count=0
  if(name==='user')body=user
  if(name==='admin_role')body=role
  if(name==='site_settings')body={id:true,brand_name:'Danqel Social Boost',enabled_platforms:[],maintenance_mode:false}
  if(name==='botgen_is_owner'){body=owner;if(missing){status=404;body={code:'PGRST202',message:'PRIVATE_BACKEND_SENTINEL'}}}
  if(name==='botgen_templates')body=templates
  if(name==='botgen_bots'){body=bots;count=bots.length}
  if(name==='botgen_audit')body=audit
  if(name==='botgen_save'){
   const record={id:args.p_id,template_id:args.p_template,name:args.p_name,configuration:args.p_configuration,owner_id:id,status:'CONFIGURED',created_at:new Date().toISOString()}
   const existing=bots.findIndex(b=>b.id===record.id);if(existing>=0)bots[existing]=record;else bots.push(record)
   audit.push({id:crypto.randomUUID(),bot_id:record.id,action:existing<0?'created':'configured',created_at:record.created_at});body=record.id
  }
  if(name==='botgen_delete'){const index=bots.findIndex(b=>b.id===args.p_id);if(index>=0)bots.splice(index,1);body=null}
  await route.fulfill({status,contentType:'application/json',headers:{'content-range':count?`0-${count-1}/${count}`:'*/0'},body:JSON.stringify(body)})
 })
 await context.addInitScript(s=>localStorage.setItem('sb-test-auth-token',JSON.stringify(s)),session)
 page.on('pageerror',e=>exceptions.push(e.message));page.setDefaultTimeout(15000)
 const base=process.env.TEST_BASE_URL||'http://localhost:5174'
 for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){
  await page.setViewportSize({width,height});await page.goto(base+'/admin?view=bot_generator');await page.getByText('OWNER VERIFIED',{exact:true}).waitFor();assert.equal(await page.locator('.bg-cards article').count(),30)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'module layout '+width)
 }
 await page.getByLabel('Search templates',{exact:true}).fill('Status');assert.equal(await page.locator('.bg-cards article').count(),3);await page.getByLabel('Search templates',{exact:true}).fill('')
 const card=page.locator('.bg-cards article').filter({has:page.getByRole('heading',{name:'WhatsApp Audience Builder',exact:true})})
 await card.getByRole('button',{name:'Configure bot',exact:true}).click();await page.getByLabel('Bot name',{exact:true}).fill('Owner audience')
 await page.getByLabel('Audience name',{exact:true}).fill('Opted-in subscribers');await page.getByLabel('Consent source',{exact:true}).fill('Verified form consent')
 await page.getByRole('button',{name:'Save configuration',exact:true}).click();await page.getByRole('heading',{name:'Owner audience',exact:true}).waitFor();assert.equal(calls.filter(c=>c.name==='botgen_save').length,1)
 await page.reload();await page.getByText('OWNER VERIFIED',{exact:true}).waitFor();await page.getByRole('button',{name:'My bots',exact:true}).click();await page.getByRole('heading',{name:'Owner audience',exact:true}).waitFor()
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export metadata',exact:true}).click();const download=await downloadPromise;const exported=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(exported.name,'Owner audience');assert.equal('configuration' in exported,false)
 await page.getByRole('button',{name:'Edit configuration',exact:true}).click();assert.equal(await page.getByLabel('Consent source',{exact:true}).inputValue(),'Verified form consent');await page.getByRole('button',{name:'Cancel editing',exact:true}).click()
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete configuration',exact:true}).click();await page.getByText('No configurations on this page.',{exact:true}).waitFor()
 owner=false;await page.reload();await page.getByRole('heading',{name:'Owner authorization required',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Configure bot',exact:true}).count(),0)
 missing=true;await page.getByRole('button',{name:'Recheck access',exact:true}).click();await page.getByRole('heading',{name:'Owner service unavailable',exact:true}).waitFor();assert.equal(await page.locator('.bg-cards article').count(),0);assert.equal(await page.getByRole('button',{name:'Configure bot',exact:true}).count(),0);assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_BACKEND_SENTINEL'))
 role='moderator';const previous=calls.filter(c=>c.name==='botgen_is_owner').length;await page.reload();await page.getByRole('heading',{name:'Permission required',exact:true}).waitFor();assert.equal(calls.filter(c=>c.name==='botgen_is_owner').length,previous)
 assert.ok(!calls.some(c=>c.name==='admin_list'&&c.args?.p_resource==='bot_generator'));assert.deepEqual(exceptions,[])
 console.log('PASS bot module browser fixtures: five responsive layouts, catalogue search, persisted save/reload/edit, metadata-only export, delete, owner-only and moderator denial, missing-backend controls disabled; no activation or messaging claims.')
}finally{await browser.close()}
