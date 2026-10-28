// Isolated PostgreSQL simulation; does NOT connect to the real Supabase project.
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const db=new PGlite(),id='70000000-0000-0000-0000-000000000007'
await db.exec(`create schema auth;create role authenticated;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz);
create table public.user_roles(user_id uuid primary key references auth.users(id),role text);
create table public.audit_logs(actor_id uuid,action text,target text,meta jsonb);`)
await db.query('insert into auth.users values($1,$2,now(),null)',[id,'verified@example.org'])
const source=await readFile('supabase/diagnostics/grant-existing-admin.sql','utf8')
const configured=source.replace('REPLACE_WITH_VERIFIED_EXISTING_AUTH_UUID',id).replace('REPLACE_WITH_EXISTING_ACCOUNT_EMAIL','verified@example.org').replace('REPLACE_WITH_OWNER_APPROVAL_REASON','Owner approved existing account for a local regression test')
async function rejects(sql,pattern){await assert.rejects(db.exec(sql),pattern);await db.exec('rollback; reset role')}
await rejects(source,/Provide the verified/)
await db.exec('set role authenticated');await rejects(configured,/trusted SQL Editor/)
await rejects(configured.replace('verified@example.org','wrong@example.org'),/No confirmed/)
await db.exec(configured);await db.exec(configured)
assert.equal((await db.query('select role from public.user_roles')).rows[0].role,'super_admin')
assert.equal((await db.query('select count(*)::int as n from public.audit_logs')).rows[0].n,1)
await db.exec('update auth.users set email_confirmed_at=null')
await rejects(configured,/No confirmed/)
await db.exec("update auth.users set email_confirmed_at=now(),banned_until=now()+interval '1 day'")
await rejects(configured,/No confirmed/)
await db.close()
console.log('Trusted SQL grant rejects placeholders, non-owner, mismatched/unconfirmed/banned accounts; existing-account grant is audited and idempotent (isolated PostgreSQL)')
