// Real local Chromium; mocked transport/Auth only, never production profile writes.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
import {feedListingPackages} from '../src/lib/feedListingPackages.js'
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
try{
 const context=await browser.newContext(),page=await context.newPage(),calls=[],writes=[],exceptions=[]
 const id='b0000000-0000-0000-0000-000000000001',exp=Math.floor(Date.now()/1000)+3600
 const user={id,email:'simple@example.org',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}}
 const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
 const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
 const profile={id,username:'simple_member',display_name:'Simple Member',bio:'My intro',country:'NG',location:'Lagos',interests:['music'],categories:['creator'],avatar_url:null,is_public:false}
 let links=[],fail=false,restricted=false
 await context.route('https://test.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),name=url.pathname.split('/').at(-1),method=route.request().method(),args=['POST','PATCH','PUT'].includes(method)?route.request().postDataJSON():null;calls.push({name,method,args,url:url.toString()});let body={},status=200
  if(name==='user')body=user
  if(name==='site_settings')body={id:true,brand_name:'Danqel Social Boost',enabled_platforms:['instagram','whatsapp'],maintenance_mode:false}
  if(name==='social_platforms')body=[{key:'instagram',label:'Instagram',hosts:['instagram.com']},{key:'whatsapp',label:'WhatsApp',hosts:['wa.me']}]
  if(name==='member_overview')body={profile,balance:{balance:0},recent_activity:[],social_count:links.length,unread_notifications:0,role:'user',restricted}
  if(name==='my_feed_listing')body={enabled:true,server_now:new Date().toISOString(),purchased_dc:0,total_dc:0,profile_ready:false,in_feed:false,active_until:null,packages:feedListingPackages.map(p=>({key:p.key,label:p.label,cost_dc:p.costDC,duration_hours:p.durationHours})),rows:[],total:0}
  if(name==='notification_inbox')body={rows:[],total:0,unread:0}
  if(name==='profiles'&&method==='PATCH'){writes.push(args);await new Promise(r=>setTimeout(r,250));if(fail){status=403;body={code:'42501',message:'PRIVATE_SENTINEL'}}else{Object.assign(profile,args);body=[{id}]}}
  if(name==='social_links'){if(method==='POST'){const row={...args,id:'fixture-link'};links=[row];body=row}else if(method==='DELETE'){links=[];body=[{id:'fixture-link'}]}else body=links}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
 })
 await context.addInitScript(s=>localStorage.setItem('sb-test-auth-token',JSON.stringify(s)),session)
 page.setDefaultTimeout(15000);page.on('pageerror',e=>exceptions.push(e.message))
 const base=process.env.TEST_BASE_URL||'http://localhost:5174'
 for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){
  await page.setViewportSize({width,height});await page.goto(base+'/settings');await page.getByRole('button',{name:'Save profile',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.simple-profile-fields')?.disabled)
  assert.equal(await page.locator('form.simple-profile-form input:visible:not([type="checkbox"])').count(),1,'Only display name shown by default')
  assert.equal(await page.getByLabel('Country',{exact:true}).isVisible(),false);assert.equal(await page.locator('.account-progress').isVisible(),false)
  await page.getByLabel('Display name',{exact:true}).fill('Updated Member');await page.getByLabel('Bio',{exact:true}).fill('')
  const before=writes.length;await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.locator('form.simple-profile-form').getByRole('button',{name:'Saving…',exact:true}).waitFor();await page.locator('form.simple-profile-form').evaluate(f=>{f.requestSubmit();f.requestSubmit()});await page.getByRole('status').filter({hasText:'Your profile has been updated.'}).waitFor();assert.equal(writes.length,before+1)
  for(const key of ['username','country','location','interests','categories','balance','role','avatar_url'])assert.ok(!(key in writes.at(-1)),key)
  assert.equal(profile.username,'simple_member');assert.equal(profile.country,'NG');assert.deepEqual(profile.interests,['music']);assert.equal(profile.bio,'')
  await page.getByText('All listing packages & terms',{exact:true}).click();assert.equal(await page.locator('.simple-feed-prices>div').count(),8);assert.match(await page.locator('.simple-feed-prices').innerText(),/66,200 DC/);assert.equal(await page.getByRole('button',{name:'Review listing purchase',exact:true}).isDisabled(),true)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Overflow '+width+'x'+height)
 }
 await page.getByText('Optional details & username',{exact:true}).click();await page.getByLabel('Location (optional)',{exact:true}).fill('Abuja');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('status').filter({hasText:'Your profile has been updated.'}).waitFor();assert.equal(writes.at(-1).location,'Abuja');assert.ok(!('country' in writes.at(-1)))
 await page.getByLabel('Username',{exact:true}).fill('x');await page.getByText('Optional details & username',{exact:true}).click();await page.getByRole('button',{name:'Save profile',exact:true}).click();assert.equal(await page.getByLabel('Username',{exact:true}).isVisible(),true,'Invalid hidden username must reopen optional details');await page.getByLabel('Username',{exact:true}).fill('simple_member')
 await page.getByRole('button',{name:'Instagram',exact:true}).click();await page.getByLabel('Instagram profile URL',{exact:true}).fill('https://instagram.com.evil.example/member');await page.getByRole('button',{name:'Save social link',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(links.length,0)
 await page.getByLabel('Instagram profile URL',{exact:true}).fill('https://instagram.com/simple_member');await page.getByRole('button',{name:'Save social link',exact:true}).click();await page.getByRole('status').filter({hasText:'Social link saved.'}).waitFor();assert.equal(links[0].is_public,false);await page.getByLabel('Make this link public',{exact:true}).check();await page.getByRole('button',{name:'Save social link',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.account-links')?.textContent.includes('Public link'));assert.equal(links[0].is_public,true)
 fail=true;await page.getByLabel('Display name',{exact:true}).fill('Retry Member');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('alert').waitFor();assert.ok(!(await page.locator('main').innerText()).includes('PRIVATE_SENTINEL'));fail=false;await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('status').filter({hasText:'Your profile has been updated.'}).waitFor();assert.equal(profile.display_name,'Retry Member')
 restricted=true;await page.reload();await page.getByRole('heading',{name:'1. Your profile',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Save profile',exact:true}).isDisabled(),true)
 for(const c of calls.filter(c=>c.name==='profiles'&&c.method==='PATCH'))assert.ok(c.url.includes('id=eq.'+id))
 assert.ok(!calls.some(c=>/buy_|purchase|admin_|deposit|listing_order/.test(c.name)));assert.deepEqual(exceptions,[])
 console.log('PASS simple profile browser fixtures: five layouts, only basic visible fields, blank optional bio, preserved hidden extras/username, duplicate save guard, explicit optional edit, invalid hidden field recovery, real-link validation/private default/public opt-in, sanitized failure/retry, restriction/owner filters, eight read-only prices and no financial mutation. Not live Auth.')
}finally{await browser.close()}
