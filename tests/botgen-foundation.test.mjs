// Isolated SQL only: never production migrations or real authentication.
import {PGlite} from '@electric-sql/pglite'
import {readFile,readdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const templates=JSON.parse(await readFile('src/admin/botgen/templates.json','utf8'))
assert.equal(templates.length,30);assert.equal(new Set(templates.map(t=>t.id)).size,30);assert.equal(new Set(templates.map(t=>t.handler)).size,30)
assert.equal(templates[3].name,'Actual Status Views Recorder')
for(const t of templates){assert.equal(t.status,'CONFIGURATION_ONLY');assert.equal(t.fields.length,2);assert.ok(t.documentation&&t.permissions.length&&t.features.length)}
const db=new PGlite()
try{
 const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1];await db.exec(bootstrap)
 await db.exec('alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now()')
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&(parseInt(f)<=15||parseInt(f)===24)).sort())await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
 await db.exec(await readFile('supabase/manual/botgen_foundation.sql','utf8'))
 const owner=crypto.randomUUID(),otherRoot=crypto.randomUUID(),member=crypto.randomUUID(),moderator=crypto.randomUUID()
 for(const [id,role] of [[owner,'super_admin'],[otherRoot,'super_admin'],[member,'user'],[moderator,'moderator']]){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.org']);if(role!=='user')await db.query('insert into public.user_roles(user_id,role) values($1,$2)',[id,role])}
 await db.query('insert into public.botgen_owners(user_id) values($1)',[owner])
 await db.query('insert into public.points_balance(user_id,balance) values($1,90)',[member])
 const snapshot=async()=>JSON.stringify((await db.query('select (select jsonb_agg(u order by id) from auth.users u) users,(select jsonb_agg(p order by id) from public.profiles p) profiles,(select jsonb_agg(b order by user_id) from public.points_balance b) balances,(select jsonb_agg(l order by id) from public.points_ledger l) ledger')).rows)
 const before=await snapshot()
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'))}
 const bot=crypto.randomUUID(),config={audience_name:'Newsletter subscribers',source_note:'Explicit opt-in form'}
 const save=()=>db.query('select public.botgen_save($1,$2,$3,$4)',[bot,'dbg-01','Audience assistant',config])
 for(const id of [otherRoot,member,moderator]){
  await as(id);assert.equal((await db.query('select public.botgen_is_owner() allowed')).rows[0].allowed,false)
  assert.equal((await db.query('select * from public.botgen_templates')).rows.length,0)
  await assert.rejects(save(),/Permission denied/)
  await assert.rejects(db.query('insert into public.botgen_owners(user_id) values($1)',[id]),/permission denied/)
 }
 await as(null);await assert.rejects(db.query('select public.botgen_is_owner()'),/permission denied/)
 await as(owner);assert.equal((await db.query('select public.botgen_is_owner() allowed')).rows[0].allowed,true)
 const catalog=(await db.query('select * from public.botgen_templates order by id')).rows;assert.deepEqual(catalog,templates)
 await save();await save();assert.equal((await db.query('select * from public.botgen_bots')).rows.length,1)
 assert.equal((await db.query('select * from public.botgen_audit')).rows.length,1,'retry must not duplicate audit')
 assert.deepEqual((await db.query('select configuration from public.botgen_bots where id=$1',[bot])).rows[0].configuration,config)
 await assert.rejects(db.query("update public.botgen_bots set status='ACTIVE' where id=$1",[bot]),/permission denied/)
 await assert.rejects(db.query("update public.botgen_audit set action='deleted'"),/permission denied/)
 for(const invalid of [{...config,api_key:'must-not-be-stored'},[],null,{audience_name:''},{...config,source_note:123},{...config,source_note:'x'.repeat(2001)}])await assert.rejects(db.query('select public.botgen_save($1,$2,$3,$4)',[crypto.randomUUID(),'dbg-01','Assistant',invalid]))
 await assert.rejects(db.query('select public.botgen_save($1,$2,$3,$4)',[bot,'dbg-02','Different template',{topic:'Topic',publish_at:'Later'}]),/template mismatch/)
 await as(otherRoot);assert.equal((await db.query('select * from public.botgen_bots')).rows.length,0);await assert.rejects(db.query('select public.botgen_delete($1)',[bot]),/Permission denied/)
 await db.exec('reset role');await db.query("insert into public.account_restrictions(user_id,reason) values($1,'Fixture restriction')",[owner]);await as(owner);assert.equal((await db.query('select public.botgen_is_owner() allowed')).rows[0].allowed,false);await assert.rejects(save(),/Permission denied/)
 await db.exec('reset role');await db.query('delete from public.account_restrictions where user_id=$1',[owner]);await as(owner)
 await db.query('select public.botgen_delete($1)',[bot]);await db.query('select public.botgen_delete($1)',[bot]);assert.equal((await db.query('select * from public.botgen_bots')).rows.length,0);assert.equal((await db.query('select * from public.botgen_audit')).rows.length,2)
 await db.exec('reset role');assert.equal(await snapshot(),before)
 const source=await readFile('src/pages/Admin.jsx','utf8');assert.match(source,/\['bot_generator','reseller'\]\.includes\(tab\)\?role==='super_admin'/);assert.match(source,/if\(tab==='bot_generator'\).*return}/)
 console.log('PASS bot foundation: 30 distinct configuration specifications; explicit singleton owner + super-admin and restricted/anonymous/member/other-admin denial; RLS, validated persistent saves, retry dedup, immutable audit, safe delete, unchanged Auth/profile/wallet/ledger. No worker or production acceptance claimed.')
}finally{await db.close()}
