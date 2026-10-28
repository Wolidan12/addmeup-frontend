-- Owner-only, READ-ONLY: run in the EXISTING project's trusted SQL Editor.
-- Replace the email below locally; never paste passwords or keys into this file.
-- Zero rows means no matching existing Auth account in THIS project.
select u.id, u.email_confirmed_at is not null as email_confirmed,
       u.banned_until, r.role as assigned_role,
       case when r.role='admin' then 'super_admin' else r.role end as effective_role,
       p.id is not null as has_profile
from auth.users u
left join public.user_roles r on r.user_id=u.id
left join public.profiles p on p.id=u.id
where lower(u.email)=lower('REPLACE_WITH_EXISTING_ACCOUNT_EMAIL');
-- Do not infer access from profile existence: admin_role() reads user_roles.
-- See deployment-readiness.sql for required function installation checks.
