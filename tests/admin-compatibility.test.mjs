import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {loadWorkspaceMetrics,backendUpgradeRequired} from '../src/admin/backendCompatibility.js'
const report={profiles:2,social_links:0,open_reports:0,trend:[{day:'2026-10-31',users:2}]}
let calls=[]
const missing={code:'PGRST202',message:'Missing metrics RPC'}
const client=(error=missing)=>({rpc:async(name,args)=>{calls.push({name,args});return name==='admin_metrics'?{error}:{data:report}}})
assert.deepEqual(await loadWorkspaceMetrics(client(),30),{mode:'legacy',data:report})
assert.deepEqual(calls.map(c=>c.name),['admin_metrics','admin_overview'])
for(const code of ['42501','PGRST301','request_timeout','XX000']){calls=[];await assert.rejects(loadWorkspaceMetrics(client({code}),30));assert.equal(calls.length,1,'no fallback for '+code)}
assert.equal((await loadWorkspaceMetrics({rpc:async()=>({data:{registration_series:[]}})},14)).mode,'current')
await assert.rejects(loadWorkspaceMetrics({rpc:async()=>({data:{}})},30),/Invalid metrics/)
assert.equal(backendUpgradeRequired({code:'P0001',message:'Unsupported resource'}),true)
assert.equal(backendUpgradeRequired({code:'P0001',message:'Permission denied'}),false)
assert.equal(backendUpgradeRequired({code:'42501'}),false)
const db=new PGlite()
try{
 const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
 await db.exec(bootstrap)
 await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now()")
 const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(parseInt(f)<=15||parseInt(f)===24)).sort()
 for(const f of files)await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
 const admin=crypto.randomUUID(),member=crypto.randomUUID()
 for(const id of [admin,member])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.org'])
 await db.query("insert into public.user_roles(user_id,role) values($1,'admin')",[admin])
 await db.query('insert into public.points_balance(user_id,balance) values($1,90)',[admin])
 for(let i=0;i<6;i++)await db.query("insert into public.points_ledger(user_id,points,reason,ref_key) values($1,15,'Historical credit',$2)",[admin,'fixture:'+i])
 const pkg=crypto.randomUUID();await db.query("insert into public.point_packages(id,title,points,price_kobo) values($1,'Fixture package',100,10000)",[pkg])
 await db.query("insert into public.bank_point_orders(user_id,package_id,package_title,points,amount_kobo,account_number,account_name,bank_name,status,payer_name) select $1,$2,'Fixture package',100,10000,'6977298247','LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST','MONIEPOINT','submitted','Fixture Payer' from generate_series(1,26)",[member,pkg])
 const snapshot=async()=>JSON.stringify((await db.query("select (select jsonb_agg(o order by id) from public.bank_point_orders o) bank_orders,(select jsonb_agg(u order by id) from auth.users u) users,(select jsonb_agg(p order by id) from public.profiles p) profiles,(select jsonb_agg(l order by id) from public.points_ledger l) ledger,(select jsonb_agg(b order by user_id) from public.points_balance b) balances")).rows)
 const before=await snapshot()
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
 await as(admin)
 const orderPage=(await db.query("select public.admin_list('bank_point_orders','Fixture Payer','submitted',0) data")).rows[0].data
 assert.equal(orderPage.total,26);assert.equal(orderPage.rows.length,25)
 assert.equal((await db.query("select public.admin_list('bank_point_orders','Fixture Payer','submitted',1) data")).rows[0].data.rows.length,1)
 assert.equal((await db.query("select public.admin_list('bank_point_orders','Fixture Payer','approved',0) data")).rows[0].data.total,0)
 const existingPlatforms=await db.query('select * from public.social_platforms order by key')
 assert.equal(existingPlatforms.rows.length,8)
 await db.query("select public.admin_save_social_platform('portfolio','Portfolio',array['example.org'],true,'Configure approved creator portfolio links')")
 assert.equal((await db.query("select count(*)::int n from public.audit_logs where action='social_platform_saved' and target='portfolio'")).rows[0].n,1)
 const stats=(await db.query('select public.admin_overview() data')).rows[0].data
 assert.equal(stats.profiles,2);assert.equal(stats.trend.length,14)
 const ledger=(await db.query("select public.admin_list('points_ledger','','',0) data")).rows[0].data
 assert.equal(ledger.total,6);assert.equal(ledger.rows.length,6)
 await assert.rejects(db.query("select public.admin_list('dc_transactions','','',0)"),/Unsupported resource/)
 await as(member);await assert.rejects(db.query("select public.admin_list('bank_point_orders','','',0)"),/Permission denied/);await assert.rejects(db.query("select public.admin_save_social_platform('intruder','Intruder',array['example.org'],true,'Attempt unauthorized configuration')"),/Permission denied/);await assert.rejects(db.query('select public.admin_overview()'),/Permission denied/)
 await assert.rejects(db.query("select public.admin_list('points_ledger','','',0)"),/Permission denied/)
 await db.exec('reset role');assert.equal(await snapshot(),before)
 assert.equal((await db.query("select to_regclass('public.dc_transactions') t")).rows[0].t,null)
 const adminSource=await readFile('src/pages/Admin.jsx','utf8');assert.match(adminSource,/if\(tab==='analytics'\).*return}/);assert.match(adminSource,/View existing rewards ledger/)
 console.log('PASS admin compatibility: actual baseline 001–015 + 024, protected reports and six original ledger records, zero financial/Auth/profile mutation, ordinary denial, metrics-only fallback and modern path. Not a live authenticated browser test.')
}finally{await db.close()}

