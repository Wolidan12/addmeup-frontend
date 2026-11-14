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
let directoryMode='current',detailMode='missing',overviewReadsOnly=0,metricCalls=0,depositReads=0;const directoryCalls=[];
let wallet=90,role='super_admin',rewardStatus='granted',failRelationship=false,overviewReads=0
const bank={id:order,user_id:target,username:'payer_creator',payer_name:'Payer creator',email:'payer@example.org',points:1000,amount_kobo:100000,bank_name:'MONIEPOINT',account_name:'LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST',account_number:'6977298247',status:'submitted',created_at:new Date().toISOString()}
let listings=[],failedPublication=false,saveCalls=[],bulkCalls=[];
const project=r=>({...r,managed:true,social_links:r.social_links.filter(l=>l.is_public)});
page.on('pageerror',e=>errors.push(e.message))
await ctx.route('https://test.supabase.co/**',async route=>{
 const path=new URL(route.request().url()).pathname,name=path.split('/').at(-1);let json=[]
 if(path.startsWith('/storage/v1/object/managed-avatars/')&&route.request().method()==='POST'){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({Key:path})});return}
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

 if(name==='public_directory'){const q=route.request().postDataJSON().p_search||'';const rows=failedPublication?[]:listings.filter(r=>r.is_public&&(!q||(q.startsWith('@')?r.username===q.slice(1):r.username.includes(q)))).map(project);json={feed_policy:'purchased_dc_with_admin_exception_v1',total:rows.length,rows,paid_rows:[]}}
 if(name==='admin_save_managed_profile'){const b=route.request().postDataJSON();saveCalls.push(b);const row={...b.p_data,id:b.p_id,created_at:new Date().toISOString()};listings=listings.filter(r=>r.id!==b.p_id).concat(row);json=b.p_id}
 if(name==='admin_bulk_create_managed_profiles'){const b=route.request().postDataJSON();bulkCalls.push(b);const ids=b.p_rows.map((r,i)=>'c0000000-0000-0000-0000-'+String(i+1).padStart(12,'0'));listings=listings.filter(r=>!ids.includes(r.id)).concat(b.p_rows.map((r,i)=>({...r,id:ids[i],created_at:new Date().toISOString()})));json={count:ids.length,ids}}

 if(name==='discovery_profile'){const b=route.request().postDataJSON();json=listings.find(r=>r.username===b.p_username&&r.is_public);json=json&&!failedPublication?project(json):null}
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
 if(name==='admin_list')json={rows:listings,total:listings.length}
 if(name==='my_feed_listing')json={packages:[],rows:[],total:0,purchased_dc:0,total_dc:wallet,profile_ready:true,enabled:true,in_feed:false}
 await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'*/0'},body:JSON.stringify(json)})
})
const goto=async path=>{await page.goto(base+path,{waitUntil:'domcontentloaded'})}
try{
 await goto('/');await page.evaluate(s=>localStorage.setItem('sb-test-auth-token',JSON.stringify(s)),session)
 const admin=()=>goto('/admin?view=managed_profiles')
 await page.setViewportSize({width:390,height:844});await admin()
 async function create(name,publish=true){
  await page.getByRole('button',{name:'+ Create profile',exact:true}).click();const dialog=page.getByRole('dialog')
  await dialog.getByLabel('Display name',{exact:true}).fill(name);await dialog.getByLabel('Listing username',{exact:true}).fill(name)
  await dialog.getByLabel('instagram public URL',{exact:true}).fill('https://instagram.com/'+name)
  if(publish){await dialog.getByLabel('Bio',{exact:true}).fill('A complete managed profile');await dialog.getByLabel('Country',{exact:true}).fill('NG');await dialog.getByLabel('Interests, comma separated',{exact:true}).fill('community');await dialog.getByLabel('Upload portrait (JPG/PNG/WebP, max 5 MB)',{exact:true}).setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from([1,2,3])});await dialog.getByRole('checkbox',{name:'Publish this profile in the feed for free',exact:true}).check()}
  await dialog.getByLabel('Reason / internal note',{exact:true}).fill('Owner has permitted this profile listing')
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile create does not overflow')
  await dialog.getByRole('button',{name:'Confirm and save',exact:true}).click();return dialog
 }
 await create('first_creator');await page.getByText('Managed profile published in the feed for free and its public page verified.',{exact:false}).waitFor()
 await page.getByRole('link',{name:'Check in feed →',exact:true}).click();await page.getByText('first_creator',{exact:true}).first().waitFor();assert.match(page.url(),/managed=%40first_creator/)
 const publicLink=page.locator('a[href="/listing/first_creator"]').first();await publicLink.click();await page.getByText('This is a managed listing, published by the team with permission.',{exact:false}).waitFor();await page.getByRole('img',{name:'Profile complete'}).waitFor()
 assert.equal(await page.getByRole('button',{name:/Connect and earn/}).count(),0,'Managed listing cannot award member connection DC')
 await admin();failedPublication=true;let dialog=await create('retry_creator');await dialog.getByRole('alert').filter({hasText:'saved, but publication was not confirmed'}).waitFor();assert.equal(await page.getByText('Managed profile published in the feed for free',{exact:false}).count(),0)
 const savedId=saveCalls.at(-1).p_id;failedPublication=false;await dialog.getByRole('button',{name:'Confirm and save',exact:true}).click();await page.getByText('Managed profile published in the feed for free',{exact:false}).waitFor();assert.equal(saveCalls.at(-1).p_id,savedId,'Retry keeps the same profile ID');assert.equal(listings.filter(r=>r.username==='retry_creator').length,1)
 await create('draft_creator',false);await page.getByText('Private managed draft saved.',{exact:false}).waitFor();await goto('/listing/draft_creator');await page.getByText('Profile not found or unavailable.',{exact:true}).waitFor()
 await admin();const card=page.locator('.ad-managed-card').filter({hasText:'first_creator'});await card.getByRole('button',{name:'Edit profile',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('checkbox',{name:'Publish this profile in the feed for free',exact:true}).uncheck();await dialog.getByLabel('Reason / internal note',{exact:true}).fill('Owner asked to remove this listing from public view');await dialog.getByRole('button',{name:'Confirm and save',exact:true}).click();await page.getByText('Private managed draft saved.',{exact:false}).waitFor();await goto('/listing/first_creator');await page.getByText('Profile not found or unavailable.',{exact:true}).waitFor()
 await admin();await page.getByRole('button',{name:'Create multiple profiles',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Display name for profile 1',{exact:true}).fill('Batch public');await dialog.getByLabel('Username for profile 1',{exact:true}).fill('batch_public');await dialog.getByLabel('Country',{exact:true}).fill('NG');await dialog.getByLabel('Interests',{exact:true}).fill('community');await dialog.getByLabel('Bio',{exact:true}).fill('A complete public batch profile');await dialog.getByLabel('Portrait for profile 1',{exact:true}).setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from([1,2,3])});await dialog.getByRole('checkbox',{name:/Publish this profile in the feed for free/}).check();await dialog.getByRole('button',{name:/Add another profile/}).click();await dialog.getByLabel('Display name for profile 2',{exact:true}).fill('Batch private');await dialog.getByLabel('Username for profile 2',{exact:true}).fill('batch_private');await dialog.getByLabel('Batch creation reason',{exact:true}).fill('Owner approved public and private draft collection');await dialog.getByRole('button',{name:'Review 2 profiles',exact:true}).click();await dialog.getByLabel('Confirm permission to publish',{exact:true}).check();failedPublication=true;await dialog.getByRole('button',{name:'Create 2 profiles',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'collection was saved, but public publication was not confirmed'}).waitFor();const batch=bulkCalls.at(-1).p_batch;failedPublication=false;await dialog.getByRole('button',{name:'Retry same batch',exact:true}).click();assert.equal(bulkCalls.at(-1).p_batch,batch);await page.getByText('1 public listings verified; 1 private drafts not shown in the feed.',{exact:false}).waitFor();assert.equal(bulkCalls.length,2)
 await goto('/discover?managed=%40batch_public');await page.getByText('Batch public',{exact:true}).waitFor();await page.getByRole('img',{name:'Profile complete'}).waitFor();assert.equal(await page.getByText('Batch private',{exact:true}).count(),0)
 assert.deepEqual(errors,[]);console.log('PASS browser fixtures: mobile single create→confirmed feed→managed public page; no managed connection award; failed publication stays open with no false success; stable-ID retry; private draft and unpublish disappear; bulk public/private verification. No production requests.')
}finally{await browser.close()}
