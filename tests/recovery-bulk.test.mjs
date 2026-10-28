import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
const files=(await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort(),recovery=await readFile('supabase/manual/007_011_remaining_upgrade.sql','utf8')
async function fresh(stage,hostedDefaults=false,windows=false){const db=new PGlite();await db.exec(bootstrap);if(hostedDefaults)await db.exec('alter default privileges grant execute on functions to anon,authenticated,service_role');for(const f of files.slice(0,stage))await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;','').replaceAll('\n',windows?'\r\n':'\n'));return db}
for(const stage of [6,7,8,9,10,11]){
 const db=await fresh(stage)
 await db.query("insert into auth.users(id,email) values('90000000-0000-0000-0000-000000000001','fixture@example.org')")
 const existing=(await db.query('select * from public.profiles')).rows
 await db.exec(recovery);await db.exec(recovery)
 assert.deepEqual((await db.query('select * from public.profiles')).rows,existing)
 assert.equal((await db.query("select to_regprocedure('public.member_overview()') is not null as ok")).rows[0].ok,true)
 await db.close()
}
const windows=await fresh(6,false,true)
assert.ok((await windows.query("select prosrc from pg_proc where oid='public.admin_role()'::regprocedure")).rows[0].prosrc.includes('\r\n'))
await windows.exec(recovery);await windows.exec(recovery);await windows.close()
const customized=await fresh(6)
await customized.exec("create or replace function public.admin_can(p_scope text) returns boolean language sql stable security definer set search_path=public as $$select true$$")
await assert.rejects(customized.exec(recovery),/Stage 9: unfamiliar or partial/);await customized.exec('rollback')
assert.equal((await customized.query("select to_regprocedure('public.settle_verified_payment(text,bigint,text,text,text)') is null as untouched")).rows[0].untouched,true)
await customized.close()
const hosted=await fresh(6,true);await hosted.exec(recovery);await hosted.exec(recovery);await hosted.close()
const db=await fresh(6)
await db.exec("create table public.managed_profiles(partial int)")
await assert.rejects(db.exec(recovery),/Stage 9: unfamiliar or partial/);await db.exec('rollback')
assert.equal((await db.query("select to_regprocedure('public.settle_verified_payment(text,bigint,text,text,text)') is null as untouched")).rows[0].untouched,true)
await db.exec('drop table public.managed_profiles');await db.exec(recovery)
const root='91000000-0000-0000-0000-000000000002',user='92000000-0000-0000-0000-000000000003',other='93000000-0000-0000-0000-000000000004'
for(const id of [root,user,other])await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.org'])
await db.query("insert into public.user_roles(user_id,role) values($1,'super_admin'),($2,'moderator')",[root,other])
async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
const listing=(name)=>({username:name,display_name:'Fixture listing',bio:'Owner-approved listing',country:'NG',interests:['music'],avatar_url:'',is_public:false,social_links:[{platform:'instagram',url:'https://instagram.com/fixture',is_public:true}]})
const call=(rows,request=crypto.randomUUID(),reason='Owner approved these listings',confirm=true)=>db.query('select public.admin_bulk_create_managed_profiles($1,$2,$3,$4) as result',[request,JSON.stringify(rows),reason,confirm])
await as(null);await assert.rejects(call([listing('denied_anon')]),/permission denied/i)
await as(user);await assert.rejects(call([listing('denied_user')]),/Permission denied/)
await as(other);await assert.rejects(call([listing('denied_moderator')]),/Permission denied/)
await as(root)
await assert.rejects(call([]),/1 to 25/);await assert.rejects(call(Array.from({length:26},(_,i)=>listing('many_'+i))),/1 to 25/)
await assert.rejects(call([listing('no_confirm')],undefined,undefined,false),/Confirm permission/)
await assert.rejects(call([listing('short_reason')],undefined,'short'),/Confirm permission/)
await assert.rejects(call([listing('dup'),listing('dup')]),/Duplicate usernames/)
await assert.rejects(call([listing('atomic_good'),{...listing('atomic_bad'),social_links:[{platform:'instagram',url:'https://instagram.com.evil.example/x',is_public:true}]}]),/Listing 2/)
assert.equal((await db.query("select count(*)::int as n from public.managed_profiles where username='atomic_good'")).rows[0].n,0)
await assert.rejects(call([{...listing('bad_name'),display_name:' '}]),/Listing 1/)
await assert.rejects(call([{...listing('role_inject'),role:'super_admin'}]),/Invalid listing fields/)
await assert.rejects(call([{...listing('bad_photo'),avatar_url:'javascript:alert(1)'}]),/Photo URL/)
const batch=crypto.randomUUID(),rows=[listing('bulk_one'),{...listing('bulk_two'),is_public:true}]
const first=(await call(rows,batch)).rows[0].result
assert.equal(first.count,2);assert.deepEqual((await call(rows,batch)).rows[0].result,first)
await assert.rejects(call([listing('changed')],batch),/different details/)
await assert.rejects(call([listing('bulk_one')]),/Username is already used/)
await db.exec('reset role')
assert.equal((await db.query("select count(*)::int as n from public.audit_logs where action='managed_profiles_bulk_created'")).rows[0].n,1)
assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,3)
await as(user);await assert.rejects(db.query('select * from public.managed_profile_batches'),/permission denied/i)
await assert.rejects(db.query("insert into public.managed_profiles(username,display_name,created_by) values('bypass','Bypass',$1)",[user]),/permission denied/i)
await as(null);assert.equal((await db.query('select count(*)::int as n from public.managed_profiles')).rows[0].n,1)
await db.close()
console.log('Recovery from 006/007/008/009/010/011, replay/partial rollback, bulk auth/validation/atomicity/idempotency/audit/privacy and no Auth-account creation passed')
