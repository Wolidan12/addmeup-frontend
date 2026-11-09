// Local Chromium plus explicit transport/Auth fixtures. Not real payment settlement.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
import {feedListingPackages} from '../src/lib/feedListingPackages.js'
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
try{
 const context=await browser.newContext(),page=await context.newPage(),calls=[],exceptions=[]
 const id='b0000000-0000-0000-0000-000000000001',exp=Math.floor(Date.now()/1000)+3600,user={id,email:'listing@example.org',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}}
 const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
 const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
 const packages=feedListingPackages.map(p=>({key:p.key,label:p.label,cost_dc:p.costDC,duration_hours:p.durationHours}))
 let purchased=0,total=100000,ready=true,missing=false,ambiguous=false,expiry=0;const orders=new Map()
 await context.route('https://test.supabase.co/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1),args=route.request().method()==='POST'?route.request().postDataJSON():null;calls.push({name,args});let body={},status=200
  if(name==='user')body=user
  if(name==='site_settings')body={id:true,brand_name:'Danqel Social Boost',enabled_platforms:['instagram'],maintenance_mode:false}
  if(name==='social_platforms')body=[{key:'instagram',label:'Instagram',hosts:['instagram.com']}]
  if(name==='member_overview')body={profile:{id,username:'listing_member',display_name:'Listing Member',is_public:true},balance:{balance:total},recent_activity:[],social_count:1,unread_notifications:0,role:'user',restricted:false}
  if(name==='my_feed_listing'){
   if(missing){status=404;body={code:'PGRST202',message:'PRIVATE_SENTINEL'}}
   else body={enabled:true,server_now:new Date().toISOString(),purchased_dc:purchased,total_dc:total,profile_ready:ready,in_feed:orders.size>0,active_until:orders.size?[...orders.values()].at(-1).ends_at:null,packages,rows:[...orders.values()].map(o=>({...o,status:new Date(o.starts_at)>new Date()?'queued':'active'})),total:orders.size}
  }
  if(name==='buy_feed_listing'){
   await new Promise(r=>setTimeout(r,300))
   let order=orders.get(args.p_request)
   if(!order){const starts=Math.max(Date.now(),...([...orders.values()].map(o=>Date.parse(o.ends_at))));order={id:args.p_request,user_id:id,package_key:args.p_package,cost_dc:args.p_expected_cost,duration_hours:args.p_expected_hours,starts_at:new Date(starts).toISOString(),ends_at:new Date(starts+args.p_expected_hours*3600000).toISOString(),created_at:new Date().toISOString()};orders.set(order.id,order);purchased-=order.cost_dc;total-=order.cost_dc}
   body=order;if(ambiguous){ambiguous=false;status=500;body={code:'XX000',message:'PRIVATE_SENTINEL'}}
  }
  if(name==='public_directory'){const live=expiry>Date.now();body={server_now:new Date().toISOString(),feed_policy:'purchased_dc_v1',rows:live?[{id,username:'listing_member',display_name:'Expiring Paid Member',bio:'Sample',social_links:[],feed_listing_paid:true,feed_ends_at:new Date(expiry).toISOString()}]:[],total:live?1:0,paid_rows:[]}}
  if(name==='favourites')body=[]
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
 })
 await context.addInitScript(s=>localStorage.setItem('sb-test-auth-token',JSON.stringify(s)),session)
 page.setDefaultTimeout(15000);page.on('pageerror',e=>exceptions.push(e.message));const base=process.env.TEST_BASE_URL||'http://localhost:5174'
 await page.goto(base+'/list-profile');await page.getByRole('button',{name:'Review listing purchase'}).waitFor();assert.equal(await page.getByRole('button',{name:'Review listing purchase'}).isDisabled(),true,'Reward-only total cannot enable listing payment')
 purchased=5000;total=8000;ready=false;await page.getByRole('button',{name:'Refresh listing status'}).click();await page.getByText(/Save a display name, allow your profile/).waitFor();assert.equal(await page.getByRole('button',{name:'Review listing purchase'}).isDisabled(),true)
 ready=true
 for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){
  await page.setViewportSize({width,height});await page.goto(base+'/list-profile');await page.getByRole('button',{name:'Review listing purchase'}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.locator('input:not([type="checkbox"])').count(),0,'No profile retyping');assert.equal(await dialog.getByRole('button',{name:'Confirm listing purchase',exact:true}).isDisabled(),true)
  const b=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth>el.clientWidth}});assert.ok(b.left>=0&&b.right<=width&&b.top>=0&&b.bottom<=height);assert.equal(b.overflow,false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
 }
 ambiguous=true;await page.getByRole('button',{name:'Review listing purchase'}).click();let dialog=page.getByRole('dialog');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm listing purchase',exact:true}).click();await dialog.getByRole('button',{name:'Confirming…'}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Cancel',exact:true}).isDisabled(),true);await dialog.locator('form').evaluate(f=>{f.requestSubmit();f.requestSubmit()});await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true);await dialog.getByRole('alert').waitFor();assert.ok(!(await dialog.innerText()).includes('PRIVATE_SENTINEL'));assert.equal(orders.size,1);assert.equal(calls.filter(c=>c.name==='buy_feed_listing').length,1)
 const first=[...orders.values()][0];assert.equal(purchased,3800);await page.reload();await page.getByRole('button',{name:'Resume saved listing request'}).click();dialog=page.getByRole('dialog');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm or retry saved request',exact:true}).click();await page.getByRole('status').filter({hasText:'Listing confirmed.'}).waitFor();assert.equal(orders.size,1);assert.equal(purchased,3800);const reviews=calls.filter(c=>c.name==='buy_feed_listing');assert.equal(reviews[0].args.p_request,reviews[1].args.p_request)
 await page.getByLabel('Listing duration',{exact:true}).selectOption('1d');await page.getByRole('button',{name:'Review listing purchase'}).click();dialog=page.getByRole('dialog');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm listing purchase',exact:true}).click();await page.getByRole('status').filter({hasText:'2,400 purchased DC'}).waitFor();assert.equal(orders.size,2);assert.equal(purchased,1400);assert.equal([...orders.values()][1].starts_at,first.ends_at)
 missing=true;await page.reload();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'Review listing purchase'}).count(),0);assert.ok(!(await page.locator('main').innerText()).includes('PRIVATE_SENTINEL'));missing=false
 expiry=Date.now()+1800;await page.goto(base+'/discover');await page.getByRole('link',{name:'Expiring Paid Member',exact:true}).waitFor();await page.getByRole('heading',{name:'No creators found',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Expiring Paid Member',exact:true}).count(),0,'Known-expired card must disappear without manual refresh')
 assert.deepEqual(exceptions,[]);console.log('PASS paid-feed browser fixtures: reward-only/unfinished profile denied, five compact mobile/landscape dialogs, no repeated profile fields, consent, in-flight Escape/cancel/duplicate guards, ambiguous committed result + durable reload/replay without second debit, renewal time/price, unavailable-backend fail-closed and automatic feed expiry. Mocked transport only.')
}finally{await browser.close()}
