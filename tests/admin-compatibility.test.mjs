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
 const snapshot=async()=>JSON.stringify((await db.query("select (select jsonb_agg(u order by id) from auth.users u) users,(select jsonb_agg(p order by id) from public.profiles p) profiles,(select jsonb_agg(l order by id) from public.points_ledger l) ledger,(select jsonb_agg(b order by user_id) from public.points_balance b) balances")).rows)
 const before=await snapshot()
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
 await as(admin)
 const stats=(await db.query('select public.admin_overview() data')).rows[0].data
 assert.equal(stats.profiles,2);assert.equal(stats.trend.length,14)
 const ledger=(await db.query("select public.admin_list('points_ledger','','',0) data")).rows[0].data
 assert.equal(ledger.total,6);assert.equal(ledger.rows.length,6)
 await assert.rejects(db.query("select public.admin_list('dc_transactions','','',0)"),/Unsupported resource/)
 await as(member);await assert.rejects(db.query('select public.admin_overview()'),/Permission denied/)
 await assert.rejects(db.query("select public.admin_list('points_ledger','','',0)"),/Permission denied/)
 await db.exec('reset role');assert.equal(await snapshot(),before)
 assert.equal((await db.query("select to_regclass('public.dc_transactions') t")).rows[0].t,null)
 const adminSource=await readFile('src/pages/Admin.jsx','utf8');assert.match(adminSource,/if\(tab==='analytics'\).*return}/);assert.match(adminSource,/View existing rewards ledger/)
 console.log('PASS admin compatibility: actual baseline 001–015 + 024, protected reports and six original ledger records, zero financial/Auth/profile mutation, ordinary denial, metrics-only fallback and modern path. Not a live authenticated browser test.')
}finally{await db.close()}
