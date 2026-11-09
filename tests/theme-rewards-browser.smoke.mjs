// Explicit network fixtures only. SQL accounting is tested separately; never live money.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),base=process.env.TEST_BASE_URL||'http://localhost:5174'
page.setDefaultTimeout(12000)
const id='b0000000-0000-0000-0000-000000000001',target='b0000000-0000-0000-0000-000000000002',order='d0000000-0000-0000-0000-000000000001',errors=[],calls=[]
const profile={id,username:'test_member',display_name:'Test member',bio:'A genuine community',country:'NG',interests:[],is_public:true,avatar_url:null}
const creator={...profile,id:target,username:'listed_creator',display_name:'Listed creator',managed:false,is_connected:false,is_saved:false,feed_listing_paid:true,feed_ends_at:new Date(Date.now()+86400000).toISOString(),social_links:[{id:'link',platform:'instagram',url:'https://instagram.com/creator',is_public:true}]}
const site={id:true,brand_name:'Danqel Social Boost',hero_title:'Good connections. Greater reach.',hero_description:'Meet the community.',enabled_platforms:['instagram','whatsapp'],maintenance_mode:false}
const user={id,email:'fixture@example.org',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}
const exp=Math.floor(Date.now()/1000)+3600,jwt=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
let wallet=90,role='super_admin',rewardStatus='granted',failRelationship=false,overviewReads=0
const bank={id:order,user_id:target,username:'payer_creator',payer_name:'Payer creator',email:'payer@example.org',points:1000,amount_kobo:100000,bank_name:'MONIEPOINT',account_name:'LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST',account_number:'6977298247',status:'submitted',created_at:new Date().toISOString()}
page.on('pageerror',e=>errors.push(e.message))
await ctx.route('https://test.supabase.co/**',async route=>{
 const path=new URL(route.request().url()).pathname,name=path.split('/').at(-1);let json=[]
 if(name==='site_settings')json=site
 if(name==='social_platforms')json=[{key:'instagram',label:'Instagram',hosts:['instagram.com']},{key:'whatsapp',label:'WhatsApp',hosts:['wa.me']}]
 if(name==='user')json=user
 if(name==='profiles')json=profile
 if(name==='member_overview'){overviewReads++;json={profile,balance:{balance:wallet,referral_code:'DQ-TEST',current_streak:0,last_checkin:null},social_count:1,profile_views:0,referral_count:0,referral_earnings:0,referral_percent:0,recent_activity:[],unread_notifications:0,pending_orders:0,restricted:false,role}}
 if(name==='admin_role')json=role
 if(name==='public_directory')json={feed_policy:'purchased_dc_v1',server_now:new Date().toISOString(),total:1,rows:[creator],paid_rows:[]}
 if(name==='discovery_profile')json=creator
 if(name==='launch_status')json={status:'complete',remaining_slots:0,total_slots:50,awarded_count:50,total_distributed_dc:250000,reward_dc:5000,eligibility:{registered:false,verified:false,profile_complete:false,already_awarded:false}}
 if(name==='discovery_relationship'){
  const body=route.request().postDataJSON();calls.push(body)
  if(failRelationship){await route.fulfill({status:500,json:{message:'PRIVATE_INTERNAL_SENTINEL'}});return}
  let reward=0;if(body.p_action==='connect'){creator.is_connected=body.p_enabled;if(body.p_enabled&&rewardStatus==='granted'){wallet+=7;reward=7}}
  if(body.p_action==='save')creator.is_saved=body.p_enabled
  json={action:body.p_action,enabled:body.p_enabled,reward_dc:reward,reward_status:body.p_action==='connect'&&body.p_enabled?rewardStatus:'not_applicable',daily_limit:50,balance:wallet}
 }
 if(name==='discovery_connections')json={rows:[{profile_id:target,profile:creator}],total:1}
 if(name==='admin_manual_deposits')json={rows:[bank],total:1,gross_kobo:0,refunded_kobo:0,net_kobo:0}
 if(name==='admin_confirm_manual_deposit'){calls.push(route.request().postDataJSON());bank.status='approved';json=null}
 if(name==='dc_wallet')json={balance:wallet,rows:[],total:0,kind:'transactions'}
 if(name==='admin_list')json={rows:[],total:0}
 if(name==='my_feed_listing')json={packages:[],rows:[],total:0,purchased_dc:0,total_dc:wallet,profile_ready:true,enabled:true,in_feed:false}
 await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'*/0'},body:JSON.stringify(json)})
})
const goto=async path=>{await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Switch to .* theme/}).waitFor();await page.locator('h1').first().waitFor()}
const theme=async mode=>{const current=await page.locator('html').getAttribute('data-theme');if(current!==mode)await page.getByRole('button',{name:`Switch to ${mode} theme`}).click();await page.waitForFunction(m=>document.documentElement.dataset.theme===m,mode)}
const overflow=async label=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label)
try{
 await goto('/');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await theme('light')
 assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)')
 assert.equal(await page.locator('.landing-editorial h1 em').evaluate(e=>getComputedStyle(e).backgroundClip),'text');await page.screenshot({path:'/home/user/theme-home-light.png',fullPage:true})
 for(const path of ['/','/login','/register','/how-it-works','/support']){await goto(path);assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await overflow(path);await page.setViewportSize({width:390,height:844});await overflow(path+' mobile');await page.setViewportSize({width:1440,height:1000})}
 // The head preference script works even when the React entry cannot load.
 const firstPaint=await ctx.newPage();await firstPaint.route('**/src/main.jsx',r=>r.abort());await firstPaint.goto(base+'/login',{waitUntil:'domcontentloaded'});assert.equal(await firstPaint.locator('html').getAttribute('data-theme'),'light');await firstPaint.close()
 await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.locator('html').getAttribute('data-theme'),'light')
 await page.evaluate(s=>localStorage.setItem('sb-test-auth-token',JSON.stringify(s)),session)
 await goto('/discover');await page.getByRole('button',{name:'Connect · free',exact:true}).waitFor();const reads=overviewReads;await page.getByRole('button',{name:'Connect · free',exact:true}).click();await page.getByRole('status').filter({hasText:'+7 reward DC'}).waitFor();assert.ok(overviewReads>reads);assert.equal(wallet,97);await page.getByRole('button',{name:'Disconnect',exact:true}).waitFor()
 await page.getByRole('button',{name:'Disconnect',exact:true}).click();await page.getByRole('button',{name:'Connect · free',exact:true}).waitFor();rewardStatus='already_processed';await page.getByRole('button',{name:'Connect · free',exact:true}).click();await page.getByRole('status').filter({hasText:'already processed'}).waitFor();assert.equal(wallet,97)
 await page.getByRole('button',{name:'Disconnect',exact:true}).click();await page.getByRole('button',{name:'Connect · free',exact:true}).waitFor();rewardStatus='daily_cap';await page.getByRole('button',{name:'Connect · free',exact:true}).click();await page.getByRole('status').filter({hasText:'50 rewarded connections'}).waitFor();assert.equal(wallet,97)
 await page.getByRole('button',{name:'Disconnect',exact:true}).click();await page.getByRole('button',{name:'Connect · free',exact:true}).waitFor();failRelationship=true;await page.getByRole('button',{name:'Connect · free',exact:true}).click();await page.getByRole('status').filter({hasText:'could not be updated'}).waitFor();assert.equal(await page.getByRole('button',{name:'Connect · free',exact:true}).getAttribute('aria-pressed'),'false');failRelationship=false
 assert.equal((await page.locator('body').innerText()).includes('PRIVATE_INTERNAL_SENTINEL'),false)
 for(const path of ['/dashboard','/wallet','/connections','/settings']){await goto(path);await overflow(path);await page.setViewportSize({width:390,height:844});await overflow(path+' mobile');await page.setViewportSize({width:1440,height:1000})}
 await goto('/admin?view=bank_point_orders');await page.getByRole('button',{name:'Approve',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Inspect →',exact:true}).count(),0)
 for(const [width,height] of [[320,800],[390,844],[844,390],[1024,768],[1440,1000]]){await page.setViewportSize({width,height});await overflow('bank '+width);const approve=page.getByRole('button',{name:'Approve',exact:true});await approve.waitFor();assert.ok((await approve.boundingBox()).height>=44);if(width<1024)assert.equal(await page.locator('.bank-mobile-card').count(),1)}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/home/user/theme-admin-light.png',fullPage:true})
 await page.getByRole('button',{name:'Approve',exact:true}).click();let dlg=page.getByRole('dialog');await dlg.getByLabel('Bank-statement reference',{exact:true}).waitFor();assert.ok(await dlg.getByRole('button',{name:'Approve',exact:true}).isDisabled());await dlg.getByRole('button',{name:'Cancel',exact:true}).click()
 await page.getByRole('button',{name:'Decline',exact:true}).click();dlg=page.getByRole('dialog');await dlg.getByRole('heading',{name:/Decline/}).waitFor();await dlg.getByRole('button',{name:'Cancel',exact:true}).click()
 bank.user_id=id;await page.getByRole('button',{name:'↻ Refresh',exact:true}).click();await page.getByText('Another authorized administrator must review your own deposit.').filter({visible:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0)
 await theme('dark');await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.locator('html').getAttribute('data-theme'),'dark')
 role='user';await goto('/admin?view=bank_point_orders');await page.getByRole('heading',{name:'This workspace is for authorized staff'}).waitFor();assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0)
 assert.deepEqual(errors,[]);console.log('PASS Chromium fixtures: public/auth/member/admin persisted white-blue + original dark theme, 320–1440 responsive layouts, front-row 44px Approve/Decline and self/ordinary denials, statement dialog, server-confirmed 7 DC/wallet refresh, reconnect/cap/error notices. Not live authentication, settlement or SQL concurrency proof.')
}finally{await browser.close()}
