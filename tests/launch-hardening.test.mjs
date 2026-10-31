import {PGlite} from '@electric-sql/pglite'
import {readFile,readdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
for(const baseline of [15,23]){
 const db=new PGlite()
 try{
 await db.exec(bootstrap);await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz;alter default privileges in schema public grant all on tables to anon,authenticated")
 for(const f of(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&parseInt(f)<=baseline).sort())await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;',''))
 const id=crypto.randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,'isolated-launch@example.org'])
 const before=(await db.query('select to_jsonb(p) data from public.points_balance p where user_id=$1',[id])).rows
 const sql=await readFile('supabase/migrations/024_launch_least_privilege.sql','utf8');await db.exec(sql);await db.exec(sql)
 assert.deepEqual((await db.query('select to_jsonb(p) data from public.points_balance p where user_id=$1',[id])).rows,before)
 for(const role of ['anon','authenticated']){const excessive=await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and (has_table_privilege($1,c.oid,'TRUNCATE') or has_table_privilege($1,c.oid,'TRIGGER') or has_table_privilege($1,c.oid,'REFERENCES'))",[role]);assert.equal(excessive.rows.length,0);assert.equal((await db.query("select has_schema_privilege($1,'public','CREATE') allowed",[role])).rows[0].allowed,false)}
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');await db.query("update public.profiles set bio='Still editable by its owner' where id=$1",[id]);await db.query('update public.notifications set is_read=true where user_id=$1',[id]);await assert.rejects(db.query("insert into public.payment_transactions(user_id,provider,reference,amount_kobo) values($1,'paystack','fake',100000)",[id]),/permission denied/);await assert.rejects(db.exec('truncate public.points_balance'),/permission denied/)
 console.log('PASS launch least privilege: baseline '+baseline+', idempotency/data preservation, all public table dangerous grants removed, ordinary profile/read-state writes retained, fake provider writes denied.')
 }finally{await db.close()}
}
