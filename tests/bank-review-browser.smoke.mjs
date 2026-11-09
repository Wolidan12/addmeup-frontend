// Real local Chromium, mocked Supabase transport/Auth, never production login.
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
try{
 const context=await browser.newContext(),page=await context.newPage(),calls=[],exceptions=[]
 const id='b0000000-0000-0000-0000-000000000001',exp=Math.floor(Date.now()/1000)+3600
 const user={id,email:'staff@example.org',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}
 const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture'
 const session={access_token:jwt,refresh_token:'fixture-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user}
 const platformRows=[{key:'instagram',label:'Instagram',hosts:['instagram.com']}];let catalogueResultCount=1
 let metricsMode='current',role='super_admin',bankMode='current',failReview=false
 await context.route('https://test.supabase.co/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1);let body={},status=200
  const args=route.request().method()==='POST'?route.request().postDataJSON():null;calls.push({name,args})
  if(name==='social_platforms'){
   const filter=new URL(route.request().url()).searchParams.get('label')||'';const search=filter.replace(/^ilike\.%|%$/g,'').toLowerCase();body=platformRows.filter(p=>p.label.toLowerCase().includes(search));catalogueResultCount=body.length
  }
  if(name==='admin_save_social_platform'){platformRows.push({key:args.p_key,label:args.p_label,hosts:args.p_hosts});body=null}
  if(name==='user')body=user
  if(name==='admin_role')body=role
  if(name==='site_settings')body={id:true,brand_name:'Danqel Social Boost',enabled_platforms:['instagram'],maintenance_mode:false}
  if(name==='admin_metrics'){
   if(metricsMode==='current')body={registration_series:[{day:'2026-10-31',users:2}],total_users:2}
   else {status=metricsMode==='denied'?403:404;body={code:metricsMode==='denied'?'42501':'PGRST202',message:'PRIVATE_SENTINEL'}}
  }
  if(name==='admin_overview')body={profiles:2,social_links:2,open_reports:0,bank_revenue_kobo:0,trend:[{day:'2026-10-31',users:2}]}
  if(name==='admin_manual_deposits'){
   if(bankMode==='missing'){status=404;body={code:'PGRST202',message:'Missing report'}}
   else body={rows:[{id:'order-original',user_id:'member-other',account_number:'6977298247',bank_name:'Moniepoint',account_name:'Official account',transfer_reference:'CLAIMED-'+('x'.repeat(180)),receipt_path:null,payer_name:'Fixture Payer',points:100,amount_kobo:10000,status:'submitted',created_at:'2026-10-31T00:00:00Z'}],total:1,gross_kobo:0,refunded_kobo:0,net_kobo:0}
  }
  if(name==='admin_list'){
   if(args.p_resource==='dc_transactions'){status=400;body={code:'P0001',message:'Unsupported resource'}}
   else if(args.p_resource==='bank_point_orders'){const matches=(!args.p_search||'Fixture Payer'.includes(args.p_search))&&(!args.p_status||args.p_status==='submitted');body={rows:matches?[{id:'order-original',user_id:'member-other',account_number:'6977298247',bank_name:'Moniepoint',account_name:'Official account',transfer_reference:'CLAIMED-'+('x'.repeat(180)),receipt_path:null,payer_name:'Fixture Payer',points:100,amount_kobo:10000,status:'submitted',created_at:'2026-10-31T00:00:00Z'}]:[],total:matches?1:0}}
   else if(args.p_resource==='social_platforms'){status=400;body={code:'P0001',message:'Unsupported resource'}}
   else body={rows:[{id:'original-1',user_id:id,points:15,reason:'Original credit',created_at:'2026-10-31T00:00:00Z'}],total:6}
  }
  if(name==='admin_confirm_manual_deposit'){await new Promise(r=>setTimeout(r,400));if(failReview){status=403;body={code:'42501',message:'PRIVATE_SENTINEL'}}else body=null}
  await route.fulfill({status,contentType:'application/json',headers:name==='social_platforms'?{'content-range':catalogueResultCount?'0-'+(catalogueResultCount-1)+'/'+catalogueResultCount:'*/0'}:{},body:JSON.stringify(body)})
 })
 await context.addInitScript(session=>localStorage.setItem('sb-test-auth-token',JSON.stringify(session)),session)
 page.on('pageerror',e=>exceptions.push(e.message));page.setDefaultTimeout(15000)
 const base=process.env.TEST_BASE_URL||'http://localhost:5174'
 for(const [width,height] of [[320,800],[390,844],[844,390],[768,1024],[1440,1000]]){
  await page.setViewportSize({width,height});await page.goto(base+'/admin?view=bank_point_orders');await page.getByRole('button',{name:'Approve',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor()
  const bounds=await dialog.evaluate(el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,overflow:el.scrollWidth>el.clientWidth}})
  assert.ok(bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=height,'dialog must fit '+width+'x'+height);assert.equal(bounds.overflow,false)
  assert.equal(await dialog.locator('details[open]').count(),0);assert.equal(await dialog.getByLabel('Bank-statement reference',{exact:true}).inputValue(),'');assert.equal(await dialog.getByRole('button',{name:'Approve',exact:true}).isDisabled(),true)
  await dialog.getByLabel('Bank-statement reference',{exact:true}).fill('RECEIVING-BANK-REFERENCE');assert.equal(await dialog.getByRole('button',{name:'Approve',exact:true}).isDisabled(),true);await dialog.getByRole('checkbox').check()
  const before=calls.filter(c=>c.name==='admin_confirm_manual_deposit').length
  await dialog.getByRole('button',{name:'Approve',exact:true}).click();await dialog.getByRole('button',{name:'Saving…'}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Cancel',exact:true}).isDisabled(),true)
  await dialog.locator('form').evaluate(el=>{el.requestSubmit();el.requestSubmit()});await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true)
  await page.getByRole('status').filter({hasText:'Deposit approved and audit-logged'}).waitFor();const reviews=calls.filter(c=>c.name==='admin_confirm_manual_deposit');assert.equal(reviews.length,before+1);assert.equal(reviews.at(-1).args.p_bank_reference,'RECEIVING-BANK-REFERENCE');assert.equal(reviews.at(-1).args.p_received_kobo,10000)
 }
 await page.getByRole('button',{name:'Decline',exact:true}).click();let dialog=page.getByRole('dialog');assert.equal(await dialog.getByRole('button',{name:'Decline',exact:true}).isDisabled(),true);await dialog.getByLabel('Decline reason',{exact:true}).selectOption('other');await dialog.getByLabel('Reason for declining',{exact:true}).fill('short');assert.equal(await dialog.getByRole('button',{name:'Decline',exact:true}).isDisabled(),true);await dialog.getByLabel('Decline reason',{exact:true}).selectOption('receipt_invalid');await dialog.getByRole('button',{name:'Decline',exact:true}).click();await page.getByRole('status').filter({hasText:'No wallet credit'}).waitFor();const decline=calls.filter(c=>c.name==='admin_confirm_manual_deposit').at(-1).args;assert.equal(decline.p_approve,false);assert.equal(decline.p_received_kobo,null);assert.equal(decline.p_bank_reference,null)
 failReview=true;await page.getByRole('button',{name:'Approve',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Bank-statement reference',{exact:true}).fill('RETRY-STATEMENT');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Approve',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.ok(!(await dialog.innerText()).includes('PRIVATE_SENTINEL'));assert.equal(await dialog.getByRole('button',{name:'Approve',exact:true}).isEnabled(),true);failReview=false;await dialog.getByRole('button',{name:'Approve',exact:true}).click();await page.getByRole('status').filter({hasText:'Deposit approved and audit-logged'}).waitFor()
 assert.deepEqual(exceptions,[]);console.log('PASS compact bank review browser fixtures: direct actions; five portrait/landscape sizes, long reference wraps, empty independent reference, explicit confirmation, disabled saving/cancel/Escape, duplicate submit guard, decline/null credit fields/custom reason validation, sanitized failure and retry. Mocked transport only; no live settlement.')
}finally{await browser.close()}