// Supported 013 catalogue must not go through the unsupported legacy admin_list.
const {loadSocialPlatformDirectory}=await import('../src/admin/backendCompatibility.js')
let catalogueCalls=[]
function catalogueClient(reply){const query={select(...args){catalogueCalls.push(['select',...args]);return query},ilike(...args){catalogueCalls.push(['ilike',...args]);return query},order(...args){catalogueCalls.push(['order',...args]);return query},range(...args){catalogueCalls.push(['range',...args]);return Promise.resolve(reply)}};return {from(table){catalogueCalls.push(['from',table]);return query}}}
const platform={key:'instagram',label:'Instagram',hosts:['instagram.com']}
assert.deepEqual(await loadSocialPlatformDirectory(catalogueClient({data:[platform],count:1}),'Insta',1),{rows:[platform],total:1})
assert.ok(catalogueCalls.some(x=>x[0]==='from'&&x[1]==='social_platforms'))
assert.ok(catalogueCalls.some(x=>x[0]==='ilike'&&x[2]==='%Insta%'))
assert.ok(catalogueCalls.some(x=>x[0]==='range'&&x[1]===25&&x[2]===49))
await assert.rejects(loadSocialPlatformDirectory(catalogueClient({error:{code:'42501'}})))
await assert.rejects(loadSocialPlatformDirectory(catalogueClient({data:[],count:null})),/Invalid platform/)
console.log('PASS existing social-platform directory: direct RLS read, server search/count/pagination, permission/error propagation; no admin_list dependency.')

const {loadAdminDeposits}=await import('../src/admin/backendCompatibility.js')
let depositCalls=[]
function depositsClient(error={code:'PGRST202'}){return {rpc:async(name,args)=>{depositCalls.push({name,args});return name==='admin_manual_deposits'?(error?{error}:{data:{rows:[],total:0,gross_kobo:0,refunded_kobo:0,net_kobo:0}}):{data:{rows:[{id:'preserved',status:'submitted',payer_name:'Fixture Payer'}],total:1}}}}}
const legacyDeposits=await loadAdminDeposits(depositsClient(),{search:'Fixture',status:'submitted',page:1})
assert.equal(legacyDeposits.read_only,true);assert.equal(legacyDeposits.total,1);assert.equal('gross_kobo' in legacyDeposits,false)
assert.deepEqual(depositCalls.map(c=>c.name),['admin_manual_deposits','admin_list'])
assert.deepEqual(depositCalls[1].args,{p_resource:'bank_point_orders',p_search:'Fixture',p_status:'submitted',p_page:1})
for(const code of ['42501','PGRST301','request_timeout','XX000']){depositCalls=[];await assert.rejects(loadAdminDeposits(depositsClient({code})));assert.equal(depositCalls.length,1)}
assert.equal((await loadAdminDeposits(depositsClient(null))).read_only,false)
const adminCode=await readFile('src/pages/Admin.jsx','utf8');assert.match(adminCode,/tab==='bank_point_orders'&&bankReadOnly\?\[\]:rowActions/);assert.match(adminCode,/operation&&!\(tab==='bank_point_orders'&&bankReadOnly\)/)
console.log('PASS bank orders: missing-only read fallback, native status/payer search/pagination, no synthetic totals and no legacy mutations exposed.')

for(const total of [null,undefined,-1,0.5,NaN,true,'',{},Number.MAX_SAFE_INTEGER+1]){
 let attempts=0;await assert.rejects(loadAdminDeposits({rpc:async()=>{attempts++;return {data:{rows:[],total}}}}),/Invalid bank-order response/);assert.equal(attempts,1)
}
await assert.rejects(loadAdminDeposits({rpc:async name=>name==='admin_manual_deposits'?{error:{code:'42883'}}:{error:new Error('Protected report denied')}}),/Protected report denied/)
let networkAttempts=0;await assert.rejects(loadAdminDeposits({rpc:async()=>{networkAttempts++;throw new Error('Offline')}}),/Offline/);assert.equal(networkAttempts,1)
console.log('PASS bank failure handling: malformed counts fail closed, protected fallback denial propagates and network failures never trigger fallback.')
