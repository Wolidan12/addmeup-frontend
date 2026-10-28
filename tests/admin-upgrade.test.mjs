// Isolated PostgreSQL only: never connects to the user's Supabase project.
import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const db=new PGlite()
const fixture=await readFile('tests/admin-database.test.mjs','utf8')
await db.exec(fixture.match(/await db\.exec\(`([\s\S]*?)`\)/)[1])
for(const file of ['001_profiles_auth.sql','002_discovery.sql','003_rewards.sql','004_admin_payments_storage.sql'])await db.exec((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;',''))
const sql=await readFile('supabase/manual/005_006_admin_upgrade.sql','utf8')
const id='80000000-0000-0000-0000-000000000008'
await db.query('insert into auth.users(id,email) values($1,$2)',[id,'upgrade-fixture@example.org'])
await db.query("insert into public.user_roles(user_id,role) values($1,'user')",[id])
await db.query("insert into public.audit_logs(actor_id,action,target) values($1,'fixture_before_upgrade',$2)",[id,id])
const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename)
async function snapshot(){const result={};for(const table of tables)result[table]=(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from public."${table}" t`)).rows[0].rows;return result}
const before=await snapshot()
async function rejects(pattern){await assert.rejects(db.exec(sql),pattern);await db.exec('rollback;reset role');assert.equal((await db.query("select to_regprocedure('public.admin_role()') is null as absent")).rows[0].absent,true)}
await db.exec('alter table public.profiles rename column bio to fixture_bio')
await rejects(/Base schema is missing/)
await db.exec('alter table public.profiles rename column fixture_bio to bio')
await db.exec("create table public.account_restrictions(id int)")
await rejects(/partially installed schema/)
await db.exec('drop table public.account_restrictions')
await db.exec('set role authenticated');await rejects(/trusted project owner/)
await db.exec(sql)
assert.deepEqual(await snapshot(),before)
for(const signature of ['admin_role()','admin_can(text)','admin_overview()','admin_list(text,text,text,integer)','admin_mutate(text,text,jsonb,text,uuid)'])assert.equal((await db.query('select to_regprocedure($1) is not null as installed',['public.'+signature])).rows[0].installed,true)
await assert.rejects(db.exec(sql),/partially installed schema/);await db.exec('rollback')
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')
assert.equal((await db.query('select public.admin_role() as role')).rows[0].role,'user')
await assert.rejects(db.query("select public.admin_list('profiles')"),/Permission denied/)
await db.close()
console.log('Guarded 005/006 upgrade passed: base-column/partial-schema/non-owner guards, preserved every existing public row, installed admin functions, replay rejection and ordinary-user denial')
