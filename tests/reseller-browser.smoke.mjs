// Chromium UI + mocked Supabase transport/Auth. Never actual fulfillment or live login.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
try{
 const context=await browser.newContext(),page=await context.newPage(),calls=[],exceptions=[]
 const id='b0000000-0000-0000-0000-000000000001',exp=Math.floor(Date.now()/1000)+3600
 const user={id,email:'staff@example.org',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}
 const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
 const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
 let role='super_admin',missing=false;const orders=[],events=[],services=[{id:'content-design',name:'Content creation',description:'Original content, manually delivered.',deliverable:'Content package',is_active:true,fulfillment:'MANUAL'}]
 await context.route('https://test.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),name=url.pathname.split('/').at(-1),args=route.request().method()==='POST'?route.request().postDataJSON():null;calls.push({name,args});let data=[],status=200,count=0
  if(name==='user')data=user
  if(name==='admin_role')data=role
  if(name==='site_settings')data={id:true,brand_name:'Danqel Social Boost',enabled_platforms:[],maintenance_mode:false}
  if(name==='reseller_is_admin'){data=true;if(missing){status=404;data={code:'PGRST202',message:'PRIVATE_WORKFLOW_SENTINEL'}}}
  if(name==='reseller_services')data=services
  if(name==='reseller_orders'){
   const statusFilter=(url.searchParams.get('status')||'').replace('eq.',''),query=(url.searchParams.get('title')||'').replace(/^ilike\.%|%$/g,'').toLowerCase()
   data=orders.filter(o=>(!statusFilter||o.status===statusFilter)&&(!query||o.title.toLowerCase().includes(query)));count=data.length
  }
  if(name==='reseller_events')data=events.filter(e=>e.order_id===(url.searchParams.get('order_id')||'').replace('eq.',''))
  if(name==='reseller_create_order'){
   if(!orders.some(o=>o.id===args.p_id)){const order={id:args.p_id,service_id:args.p_service,title:args.p_title,brief:args.p_brief,status:'SUBMITTED',version:1,charge_dc:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};orders.push(order);events.push({id:crypto.randomUUID(),order_id:order.id,actor_id:id,status:order.status,note:'Manual order was created',created_at:order.created_at})}data=args.p_id
  }
  if(name==='reseller_update_order'){
   const order=orders.find(o=>o.id===args.p_id);order.status=args.p_status;order.version++;order.delivery_url=args.p_delivery_url;events.push({id:crypto.randomUUID(),order_id:order.id,actor_id:id,status:order.status,note:args.p_note,created_at:new Date().toISOString()});data=null
  }
  await route.fulfill({status,contentType:'application/json',headers:{'content-range':count?`0-${count-1}/${count}`:'*/0'},body:JSON.stringify(data)})
 })
 await context.addInitScript(s=>localStorage.setItem('sb-test-auth-token',JSON.stringify(s)),session)
 page.on('pageerror',e=>exceptions.push(e.message));page.setDefaultTimeout(15000)
 const base=process.env.TEST_BASE_URL||'http://localhost:5174'
 for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){
  await page.setViewportSize({width,height});await page.goto(base+'/admin?view=reseller');await page.getByRole('button',{name:'Save manual order',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'reseller layout '+width)
 }
 await page.getByLabel('Service',{exact:true}).selectOption('content-design');await page.getByLabel('Order title',{exact:true}).fill('Original campaign poster');await page.getByLabel('Service brief',{exact:true}).fill('Create a licensed original campaign poster for our launch.')
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Save manual order',exact:true}).click();await page.getByRole('heading',{name:'Original campaign poster',exact:true}).waitFor();assert.equal(calls.filter(c=>c.name==='reseller_create_order').length,1)
 await page.reload();await page.getByRole('heading',{name:'Original campaign poster',exact:true}).waitFor();await page.getByRole('button',{name:'Inspect order and audit',exact:true}).click();await page.getByText('Manual order was created',{exact:true}).waitFor()
 await page.getByLabel('Review note',{exact:true}).fill('The creative team has begun manual work.');await page.getByRole('button',{name:'Record manual status',exact:true}).click();await page.getByText('Manual order status updated.',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Inspect order and audit',exact:true}).click();await page.getByLabel('New manual status',{exact:true}).selectOption('COMPLETED');await page.getByLabel('Review note',{exact:true}).fill('Reviewed licensed creative and checked delivery manually.');await page.getByLabel('HTTPS delivery evidence',{exact:true}).fill('https://example.org/delivery');await page.getByRole('button',{name:'Record manual status',exact:true}).click();await page.getByText('Manual completion recorded. Delivery has not been verified by a provider.',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Inspect order and audit',exact:true}).click();await page.getByRole('link',{name:'Open HTTPS evidence',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Record manual status',exact:true}).count(),0)
 const exported=page.waitForEvent('download');await page.getByRole('button',{name:'Export page metadata',exact:true}).click();const download=await exported,text=await readFile(await download.path(),'utf8');assert.ok(text.includes(orders[0].id));assert.ok(!text.includes('Original campaign poster'));assert.ok(!text.includes('Create a licensed original'));assert.ok(!text.includes('https://example.org/delivery'))
 await page.getByRole('button',{name:'Close order detail',exact:true}).click();await page.getByLabel('Order status',{exact:true}).selectOption('CANCELLED');await page.getByText('No matching manual orders.',{exact:true}).waitFor()
 await page.getByLabel('Order status',{exact:true}).selectOption('');await page.getByLabel('Search order titles',{exact:true}).fill('Nobody');await page.getByRole('button',{name:'Search orders',exact:true}).click();await page.getByText('No matching manual orders.',{exact:true}).waitFor()
 missing=true;await page.reload();await page.getByRole('heading',{name:'Reseller workspace locked',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Save manual order',exact:true}).count(),0);assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_WORKFLOW_SENTINEL'))
 role='moderator';const previous=calls.filter(c=>c.name==='reseller_is_admin').length;await page.reload();await page.getByRole('heading',{name:'Permission required',exact:true}).waitFor();assert.equal(calls.filter(c=>c.name==='reseller_is_admin').length,previous)
 assert.ok(!calls.some(c=>c.name==='admin_list'&&c.args?.p_resource==='reseller'));assert.deepEqual(exceptions,[])
 console.log('PASS reseller browser: five layouts, create/reload, manual progress/completion/evidence/audit, terminal controls, safe page export, filters/search, missing-backend lock and moderator denial. Mocked Auth/transport, no provider API or actual fulfillment.')
}finally{await browser.close()}
