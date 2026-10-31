// Actual isolated PostgreSQL verification of evidence SQL and security/row drift.
// NOT a pg_dump archive restore, NOT a production backup or Docker test.
import assert from 'node:assert/strict'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import EmbeddedPostgres from 'embedded-postgres'
const code="import json,runpy; x=runpy.run_path('scripts/manual-backup.py'); print(json.dumps({k:x[k] for k in ['TABLES','FINANCIAL','SECURITY','EXTENSIONS']}|{'fingerprint':x['fingerprint_sql']('public','points_ledger'),'roles':x['guarded_roles']('CREATE ROLE postgres;\\nCREATE ROLE \\\"fixture role\\\";')}))"
const sql=JSON.parse(execFileSync('python3',['-c',code],{encoding:'utf8'}))
const cluster=new EmbeddedPostgres({databaseDir:await mkdtemp(join(tmpdir(),'danqel-backup-sql-')),port:55453,user:'postgres',password:'isolated-backup-tests-only',persistent:false,onLog:()=>{},onError:()=>{},postgresFlags:['-c','listen_addresses=127.0.0.1']})
let admin,source,copy
try{
 await cluster.initialise();await cluster.start();admin=cluster.getPgClient();await admin.connect()
 await admin.query('create database backup_fixture')
 source=cluster.getPgClient('backup_fixture');await source.connect()
 await source.query(`create schema auth;create schema storage;create schema supabase_migrations;
 create role authenticated;create table auth.users(id int primary key,email text,password_hash text);
 create table public.profiles(id int primary key,display_name text);
 create table public.points_balance(user_id int primary key,balance numeric);
 create table public.points_ledger(id int primary key,user_id int,points numeric);
 insert into auth.users values(1,'fixture-one@example.org','fixture-not-a-real-hash'),(2,'fixture-two@example.org','fixture-not-a-real-hash');
 insert into public.profiles values(1,'Fixture One'),(2,'Fixture Two');
 insert into public.points_balance values(1,90);
 insert into public.points_ledger select i,1,15 from generate_series(1,6) i;
 alter table public.points_ledger enable row level security;
 create policy own_ledger on public.points_ledger for select to authenticated using(user_id=1);
 grant select on public.points_ledger to authenticated;
 create function public.backup_fixture() returns int language sql security definer set search_path=public as $$select 1$$;`)
 await source.query(sql.roles)
 const read=async client=>({tables:(await client.query(sql.TABLES)).rows[0].coalesce,extensions:(await client.query(sql.EXTENSIONS)).rows[0].coalesce,financial:(await client.query(sql.FINANCIAL)).rows[0].json_build_object,security:(await client.query(sql.SECURITY)).rows[0].json_build_object,fingerprint:(await client.query(sql.fingerprint)).rows[0].json_build_object})
 const original=await read(source)
 assert.equal(original.financial.total_dc,'90');assert.equal(original.fingerprint.rows,6);assert.match(original.fingerprint.sha256,/^[a-f0-9]{64}$/)
 await source.end();source=null
 await admin.query('create database restored_fixture template backup_fixture')
 copy=cluster.getPgClient('restored_fixture');await copy.connect()
 assert.deepEqual(await read(copy),original)
 await copy.query('update public.points_ledger set points=16 where id=1;alter table public.points_ledger disable row level security')
 const changed=await read(copy);assert.notDeepEqual(changed.fingerprint,original.fingerprint);assert.notDeepEqual(changed.security,original.security)
 console.log('PASS real isolated PostgreSQL evidence SQL, quoted-role guards, row fingerprints, clone comparison and data/RLS drift detection. NOT an archive/Docker restore or production backup verification.')
}finally{if(source)await source.end();if(copy)await copy.end();if(admin)await admin.end();await cluster.stop()}
