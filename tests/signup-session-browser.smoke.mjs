// Optional Chromium fixture test. Never creates a production account.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
const base=process.env.TEST_BASE_URL||'http://localhost:5174'
const id='b0000000-0000-0000-0000-000000000001',exp=Math.floor(Date.now()/1000)+3600
const user={id,email:'signup@example.org',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}}
const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
for(const mode of ['session','no-session','error']){
 const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),calls=[],exceptions=[]
  await context.route('https://test.supabase.co/**',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').at(-1);calls.push({name,args:route.request().postDataJSON()});let body={},status=200
   if(name==='user')body=user
   if(name==='site_settings')body={id:true,brand_name:'Danqel Social Boost',enabled_platforms:['instagram'],maintenance_mode:false}
   if(name==='social_platforms')body=[{key:'instagram',label:'Instagram',hosts:['instagram.com']}]
   if(name==='is_username_available')body=true
   if(name==='signup'){body=mode==='session'?session:{user};if(mode==='error'){status=422;body={code:'user_already_exists',msg:'PRIVATE_SENTINEL'}}}
   if(name==='public_directory')body={rows:[],total:0}
   if(name==='member_overview')body={profile:{id,username:'signup_fixture',display_name:'Signup Fixture',is_public:false},balance:{balance:0},recent_activity:[],social_count:0,unread_notifications:0,role:'user',restricted:false}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  })
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>exceptions.push(e.message))
  await page.goto(base+'/register');await page.getByLabel('Full name',{exact:true}).fill('Signup Fixture');await page.getByLabel('Username',{exact:true}).fill('signup_fixture');await page.getByLabel('Email address',{exact:true}).fill('signup@example.org');await page.getByLabel('Create a password',{exact:true}).fill('fixture-password-only');await page.getByLabel('Confirm password',{exact:true}).fill('fixture-password-only');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create my account',exact:true}).click()
  if(mode==='session'){await page.getByRole('heading',{name:/Hey, Signup Fixture/}).waitFor();assert.equal(new URL(page.url()).pathname,'/dashboard');await page.reload();await page.getByRole('heading',{name:/Hey, Signup Fixture/}).waitFor()}
  else if(mode==='no-session'){await page.getByRole('status').filter({hasText:'Continue by signing in'}).waitFor();assert.equal(new URL(page.url()).pathname,'/register');assert.equal(await page.getByRole('link',{name:'Continue to sign in',exact:true}).getAttribute('href'),'/login');assert.equal(await page.locator('a[href="/verify"]').count(),0)}
  else {await page.getByRole('alert').waitFor();assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_SENTINEL'));assert.equal(new URL(page.url()).pathname,'/register')}
  assert.equal(calls.filter(c=>c.name==='signup').length,1);assert.ok(!calls.some(c=>c.name==='resend'));assert.deepEqual(exceptions,[])
 }finally{await browser.close()}
}
console.log('PASS signup browser fixtures: auto-confirm session opens dashboard and survives reload, no-session stays unauthenticated with sign-in option, duplicate/error is sanitized; no confirmation resend or fabricated session. Not a live signup test.')
