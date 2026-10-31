-- Additive privilege hardening. Never truncates, deletes or modifies application rows.
begin;
do $guard$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'Trusted database owner required'; end if;
 if to_regprocedure('public.admin_bulk_create_managed_profiles(uuid,jsonb,text,boolean)') is null then raise exception 'Complete the reviewed stage-011 schema before applying stage 012'; end if;
end $guard$;
-- TRUNCATE is not protected by RLS and is never needed by browser roles.
revoke truncate on all tables in schema public from public,anon,authenticated;
-- Supabase's global defaults can grant this privilege to tables created later.
-- Schema-specific REVOKE alone cannot undo a global default grant. Address both.
alter default privileges for role postgres revoke truncate on tables from public,anon,authenticated;
alter default privileges for role postgres in schema public revoke truncate on tables from public,anon,authenticated;
insert into public.audit_logs(action,target,meta) values('owner_privilege_hardening','public',jsonb_build_object('migration','012_browser_truncate_hardening','revoked_privilege','TRUNCATE','roles',array['public','anon','authenticated']));
commit;
