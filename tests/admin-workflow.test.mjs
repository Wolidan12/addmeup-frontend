import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {loadAdminUsers} from '../src/admin/backendCompatibility.js'
import {canView,resources} from '../src/admin/resources.js'
let calls=[]
const client={rpc:async(name,args)=>{calls.push({name,args});return name==='admin_user_directory'?{error:{code:'PGRST202'}}:{data:{rows:[{username:'owner'}],total:1}}}}
assert.equal((await loadAdminUsers(client,{search:'owner'})).legacy_users,true);assert.equal(calls[1].args.p_status,'')
await assert.rejects(loadAdminUsers(client,{status:'verified'}),e=>e.code==='user_filter_unavailable')
for(const code of ['42501','PGRST301','request_timeout','XX000']){calls=[];await assert.rejects(loadAdminUsers({rpc:async name=>{calls.push(name);return {error:{code}}}}));assert.deepEqual(calls,['admin_user_directory'])}
assert.equal(canView('super_admin',undefined),false)
assert.equal(canView('finance_admin',resources.find(r=>r.key==='profiles')),false,'Do not advertise a scope denied by the existing server')
const db=new PGlite()
try{
 await db.exec((await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1])
 await db.exec('alter table auth.users add column email_confirmed_at timestamptz,add column banned_until timestamptz')
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(parseInt(f)<=15||parseInt(f)===24)).sort())await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
 const owner=crypto.randomUUID(),member=crypto.randomUUID(),finance=crypto.randomUUID(),support=crypto.randomUUID()
 for(const [i,id] of [owner,member,finance,support].entries()){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id,'person'+i+'@example.org',i===1?null:new Date().toISOString()]);await db.query("update public.profiles set username=$2,display_name=$3,is_public=false where id=$1",[id,'person_'+i,'Member '+i])
 }
 for(const [id,role] of [[owner,'super_admin'],[finance,'finance_admin'],[support,'support_agent']])await db.query('insert into public.user_roles(user_id,role) values($1,$2)',[id,role])
 const snapshot=async()=>JSON.stringify(await Promise.all(['auth.users','public.profiles','public.points_ledger','public.points_balance','public.bank_point_orders','public.user_roles'].map(async t=>(await db.query('select * from '+t+' order by 1')).rows)))
 const before=await snapshot();await db.exec(await readFile('supabase/manual/install_admin_user_directory.sql','utf8'));assert.equal(await snapshot(),before)
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
 const search=async(q='',status='',page=0)=>(await db.query('select public.admin_user_directory($1,$2,$3) data',[q,status,page])).rows[0].data
 await as(null);await assert.rejects(search(),/permission denied/);await as(member);await assert.rejects(search(),/Permission denied/);await as(finance);await assert.rejects(search(),/Permission denied/)
 await as(owner);assert.equal((await search('person1@example.org')).rows[0].id,member);assert.equal((await search(member)).total,1);assert.equal((await search('Member 1')).total,1);assert.equal((await search('','unverified')).total,1);assert.equal((await search('','verified')).total,3);assert.equal((await search('','',1)).rows.length,0);await assert.rejects(search('','unsupported'),/Invalid/);await assert.rejects(search('','',-1),/Invalid/)
 await db.exec('reset role');await db.query("insert into public.account_restrictions(user_id,actor_id,reason) values($1,$2,'Test restriction')",[member,owner]);await as(owner);assert.equal((await search('','suspended')).rows[0].id,member)
 await as(support);assert.equal((await search(member)).rows[0].suspended,true)
 await db.exec('reset role');assert.equal((await db.query("select provolatile from pg_proc where oid='public.admin_user_directory(text,text,integer)'::regprocedure")).rows[0].provolatile,'s')
 console.log('PASS admin workflow: read-only user search by email/name/UUID, real verification/restriction filters, pagination, original-row preservation, existing role scope, anonymous/member/finance denial; missing-only truthful username fallback and no fallback on real failures. Isolated database, not live acceptance.')
}finally{await db.close()}
