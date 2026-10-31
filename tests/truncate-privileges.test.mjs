import {PGlite} from '@electric-sql/pglite'
import {readFile,readdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const db=new PGlite()
const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
await db.exec(bootstrap)
await db.exec('alter default privileges grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant truncate on tables to anon,authenticated')
for(const f of (await readdir('supabase/migrations')).sort().filter(f=>/^0(0[1-9]|1[01])_/.test(f)))await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
await db.exec("insert into auth.users(id,email) values('81000000-0000-0000-0000-000000000001','permission-fixture@example.org')")
const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename)
async function snapshot(){return Promise.all(tables.map(async t=>[t,(await db.query(`select to_jsonb(t) as row from public.${t} t order by to_jsonb(t)::text`)).rows]))}
const before=await snapshot()
assert.equal((await db.query("select has_table_privilege('anon','public.profiles','truncate') as allowed")).rows[0].allowed,true)
const sql=await readFile('supabase/migrations/012_browser_truncate_hardening.sql','utf8');await db.exec(sql)
for(const role of ['anon','authenticated'])for(const t of tables)assert.equal((await db.query('select has_table_privilege($1,$2,\'truncate\') as allowed',[role,'public.'+t])).rows[0].allowed,false)
const after=await snapshot()
for(let i=0;i<tables.length;i++)if(tables[i]!=='audit_logs')assert.deepEqual(after[i],before[i])
assert.equal(after.find(([t])=>t==='audit_logs')[1].length,before.find(([t])=>t==='audit_logs')[1].length+1)
await db.exec('create table public.future_global_default_test(id int)')
for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_table_privilege($1,'public.future_global_default_test','truncate') as allowed",[role])).rows[0].allowed,false)
assert.equal((await db.query("select has_table_privilege('service_role','public.future_global_default_test','truncate') as allowed")).rows[0].allowed,true)
// Actual denied operations are confined to this isolated, disposable test database.
await db.exec('set role anon');await assert.rejects(db.exec('truncate public.future_global_default_test'),/permission denied/i);await db.exec('reset role')
await db.exec(sql)
assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,1)
await db.close()
console.log('Hosted-default TRUNCATE exposure reproduced; migration denies browser/current/future truncation, preserves existing rows and service role privileges')
