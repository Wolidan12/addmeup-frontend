// Optional real Chromium with mocked Auth/transport. No production data or settlement.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
let browser
const base=process.env.TEST_BASE_URL||'http://localhost:5174'
const id='b0000000-0000-0000-0000-000000000001',exp=Math.floor(Date.now()/1000)+3600
const user={id,email:'guide@example.org',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}}
const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
try{
 for(const signedIn of [false,true]){
  browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
  const context=await browser.newContext(),calls=[],exceptions=[]
  await context.route('https://test.supabase.co/**',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').at(-1);calls.push(name)
   let body={}
   if(name==='user')body=user
   if(name==='site_settings')body={id:true,brand_name:'Danqel Social Boost',enabled_platforms:['instagram'],maintenance_mode:false}
   if(name==='social_platforms')body=[{key:'instagram',label:'Instagram',hosts:['instagram.com']}]
   if(name==='public_directory')body={rows:[],total:0}
   if(name==='promotions')body=[]
   if(name==='member_overview')body={profile:{id,username:'guide_member',display_name:'Guide Member',is_public:false},balance:{balance:0},recent_activity:[],social_count:0,unread_notifications:0,role:'user',restricted:false}
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)})
  })
  if(signedIn)await context.addInitScript(session=>localStorage.setItem('sb-test-auth-token',JSON.stringify(session)),session)
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>exceptions.push(e.message))
  for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){
   await page.setViewportSize({width,height});await page.goto(base+'/how-it-works');await page.getByRole('heading',{name:'New here? Start with your story.'}).waitFor()
   if(signedIn)await page.getByRole('navigation',{name:'Member workspace',exact:true}).waitFor({state:'attached'})
   const before=calls.length
   assert.equal(await page.getByRole('button',{name:'Previous step',exact:true}).isDisabled(),true)
   await page.getByRole('button',{name:/Next step/}).click();await page.locator('.how-sample-social').waitFor();await page.getByRole('button',{name:/Next step/}).click();await page.getByRole('button',{name:'Try sample connection · free',exact:true}).click();await page.getByRole('status').filter({hasText:'No real connection, DC or XP changed'}).waitFor()
   assert.equal(await page.getByRole('button',{name:'Undo sample connection',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'Undo sample connection',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Try sample connection · free',exact:true}).getAttribute('aria-pressed'),'false')
   await page.getByRole('button',{name:'Previous step',exact:true}).click();await page.getByRole('button',{name:'Previous step',exact:true}).click();assert.equal(await page.locator('.how-sample-social').count(),0)
   await page.getByText('Do I have to buy DC to connect?',{exact:true}).click();assert.ok((await page.locator('main').innerText()).includes('Connections and favourites are free.'))
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow '+signedIn+' '+width+'x'+height)
   const cta=page.getByRole('link',{name:signedIn?'Set up my real profile':'Create my account',exact:false});assert.equal(await cta.getAttribute('href'),signedIn?'/settings':'/register')
   assert.ok(calls.slice(before).every(name=>['site_settings','social_platforms','user','member_overview'].includes(name)),'Sample actions must not issue mutation calls')
   assert.equal(await page.locator('main a[href^="http"]').count(),0,'No fictional external profile links')
  }
  if(signedIn){await page.goto(base+'/dashboard');await page.getByRole('region',{name:'New member guide'}).getByRole('link',{name:'Show me the guide'}).click()}
  else {await page.goto(base);await page.locator('main').getByRole('link',{name:'How it works',exact:false}).click()}
  await page.getByRole('heading',{name:'New here? Start with your story.'}).waitFor();assert.deepEqual(exceptions,[]);await browser.close()
 }
 console.log('PASS beginner walkthrough browser fixtures: guest/member access, ten responsive layouts, all three steps/back navigation, local sample connection/undo, FAQ, correct setup CTA, homepage/dashboard discovery, no fictional external links or sample mutation calls. Not live Auth.')
}finally{await browser?.close()}
