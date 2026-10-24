// Optional browser smoke test with explicit network fixtures, never production data.
// npm install --no-save --package-lock=false playwright @sparticuz/chromium
// Run a test-only Vite server with VITE_SUPABASE_URL=https://test.supabase.co
// and VITE_SUPABASE_ANON_KEY=test-key, then: node tests/member-browser.smoke.mjs
import {chromium as playwright} from 'playwright'
import chromium from '@sparticuz/chromium'
import assert from 'node:assert/strict'
const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000}})
const userId='b0000000-0000-0000-0000-000000000001',planId='c0000000-0000-0000-0000-000000000001'
const profile={id:userId,username:'test_member',display_name:'Test Member',bio:'Test profile',country:'NG',interests:['music'],is_public:true,avatar_url:null}
const site={id:true,brand_name:'Danqel Social Boost',hero_title:'Good connections. Greater reach.',hero_description:'Meet your community.',enabled_platforms:['whatsapp','instagram','snapchat','tiktok','facebook','x'],maintenance_mode:false,support_email:null}
const overview={profile,balance:{balance:180,current_streak:2,referral_code:'DQ-TESTMEMBER',last_checkin:null},social_count:1,profile_views:3,referral_count:0,referral_earnings:0,referral_percent:0,referred_by:null,active_boost:null,recent_activity:[],unread_notifications:0,pending_orders:0,restricted:false,role:'super_admin'}
const exceptions=[]
await context.route('https://test.supabase.co/**',async route=>{
 const url=new URL(route.request().url()),table=url.pathname.split('/').at(-1)
 let json=[]
 if(table==='site_settings')json=site
 if(table==='member_overview')json=overview
 if(table==='public_directory'||table==='member_referrals')json={rows:[],total:0}
 if(table==='profiles')json=profile
 if(table==='admin_role')json='super_admin'
 if(table==='admin_overview')json={profiles:0,social_links:0,open_reports:0,revenue_kobo:0,bank_revenue_kobo:0,pending_bank_orders:0,pending_payments:0,trend:[]}
 if(table==='boost_plans')json=[{id:planId,title:'Test booster',multiplier:2,cost_points:50,duration_hours:24,bonus_cap:100,is_active:true}]
 if(table==='admin_list'){
  const resource=route.request().postDataJSON().p_resource
  json={rows:resource==='site_settings'?[site]:resource==='boost_plans'?[{id:planId,title:'Test booster',multiplier:2,cost_points:50,duration_hours:24,bonus_cap:100,is_active:true}]:[],total:resource==='site_settings'||resource==='boost_plans'?1:0}
 }
 if(table==='activate_point_boost')json=planId
 if(table==='claim_daily_checkin')json='Check-in complete: +10 pts'
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':'*/0'},body:JSON.stringify(json)})
})
const page=await context.newPage();page.on('pageerror',error=>exceptions.push(error.message))
await page.goto('http://localhost:5173/')
await page.getByRole('heading',{name:'Good connections. Greater reach.'}).waitFor()
assert.equal(await page.getByText('Amara Okafor').count(),0)
assert.equal(await page.getByText('Live — connected').count(),0)
await page.evaluate(({userId})=>{
 const payload={sub:userId,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600}
 const jwt=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify(payload))+'.testsignature'
 localStorage.setItem('sb-test-auth-token',JSON.stringify({access_token:jwt,refresh_token:'test-refresh',expires_at:payload.exp,expires_in:3600,token_type:'bearer',user:{id:userId,email:'member@example.org',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}}))
},{userId})
await page.goto('http://localhost:5173/dashboard')
await page.getByRole('heading',{name:/Hey, Test Member/}).waitFor()
await page.screenshot({path:'/home/user/member-desktop-test.png',fullPage:true})
await page.goto('http://localhost:5173/referrals')
await page.getByRole('heading',{name:'Grow together.'}).waitFor()
await page.getByLabel('Your referral link').waitFor()
await page.waitForFunction(()=>document.querySelector('input[aria-label="Your referral link"]')?.value.includes('DQ-TESTMEMBER'));assert.match(await page.getByLabel('Your referral link').inputValue(),/register\?ref=DQ-TESTMEMBER/)
await page.goto('http://localhost:5173/boosts')
await page.getByRole('button',{name:'Select this plan'}).click()
const modal=page.getByRole('dialog');await modal.waitFor();assert.equal(await modal.getByRole('heading',{name:'Activate Test booster?'}).count(),1)
await modal.getByRole('button',{name:'Cancel',exact:true}).click();await modal.waitFor({state:'detached'})
await page.goto('http://localhost:5173/discover');await page.getByRole('heading',{name:'Explore the community.'}).waitFor();await page.getByRole('button',{name:'Instagram',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Instagram',exact:true}).getAttribute('aria-pressed'),'true')
await page.goto('http://localhost:5173/settings');await page.getByRole('heading',{name:'Make it yours.'}).waitFor();await page.getByLabel('Display name',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('input[pattern="[a-z0-9_]{3,24}"]')?.value==='test_member');assert.equal(await page.getByLabel('Display name',{exact:true}).inputValue(),'Test Member')
await page.goto('http://localhost:5173/rewards');await page.getByRole('heading',{name:'Points & wallet.'}).waitFor();await page.getByRole('heading',{name:'Buy points by bank transfer'}).waitFor()
await page.goto('http://localhost:5173/admin?view=boost_plans');await page.getByRole('button',{name:'+ Create booster'}).click();await page.getByRole('dialog').getByRole('heading',{name:'Create booster plan'}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click()
await page.goto('http://localhost:5173/admin?view=site_settings');await page.getByRole('button',{name:'Inspect →'}).click();await page.getByRole('button',{name:'Edit site settings',exact:true}).click();await page.getByRole('dialog').getByRole('heading',{name:'Edit site settings'}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click()
await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:5173/dashboard');await page.getByRole('heading',{name:/Hey, Test Member/}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false)
await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('navigation',{name:'Member workspace'}).getByRole('link',{name:'Referrals',exact:true}).click();await page.getByRole('heading',{name:'Grow together.'}).waitFor()
await page.goto('http://localhost:5173/dashboard');await page.getByRole('heading',{name:/Hey, Test Member/}).waitFor();await page.screenshot({path:'/home/user/member-mobile-test.png',fullPage:true})
assert.deepEqual(exceptions,[])
await browser.close()
console.log('Browser smoke passed: public home, desktop/mobile workspace, referrals, boosters dialog, directory filters, photo/settings, wallet and admin configuration dialogs (mock network fixtures).')
