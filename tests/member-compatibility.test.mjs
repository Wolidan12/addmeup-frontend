import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {validateMemberOverview,loadMemberWallet} from '../src/member/memberData.js'
import {publicError} from '../src/lib/errors.js'
const uid=crypto.randomUUID(),other=crypto.randomUUID(),valid={profile:{id:uid},balance:{user_id:uid,balance:90},recent_activity:[]}
assert.equal(validateMemberOverview(valid,uid),valid)
for(const data of [null,{...valid,balance:null},{...valid,balance:{balance:null}},{...valid,balance:{balance:'not a number'}},{...valid,balance:{balance:90,user_id:other}},{...valid,profile:{id:other}},{...valid,recent_activity:null}])assert.throws(()=>validateMemberOverview(data,uid))
assert.match(publicError({code:'PGRST202',message:'PRIVATE_FUNCTION_NAME'}),/awaiting the backend upgrade/)
assert.ok(!publicError({code:'42501',message:'PRIVATE_FUNCTION_NAME'}).includes('PRIVATE_FUNCTION_NAME'))
let queries=[]
function client(error={code:'PGRST202'}){
 return {rpc:async()=>({error}),from(table){const q={table};queries.push(q);const chain={select(...args){q.select=args;return chain},eq(...args){(q.eq??=[]).push(args);return chain},order(){return chain},range(...args){q.range=args;return chain},maybeSingle(){q.single=true;return chain},then(resolve,reject){return Promise.resolve(table==='points_balance'?{data:{balance:90},error:null}:{data:[{id:'original',points:15,user_id:uid}],count:6,error:null}).then(resolve,reject)}};return chain}}
}
const old=await loadMemberWallet(client(),uid)
assert.equal(old.mode,'legacy');assert.equal(old.data.balance,90);assert.equal(old.data.total,6);assert.equal('previous_balance' in old.data.rows[0],false)
assert.equal(queries.length,2);for(const q of queries)assert.deepEqual(q.eq[0],['user_id',uid])
queries=[];await loadMemberWallet(client(),uid,{kind:'deposits',page:1,status:'approved'});const deposits=queries.find(q=>q.table==='bank_point_orders');assert.ok(deposits);assert.deepEqual(deposits.range,[20,39]);assert.ok(deposits.eq.some(([key,value])=>key==='status'&&value==='approved'))
for(const code of ['42501','PGRST301','request_timeout','XX000']){queries=[];await assert.rejects(loadMemberWallet(client({code}),uid));assert.equal(queries.length,0)}
assert.equal((await loadMemberWallet({rpc:async()=>({data:{balance:90,rows:[]}})},uid)).mode,'current')
const db=new PGlite()
try{
 const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1];await db.exec(bootstrap)
 await db.exec('alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now()')
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(parseInt(f)<=15||parseInt(f)===24)).sort())await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
 for(const id of [uid,other])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.org'])
 await db.query('insert into public.points_balance(user_id,balance) values($1,90)',[uid]);for(let i=0;i<6;i++)await db.query("insert into public.points_ledger(user_id,points,reason,ref_key) values($1,15,'Original credit',$2)",[uid,'fixture:'+i])
 const snapshot=async()=>JSON.stringify((await db.query('select (select jsonb_agg(u order by id) from auth.users u) users,(select jsonb_agg(p order by id) from public.profiles p) profiles,(select jsonb_agg(b order by user_id) from public.points_balance b) balances,(select jsonb_agg(l order by id) from public.points_ledger l) ledger')).rows)
 const before=await snapshot()
 await db.exec('begin')
 for(const id of [uid,other]){
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.exec('set local role authenticated')
  const result=(await db.query('select public.member_overview() data')).rows[0].data;validateMemberOverview(result,id);assert.equal(Number(result.balance.balance),id===uid?90:0)
  assert.equal((await db.query('select count(*)::int n from public.points_ledger where user_id=$1',[id===uid?other:uid])).rows[0].n,0,'other-wallet history hidden')
  await db.exec('reset role')
 }
 await db.exec('rollback');assert.equal(await snapshot(),before)
 console.log('PASS member compatibility: baseline member overview for wallet/no-wallet accounts, rolled-back initialization, RLS isolation, response/owner validation, owner-filtered read-only wallet fallback, no fabricated snapshots and no fallback on denial.')
}finally{await db.close()}

const {loadDepositScreen}=await import('../src/member/depositData.js')
function depositClient({setting={error:{code:'42P01'}},history={data:[{id:'original-order',user_id:uid,status:'submitted'}],count:1}}={}){
 return {from(table){const q={select(){return q},eq(key,value){if(table==='bank_point_orders'){assert.equal(key,'user_id');assert.equal(value,uid)}return q},order(){return q},limit(){return q},single(){return q},range(from,to){assert.equal(from,10);assert.equal(to,19);return q},then(resolve,reject){return Promise.resolve(table==='dc_settings'?setting:table==='bank_point_orders'?history:{data:[]}).then(resolve,reject)}};return q}}
}
let payment=await loadDepositScreen(depositClient(),uid,1)
assert.equal(payment.enabled,null);assert.equal(payment.upgrade,true);assert.equal(payment.orders[0].id,'original-order');assert.equal(payment.total,1);assert.equal(payment.historyError,null)
for(const code of ['42501','request_timeout']){payment=await loadDepositScreen(depositClient({setting:{error:{code}}}),uid,1);assert.equal(payment.enabled,null);assert.equal(payment.upgrade,false);assert.equal(payment.orders.length,1)}
for(const enabled of [true,false]){payment=await loadDepositScreen(depositClient({setting:{data:{deposits_enabled:enabled}}}),uid,1);assert.equal(payment.enabled,enabled)}
payment=await loadDepositScreen(depositClient({history:{error:{code:'42501'}}}),uid,1);assert.equal(payment.total,null);assert.equal(payment.orders.length,0);assert.ok(payment.historyError)
payment=await loadDepositScreen(depositClient({history:{data:[{user_id:other}],count:1}}),uid,1);assert.ok(payment.historyError);assert.equal(payment.orders.length,0)
const fundingUI=await readFile('src/components/BuyPoints.jsx','utf8');assert.match(fundingUI,/depositsEnabled===true&&<form/);assert.match(fundingUI,/Do not send money/);assert.match(fundingUI,/depositsEnabled!==null&&o.status/)
console.log('PASS deposit screen: missing/denied configuration never enables payments or hides readable owner history; paused/current states, pagination, cross-owner rejection and unavailable-vs-empty history.')
