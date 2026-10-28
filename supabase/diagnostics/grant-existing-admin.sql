-- SENSITIVE OWNER ACTION. NOT a migration, browser API, or automatic bootstrap.
-- Run only in the existing project's trusted SQL Editor after verifying ownership.
-- First run admin-account-check.sql and independently verify the account's UUID.
-- Replace ALL three inputs below. Unmodified script aborts WITHOUT changing data.
-- No user creation, passwords, public functions, RLS bypass policy, or data reset.
begin;
do $$
declare
  intended_id text := 'REPLACE_WITH_VERIFIED_EXISTING_AUTH_UUID';
  intended_email text := 'REPLACE_WITH_EXISTING_ACCOUNT_EMAIL';
  owner_reason text := 'REPLACE_WITH_OWNER_APPROVAL_REASON';
  target_id uuid;
  previous_role text;
begin
  if current_user not in ('postgres','supabase_admin') then
    raise exception 'Use the project owner trusted SQL Editor';
  end if;
  if intended_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or intended_email like 'REPLACE_%' or owner_reason like 'REPLACE_%'
     or length(trim(owner_reason)) < 12 then
    raise exception 'Provide the verified existing UUID, matching email and owner approval reason';
  end if;
  target_id := intended_id::uuid;
  perform 1 from auth.users where id=target_id and lower(email)=lower(intended_email)
    and email_confirmed_at is not null and (banned_until is null or banned_until < now()) for update;
  if not found then
    raise exception 'No confirmed, unbanned existing account matches BOTH UUID and email';
  end if;
  select role into previous_role from public.user_roles where user_id=target_id for update;
  if previous_role is distinct from 'super_admin' then
    insert into public.user_roles(user_id,role) values(target_id,'super_admin')
      on conflict(user_id) do update set role=excluded.role;
    insert into public.audit_logs(actor_id,action,target,meta)
      values(null,'owner_sql_admin_grant',target_id::text,
        jsonb_build_object('previous_role',previous_role,'new_role','super_admin',
          'reason',owner_reason,'source','trusted_sql_editor','database_role',current_user));
  end if;
end $$;
commit;
-- Re-run the READ-ONLY account check, then sign in at /admin/login and refresh.
-- The actor is NULL because SQL Editor does not authenticate as a browser user;
-- SQL Editor's project access logs identify the executing owner.
