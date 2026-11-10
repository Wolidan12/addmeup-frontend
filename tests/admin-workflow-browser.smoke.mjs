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
const publicSocialLink={id:'member-whatsapp-link',profile_id:target,platform:'whatsapp',url:'https://wa.me/1234567890',is_public:true}
const site={id:true,brand_name:'Danqel Social Boost',hero_title:'Good connections. Greater reach.',hero_description:'Meet the community.',enabled_platforms:['instagram','whatsapp'],maintenance_mode:false}
const user={id,email:'fixture@example.org',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}
const exp=Math.floor(Date.now()/1000)+3600,jwt=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
let directoryMode='current',detailMode='missing',overviewReadsOnly=0,metricCalls=0,depositReads=0;const directoryCalls=[];
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
 if(name==='admin_overview'){overviewReadsOnly++;json={profiles:1,social_links:1,open_reports:0,pending_bank_orders:1,trend:[]}}
 if(name==='admin_metrics')metricCalls++
 if(name==='admin_user_directory'){
  directoryCalls.push(route.request().postDataJSON())
  if(directoryMode!=='current'){await route.fulfill({status:directoryMode==='legacy'?404:403,json:{code:directoryMode==='legacy'?'PGRST202':'42501',message:'PRIVATE_INTERNAL_SENTINEL'}});return}
  json={rows:[{...creator,email:'creator@example.org',email_confirmed:true,suspended:false,staff_role:'user'}],total:1}
 }
 if(name==='admin_user_detail'){await route.fulfill({status:detailMode==='missing'?404:403,json:{code:detailMode==='missing'?'PGRST202':'42501',message:'PRIVATE_INTERNAL_SENTINEL'}});return}
 if(name==='social_links')json=[publicSocialLink]
 if(name==='admin_update_member_social_link'){const body=route.request().postDataJSON();calls.push(body);publicSocialLink.url=body.p_url;json=null}

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
 if(name==='admin_manual_deposits')depositReads++;
 if(name==='admin_manual_deposits')json={rows:[bank],total:1,gross_kobo:0,refunded_kobo:0,net_kobo:0}
 if(name==='admin_confirm_manual_deposit'){calls.push(route.request().postDataJSON());bank.status='approved';json=null}
 if(name==='dc_wallet')json={balance:wallet,rows:[],total:0,kind:'transactions'}
 if(name==='admin_list')json={rows:[creator],total:1}
 if(name==='my_feed_listing')json={packages:[],rows:[],total:0,purchased_dc:0,total_dc:wallet,profile_ready:true,enabled:true,in_feed:false}
 await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'*/0'},body:JSON.stringify(json)})
})
const goto=async path=>{await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.locator('h1').first().waitFor()}
try{
 await page.clock.install()
 await goto('/');await page.evaluate(s=>localStorage.setItem('sb-test-auth-token',JSON.stringify(s)),session)
 await page.setViewportSize({width:390,height:844});await goto('/admin')
 await page.getByRole('heading',{name:'Existing database reports'}).waitFor();assert.equal(metricCalls,0,'Reuse overview, do not probe and refetch duplicate metrics')
 const daily=page.getByRole('navigation',{name:'Daily admin tasks'})
 await daily.getByRole('button',{name:'Users',exact:true}).click();await page.getByRole('button',{name:'Open user',exact:true}).waitFor()
 const search=page.getByRole('textbox',{name:'Search username, email or member UUID',exact:true})
 await search.fill('creator@example.org');await page.getByLabel('Filter records',{exact:true}).selectOption('verified')
 await page.waitForFunction(()=>location.search.includes('q=creator')&&location.search.includes('status=verified'))
 await page.waitForTimeout(600);assert.equal(directoryCalls.at(-1).p_search,'creator@example.org');assert.equal(directoryCalls.at(-1).p_status,'verified')
 await page.reload();await page.getByRole('button',{name:'Open user',exact:true}).waitFor();assert.match(page.url(),/q=creator/);assert.equal(await page.getByLabel('Filter records',{exact:true}).inputValue(),'verified')
 await page.getByRole('button',{name:'Open user',exact:true}).click();let dlg=page.getByRole('dialog');await dlg.getByText('Showing the protected user-list record.',{exact:false}).waitFor();assert.match(await dlg.innerText(),/Listed creator/)
 await dlg.getByRole('button',{name:'social',exact:true}).click();await dlg.getByRole('heading',{name:'WhatsApp',exact:true}).waitFor();await dlg.getByRole('button',{name:'Correct public link',exact:true}).click()
 let editor=dlg.getByRole('form',{name:'Correct public WhatsApp link'});await editor.getByLabel('New WhatsApp number or wa.me link').fill('+234 800 123 4567');await editor.getByLabel('Reason for correction').fill('Member asked us to correct a typo and verified the new number.');await editor.getByRole('checkbox',{name:/I confirm the member requested this correction/}).check();await editor.getByRole('button',{name:'Save verified correction'}).click();await dlg.getByText('WhatsApp link corrected. The public profile now uses the updated link.').waitFor();assert.equal(publicSocialLink.url,'https://wa.me/2348001234567');assert.equal(calls.at(-1).p_member_confirmed,true);assert.match(calls.at(-1).p_reason,/Member asked us/);assert.ok(calls.at(-1).p_request)
 await dlg.getByRole('button',{name:'profile',exact:true}).click();await dlg.getByText('Manage this user',{exact:true}).click();await dlg.getByRole('button',{name:'Edit profile details',exact:true}).click();dlg=page.getByRole('dialog');await dlg.getByRole('heading',{name:'Edit user profile',exact:true}).waitFor();await dlg.getByRole('button',{name:'Cancel',exact:true}).click()
 await daily.getByRole('button',{name:'Deposits',exact:true}).click();await page.getByRole('button',{name:'Approve',exact:true}).waitFor();assert.match(page.url(),/status=submitted/)
 assert.equal(await page.locator('.admin-bank-summary').getAttribute('open'),null)
 let bounds=await page.getByRole('button',{name:'Approve',exact:true}).boundingBox();assert.ok(bounds.y+bounds.height<844,'Review action is above the fold on a phone')
 await page.goBack();await page.getByRole('button',{name:'Open user',exact:true}).waitFor();assert.match(page.url(),/q=creator/)
 await page.getByRole('button',{name:'Clear search & filters'}).click();await page.waitForTimeout(500);assert.equal(new URL(page.url()).searchParams.has('q'),false)
 await page.getByRole('button',{name:'Toggle navigation'}).click();await page.getByLabel('Find an admin tool',{exact:true}).fill('deposit');await page.locator('.admin-tool-results').getByRole('button',{name:'Deposits and Payments'}).click()
 await page.getByRole('button',{name:'Approve',exact:true}).waitFor();await page.getByRole('button',{name:'Approve',exact:true}).click();dlg=page.getByRole('dialog');await dlg.getByLabel('Bank-statement reference',{exact:true}).fill('KEEP-MY-REFERENCE')
 const reads=depositReads;await page.clock.fastForward(61000);assert.equal(depositReads,reads,'No background refresh while reviewing');assert.equal(await dlg.getByLabel('Bank-statement reference',{exact:true}).inputValue(),'KEEP-MY-REFERENCE');await dlg.getByRole('button',{name:'Cancel',exact:true}).click()
 await page.getByText('Bank statement checks, dates & funding totals',{exact:true}).click();await page.getByLabel('From date (UTC)').fill('2026-01-01');await page.getByLabel('To date (UTC)').fill('2026-12-31');assert.match(page.url(),/from=2026-01-01/);assert.match(page.url(),/to=2026-12-31/)
 for(const [width,height] of [[320,800],[390,844],[844,390],[1440,1000]]){await page.setViewportSize({width,height});for(const mode of ['light','dark']){if(await page.locator('html').getAttribute('data-theme')!==mode)await page.getByRole('button',{name:`Switch to ${mode} theme`}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} ${mode} overflow`)}}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/home/user/admin-workflow-mobile.png',fullPage:true})
 directoryMode='legacy';await goto('/admin?view=profiles');await page.getByRole('textbox',{name:'Search username',exact:true}).waitFor();await page.getByText('This server supports username search only.',{exact:false}).waitFor();assert.equal(await page.getByLabel('Filter records',{exact:true}).count(),0)
 directoryMode='denied';await page.reload();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'Open user',exact:true}).count(),0)
 assert.equal((await page.locator('body').innerText()).includes('PRIVATE_INTERNAL_SENTINEL'),false);assert.deepEqual(errors,[])
 console.log('PASS admin workflow Chromium fixtures: mobile task shortcuts/tool search, above-fold review queue, persistent URL search/status/dates/back/reload/clear, one-click user profile with missing-only snapshot, no duplicate overview metrics requests, no refresh/input loss during review, truthful legacy search/no denied fallback, 320–1440 light/dark layouts. Not production sign-in or settlement proof.')
}finally{await browser.close()}
