// Generate a guarded owner-only recovery from authoritative, unchanged migrations.
// Fingerprints reject unfamiliar/partial schemas rather than overwriting custom functions.
import {PGlite} from '@electric-sql/pglite'
import {readFile,writeFile,readdir} from 'node:fs/promises'
const db=new PGlite(),fixture=await readFile('tests/admin-database.test.mjs','utf8')
await db.exec(fixture.match(/await db\.exec\(`([\s\S]*?)`\)/)[1])
const names=(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort(),states=[]
async function catalog(){return {
 functions:(await db.query(`select 'public.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' as sig,md5(replace(p.prosrc,E'\\r\\n',E'\\n')||p.prosecdef::text||coalesce(p.proconfig::text,'')) as hash,
 has_function_privilege('anon',p.oid,'execute') as anon,has_function_privilege('authenticated',p.oid,'execute') as auth,has_function_privilege('service_role',p.oid,'execute') as service
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`)).rows,
 columns:(await db.query("select table_name t,column_name c,udt_name typ from information_schema.columns where table_schema='public' order by table_name,ordinal_position")).rows,
 tables:(await db.query("select tablename from pg_tables where schemaname='public'")).rows.map(x=>x.tablename),
 policies:(await db.query("select schemaname s,tablename t,policyname p from pg_policies where schemaname in ('public','storage')")).rows,
}}
states[0]=await catalog()
for(let i=0;i<names.length;i++){await db.exec((await readFile('supabase/migrations/'+names[i],'utf8')).replace('create extension if not exists pgcrypto;',''));states[i+1]=await catalog()}
const q=x=>"'"+x.replaceAll("'","''")+"'",and=parts=>parts.length?'('+parts.join('\n and ')+')':'true'
function fncheck(f){return `exists(select 1 from pg_proc p where p.oid=to_regprocedure(${q(f.sig)}) and md5(replace(p.prosrc,E'\\r\\n',E'\\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))=${q(f.hash)} and has_function_privilege('anon',p.oid,'execute')=${f.anon} and has_function_privilege('authenticated',p.oid,'execute')=${f.auth}${f.sig.startsWith('public.settle_verified_payment(')?" and has_function_privilege('service_role',p.oid,'execute')=true":''})`}
function colcheck(cols){return cols.map(x=>`exists(select 1 from information_schema.columns where table_schema='public' and table_name=${q(x.t)} and column_name=${q(x.c)} and udt_name=${q(x.typ)})`)}
let out=`-- OWNER-ONLY recovery 007–011. Back up first; run the ENTIRE file in the EXISTING project.
-- No Auth users/roles are created, no data reset. Existing stages are verified and skipped.
-- Exact known function fingerprints + column/policy checks fail closed on partial/custom installs.
-- All stages share ONE transaction: an error rolls back every change in this run.
-- Changes include reward hardening, provider verifier, bank/managed listings, member programmes,
-- and atomic bulk managed profiles. Prices/plans are NOT invented. Edge Functions need separate deployment.
begin;
select pg_advisory_xact_lock(hashtextextended('danqel-recovery-007-011',0));
do $recovery$
declare applied int[]:=array[]::int[];
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'Use the trusted owner SQL Editor'; end if;
 if to_regprocedure('public.admin_role()') is null or to_regprocedure('public.admin_list(text,text,text,integer)') is null then raise exception '006 admin operations must already be installed'; end if;
`
for(let stage=7;stage<=11;stage++){
 const before=states[stage-1],after=states[stage]
 const changed=after.functions.filter(f=>!before.functions.some(b=>b.sig===f.sig&&JSON.stringify(b)===JSON.stringify(f)))
 const newTables=after.tables.filter(t=>!before.tables.includes(t))
 const newPolicies=after.policies.filter(p=>!before.policies.some(b=>JSON.stringify(b)===JSON.stringify(p)))
 const addedColumns=after.columns.filter(c=>!before.columns.some(b=>JSON.stringify(b)===JSON.stringify(c)))
 const done=and([
 ...changed.map(f=>{const variants=states.slice(stage).flatMap(s=>s.functions.filter(x=>x.sig===f.sig));const unique=[...new Map(variants.map(x=>[JSON.stringify(x),x])).values()];return '('+unique.map(fncheck).join('\n or ')+')'}),
 ...colcheck(addedColumns),...newPolicies.map(p=>`exists(select 1 from pg_policies where schemaname=${q(p.s)} and tablename=${q(p.t)} and policyname=${q(p.p)})`),
 ...newTables.map(t=>`exists(select 1 from pg_class where oid=to_regclass(${q('public.'+t)}) and relrowsecurity)`),
 ])
 const base=and([...changed.map(f=>{const old=before.functions.find(b=>b.sig===f.sig);return old?fncheck(old):`to_regprocedure(${q(f.sig)}) is null`}),...colcheck(before.columns),...newTables.map(t=>`to_regclass(${q('public.'+t)}) is null`)])
 const src=(await readFile('supabase/migrations/'+names[stage-1],'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'')
 out+=`\n -- Stage ${stage}: ${names[stage-1]}\n if ${done} then\n raise notice 'Stage ${stage} verified; skipped';\n elsif ${base} then\n execute $stage${stage}$\n${src}\n$stage${stage}$;\n applied:=array_append(applied,${stage});\n raise notice 'Stage ${stage} applied';\n else raise exception 'Stage ${stage}: unfamiliar or partial schema; no changes committed. Request owner review rather than removing guards.';\n end if;\n`
}
out+=`if cardinality(applied)>0 then insert into public.audit_logs(action,target,meta) values('owner_remaining_upgrade','schema',jsonb_build_object('stages',applied,'source','trusted_sql_editor')); end if;
end $recovery$;
commit;
select to_regprocedure('public.member_overview()') is not null as member_ready,
 to_regprocedure('public.admin_save_managed_profile(uuid,jsonb,text)') is not null as managed_profiles_ready,
 to_regprocedure('public.admin_bulk_create_managed_profiles(uuid,jsonb,text,boolean)') is not null as bulk_profiles_ready;
`
await writeFile('supabase/manual/007_011_remaining_upgrade.sql',out)
await db.close();console.log('Generated guarded, stage-aware 007–011 recovery')
