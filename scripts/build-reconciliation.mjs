// Generates an auditable FORWARD migration artifact. Does not connect or execute.
import {readFile,writeFile} from 'node:fs/promises'
import {inventory} from './migration-reconciliation.mjs'
export async function buildReconciliation(){
 const rows=await inventory(),pending=rows.filter(r=>r.number<24)
 const bodies=[];for(const row of [...pending,rows.find(r=>r.number===24)]){let text=await readFile('supabase/migrations/'+row.file,'utf8');if(!/^begin;$/im.test(text)||!/^commit;\s*$/im.test(text))throw new Error('Unexpected transaction envelope');text=text.replace(/^begin;\s*$/im,'').replace(/^commit;\s*$/im,'');bodies.push('-- SOURCE '+row.file+' SHA256 '+row.sha256+'\n'+text)}
 const tables=pending.flatMap(r=>r.newTables)
 return `-- GENERATED; review with MIGRATION_RECONCILIATION.md. NOT EXECUTED.
-- Register ONE new forward migration named reconcile_016_023_after_024, not fake historical versions.
-- Operator must provide recovery evidence via transaction-local session settings in the SAME trusted session.
-- Settings are an execution attestation, not independent proof of backup availability.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
select pg_advisory_xact_lock(24016023);
lock table auth.users,public.profiles,public.points_balance,public.points_ledger in share row exclusive mode;
do $$begin
 if current_setting('danqel.recovery_verified',true) is distinct from 'yes' or length(coalesce(current_setting('danqel.backup_reference',true),''))<3 or length(coalesce(current_setting('danqel.restore_owner',true),''))<3 then raise exception 'STOP: recent backup and restore owner evidence required';end if;
 if nullif(current_setting('danqel.backup_verified_at',true),'')::timestamptz is null or nullif(current_setting('danqel.backup_verified_at',true),'')::timestamptz<now()-interval '24 hours' or nullif(current_setting('danqel.backup_verified_at',true),'')::timestamptz>now() then raise exception 'STOP: backup evidence is stale or invalid';end if;
 if current_setting('danqel.authorize_launch_dc',true) is distinct from '10000' then raise exception 'STOP: explicit 10000-DC launch authorization required';end if;
 if(select count(*) from auth.users)<>2 or(select count(*) from public.profiles)<>2 or(select count(*) from public.points_ledger)<>6 or(select count(*) from public.points_balance)<>1 or(select coalesce(sum(balance),0) from public.points_balance)<>90 or exists(select 1 from public.bank_point_orders) or exists(select 1 from public.payment_transactions) then raise exception 'STOP: production baseline changed; re-audit before rollout';end if;
 if exists(select 1 from unnest(array[${tables.map(t=>"'public."+t+"'").join(',')}]) t where to_regclass(t) is not null) then raise exception 'STOP: pending objects already exist; reconcile partial history manually';end if;
 if exists(select 1 from information_schema.role_table_grants where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')) then raise exception 'STOP: 024 hardening has drifted';end if;
end$$;
create temporary table reconciliation_auth on commit drop as select id,to_jsonb(u) data from auth.users u;
create temporary table reconciliation_profiles on commit drop as select id,to_jsonb(p) data from public.profiles p;
create temporary table reconciliation_ledger on commit drop as select id,to_jsonb(l) data from public.points_ledger l;
${bodies.join('\n\n')}
do $$begin
 if(select count(*) from auth.users)<>2 or(select count(*) from public.profiles)<>2 or(select count(*) from public.points_ledger)<>8 or(select count(*) from public.launch_awards)<>2 or(select coalesce(sum(amount_dc),0) from public.launch_awards)<>10000 or(select coalesce(sum(balance),0) from public.points_balance)<>10090 then raise exception 'STOP: unexpected financial delta; rollback entire rollout';end if;
 if exists(select 1 from reconciliation_auth s left join auth.users u on u.id=s.id where u.id is null or s.data<>to_jsonb(u)) then raise exception 'STOP: historical Auth alteration';end if;
 if exists(select 1 from reconciliation_profiles s left join public.profiles p on p.id=s.id where p.id is null or s.data<>to_jsonb(p)) or exists(select 1 from reconciliation_ledger s left join public.points_ledger l on l.id=s.id where l.id is null or s.data<>to_jsonb(l)) then raise exception 'STOP: historical profile/ledger alteration';end if;
 if exists(select 1 from public.dc_transactions where status<>'successful') or(select count(*) from public.dc_transactions where snapshot_origin='reconstructed')<>6 then raise exception 'STOP: journal not reconciled';end if;
 if has_function_privilege('service_role','public.settle_verified_payment(text,bigint,text,text,text)','EXECUTE') then raise exception 'STOP: provider settlement unexpectedly enabled';end if;
 if exists(select 1 from information_schema.role_table_grants where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')) then raise exception 'STOP: hardening regression';end if;
end$$;
commit;
`
}
if(process.argv[1]?.endsWith('build-reconciliation.mjs')){await writeFile('supabase/manual/reconcile_016_023_after_024.sql',await buildReconciliation());console.log('Generated guarded atomic forward artifact. No database connected or modified.')}
