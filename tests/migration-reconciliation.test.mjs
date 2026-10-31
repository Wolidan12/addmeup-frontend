// Rehearses the ACTUAL order: 001–015 → already-applied 024 → 016–023.
// A synthetic representative data fixture is not a production backup/restore.
import assert from 'node:assert/strict'
import {readFile,readdir,mkdtemp,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {buildReconciliation} from '../scripts/build-reconciliation.mjs'
import {inventory} from '../scripts/migration-reconciliation.mjs'
import {PGlite} from '@electric-sql/pglite'
let db,cluster
if(process.env.POSTGRES_TEST==='1'){const {default:EmbeddedPostgres}=await import('embedded-postgres');cluster=new EmbeddedPostgres({databaseDir:await mkdtemp(join(tmpdir(),'danqel-reconcile-')),port:55451,user:'postgres',password:'isolated-reconciliation-only',persistent:false,onLog:()=>{},onError:()=>{},postgresFlags:['-c','listen_addresses=127.0.0.1']});await cluster.initialise();await cluster.start();const client=cluster.getPgClient();await client.connect();db={exec:s=>client.query(s),query:(...a)=>client.query(...a),close:()=>client.end()}}else db=new PGlite()
const events=[]
try{
 const bootstrap=(await readFile('tests/admin-database.test.mjs','utf8')).match(/await db\.exec\(`([\s\S]*?)`\)/)[1];await db.exec(bootstrap);await db.exec("alter table auth.users add column email_confirmed_at timestamptz,add column last_sign_in_at timestamptz,add column banned_until timestamptz,add column created_at timestamptz default now();alter default privileges in schema public grant all on tables to anon,authenticated")
 const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort(),sql=async f=>(await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto;','')
 for(const f of files.filter(f=>parseInt(f)<=15))await db.exec(await sql(f))
 const root=crypto.randomUUID(),member=crypto.randomUUID();for(const [id,email] of [[root,'root-reconcile@example.org'],[member,'member-reconcile@example.org']])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,email])
 await db.query("insert into public.user_roles(user_id,role) values($1,'admin')",[root])
 // Seed at the OLD baseline, before strict new DC journal triggers exist.
 for(const id of [root,member]){if(id===root){await db.query('insert into public.points_balance(user_id,balance) values($1,90) on conflict(user_id) do update set balance=90',[id]);for(let i=0;i<6;i++)await db.query("insert into public.points_ledger(user_id,points,reason,ref_key) values($1,15,'Historical fixture credit',$2)",[id,'legacy:'+id+':'+i])};await db.query("update public.profiles set display_name='Eligible fixture',bio='Historical profile kept verbatim',country='NG',avatar_url='https://example.org/avatar.webp',interests=array['music'] where id=$1",[id])}
 const snapshot=async()=>({users:(await db.query('select id,email,email_confirmed_at from auth.users order by id')).rows,profiles:(await db.query('select to_jsonb(p) p from public.profiles p order by id')).rows,ledger:(await db.query('select to_jsonb(l) l from public.points_ledger l order by id')).rows,balances:(await db.query('select user_id,balance::text balance from public.points_balance order by user_id')).rows})
 const before=await snapshot();assert.equal(before.balances.reduce((s,r)=>s+Number(r.balance),0),90);await db.exec(await sql(files.find(f=>f.startsWith('024_'))))
 let launchAmount=0
 if(process.env.ATOMIC_RECONCILIATION==='1'){
  const artifact=await buildReconciliation();await assert.rejects(db.exec(artifact),/backup and restore owner/);await db.exec('rollback');assert.equal((await db.query("select to_regclass('public.dc_transactions') t")).rows[0].t,null)
  for(const [key,value] of Object.entries({'danqel.recovery_verified':'yes','danqel.backup_reference':'isolated-fixture-NOT-a-production-backup','danqel.restore_owner':'isolated-test-runner','danqel.backup_verified_at':new Date().toISOString(),'danqel.authorize_launch_dc':'10000'}))await db.query('select set_config($1,$2,false)',[key,value])
  await assert.rejects(db.exec(artifact.replace('<>10090','<>10091')),/unexpected financial delta/);await db.exec('rollback');assert.deepEqual(await snapshot(),before);assert.equal((await db.query("select to_regclass('public.dc_transactions') t")).rows[0].t,null)
  await db.exec(artifact);events.push({migration:'atomic_reconcile_016_023_after_024',status:'PASS',missingEvidenceBlocks:true,postcheckFailureRollsBackAll:true,originalLedgerRowsPreserved:6,balanceTotal:10090})
 }else for(const f of files.filter(f=>parseInt(f)>=16&&parseInt(f)<=23)){
  const info=(await inventory()).find(i=>i.file===f);await db.exec(await sql(f));const current=await snapshot();assert.deepEqual(current.users,before.users,f+': Auth rows');assert.deepEqual(current.profiles,before.profiles,f+': profiles');assert.deepEqual(current.ledger.filter(r=>before.ledger.some(b=>b.l.id===r.l.id)),before.ledger,f+': original ledger rows')
  launchAmount=parseInt(f)>=18?10000:0;assert.equal(Number((await db.query('select sum(balance) total from public.points_balance')).rows[0].total),90+launchAmount,f+': only explicitly authorized launch awards')
  const dangerous=(await db.query("select count(*) n from information_schema.role_table_grants where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')")).rows[0].n;assert.equal(Number(dangerous),0,f+': preserves 024 dangerous-grant hardening')
  for(const t of info.newTables){const result=await db.query('select relrowsecurity from pg_class where oid=$1::regclass',['public.'+t]);assert.equal(result.rows[0].relrowsecurity,true,t+' RLS')}
  events.push({migration:f,sha256:info.sha256,status:'PASS',users:2,originalLedgerRowsPreserved:6,balanceTotal:90+launchAmount,dangerousBrowserGrants:0})
 }
 assert.equal(Number((await db.query('select count(*) n from public.launch_awards')).rows[0].n),2);assert.equal(Number((await db.query("select count(*) n from public.dc_transactions where snapshot_origin='reconstructed'")).rows[0].n),6)
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[root]);await db.exec('set role authenticated');assert.equal((await db.query('select public.admin_role() role')).rows[0].role,'super_admin');assert.equal(Number((await db.query('select count(*) n from public.points_balance where user_id<>auth.uid()')).rows[0].n),0)
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[member]);await db.exec('set role authenticated');await assert.rejects(db.query('select public.admin_metrics()'),/Permission denied/);await assert.rejects(db.exec('update public.points_balance set balance=999'),/permission denied/)
 await db.exec('reset role');await db.exec(await sql(files.find(f=>f.startsWith('024_')))) // Idempotent final ACL reconciliation; not a fake history repair.
 if(process.env.RECONCILIATION_OUTPUT)await writeFile(process.env.RECONCILIATION_OUTPUT,JSON.stringify({environment:cluster?'isolated-real-postgresql':'pglite',productionBackup:false,events},null,2)+'\n')
 console.log('PASS exact 024-before-016–023 order: users/profiles/6 historical rows preserved, only 2 authorized 5,000-DC launch awards, 024 privileges retained at every step, reconstructed history, mapped legacy admin, ordinary RLS/credit-write denial. Isolated rehearsal, NOT production or a restore test.')
}finally{await db.close();if(cluster)await cluster.stop()}
