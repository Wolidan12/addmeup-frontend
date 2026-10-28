-- OWNER-ONLY, ONE-TIME UPGRADE of an existing 001-004 compatible database.
-- Applies repository migrations 005 and 006 together, atomically.
-- Preserves existing accounts/data; changes security policies/functions as documented.
-- Does NOT grant any administrator role or install member programmes (007-010).
-- Take an appropriate backup first. Run the ENTIRE file in the trusted SQL Editor.
-- On any error: STOP, do not remove guards; run ROLLBACK before the next query.
begin;
do $preflight$
declare missing text; policy_name text;
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'Use the trusted project owner SQL Editor'; end if;
 if to_regclass('public.account_restrictions') is not null
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_role','admin_can','admin_list','admin_overview','admin_mutate','member_overview')) then
 raise exception 'A newer or partially installed schema was detected. Stop for review; do not replay this upgrade.'; end if;
 select string_agg(e.t||'.'||e.c,', ') into missing
 from (values
('audit_logs','id','uuid'),
('audit_logs','actor_id','uuid'),
('audit_logs','action','text'),
('audit_logs','target','text'),
('audit_logs','meta','jsonb'),
('audit_logs','created_at','timestamptz'),
('blocks','blocker_id','uuid'),
('blocks','blocked_id','uuid'),
('blocks','created_at','timestamptz'),
('favourites','user_id','uuid'),
('favourites','profile_id','uuid'),
('favourites','created_at','timestamptz'),
('notifications','id','uuid'),
('notifications','user_id','uuid'),
('notifications','title','text'),
('notifications','body','text'),
('notifications','is_read','bool'),
('notifications','created_at','timestamptz'),
('payment_transactions','id','uuid'),
('payment_transactions','user_id','uuid'),
('payment_transactions','provider','text'),
('payment_transactions','reference','text'),
('payment_transactions','amount_kobo','int4'),
('payment_transactions','status','text'),
('payment_transactions','created_at','timestamptz'),
('payment_transactions','verified_at','timestamptz'),
('points_balance','user_id','uuid'),
('points_balance','balance','int4'),
('points_balance','current_streak','int4'),
('points_balance','last_checkin','date'),
('points_balance','referral_code','text'),
('points_balance','referred_by','uuid'),
('points_ledger','id','uuid'),
('points_ledger','user_id','uuid'),
('points_ledger','points','int4'),
('points_ledger','reason','text'),
('points_ledger','ref_key','text'),
('points_ledger','created_at','timestamptz'),
('profile_views','profile_id','uuid'),
('profile_views','viewer_id','uuid'),
('profile_views','viewed_on','date'),
('profiles','id','uuid'),
('profiles','username','text'),
('profiles','display_name','text'),
('profiles','bio','text'),
('profiles','country','text'),
('profiles','interests','_text'),
('profiles','avatar_url','text'),
('profiles','is_public','bool'),
('profiles','is_sponsored','bool'),
('profiles','created_at','timestamptz'),
('promotions','id','uuid'),
('promotions','title','text'),
('promotions','description','text'),
('promotions','price_kobo','int4'),
('promotions','is_active','bool'),
('promotions','created_at','timestamptz'),
('purchases','id','uuid'),
('purchases','user_id','uuid'),
('purchases','item_title','text'),
('purchases','transaction_id','uuid'),
('purchases','created_at','timestamptz'),
('referrals','id','uuid'),
('referrals','referrer_id','uuid'),
('referrals','referred_id','uuid'),
('referrals','created_at','timestamptz'),
('referrals','rewarded','bool'),
('reports','id','uuid'),
('reports','reporter_id','uuid'),
('reports','profile_id','uuid'),
('reports','reason','text'),
('reports','status','text'),
('reports','created_at','timestamptz'),
('reward_config','key','text'),
('reward_config','value','int4'),
('reward_tasks','id','uuid'),
('reward_tasks','slug','text'),
('reward_tasks','title','text'),
('reward_tasks','description','text'),
('reward_tasks','points','int4'),
('reward_tasks','daily_limit','int4'),
('reward_tasks','is_active','bool'),
('social_links','id','uuid'),
('social_links','profile_id','uuid'),
('social_links','platform','text'),
('social_links','url','text'),
('social_links','is_public','bool'),
('subscriptions','id','uuid'),
('subscriptions','user_id','uuid'),
('subscriptions','plan','text'),
('subscriptions','status','text'),
('subscriptions','starts_at','timestamptz'),
('subscriptions','expires_at','timestamptz'),
('task_claims','user_id','uuid'),
('task_claims','task_slug','text'),
('task_claims','claimed_on','date'),
('task_claims','count','int4'),
('user_roles','user_id','uuid'),
('user_roles','role','text'),
('user_roles','created_at','timestamptz')
) as e(t,c,typ)
 left join information_schema.columns a on a.table_schema='public' and a.table_name=e.t and a.column_name=e.c and a.udt_name=e.typ
 where a.column_name is null;
 if missing is not null then raise exception 'Base schema is missing or has unexpected column types: %',missing; end if;
 if not exists(select 1 from pg_constraint where conrelid='public.user_roles'::regclass and conname='user_roles_role_check') then raise exception 'Expected role constraint is missing; stop for review'; end if;
 for policy_name in select v.name from (values ('payment_transactions:pay own read'),('subscriptions:sub own read'),('reports:reports admin update'),('promotions:promo admin write'),('audit_logs:audit admin read'),('notifications:notif own')) v(name) loop
 if not exists(select 1 from pg_policies where schemaname='public' and tablename=split_part(policy_name,':',1) and policyname=split_part(policy_name,':',2)) then raise exception 'Expected base policy is missing: %',policy_name; end if;
 end loop;
 if to_regprocedure('public.is_admin()') is null then raise exception 'Base authorization function is missing'; end if;
end $preflight$;

-- BEGIN existing migration 005
-- 005 ADDITIVE hardening: close RLS gaps found in audit. Preserves all data.
alter table public.reward_config enable row level security;
alter table public.referrals enable row level security;
-- reward_config: NO client policies = clients can neither read nor write config; security-definer claim functions still work. Admins edit via SQL Editor/service role.
drop policy if exists "referrals own read" on public.referrals;
create policy "referrals own read" on public.referrals for select using(auth.uid()=referrer_id or auth.uid()=referred_id);
-- task_claims & profile_views intentionally have RLS with no client policies: only security-definer functions write them.
grant select on public.referrals to authenticated;
create index if not exists idx_social_links_profile on public.social_links(profile_id);
create index if not exists idx_points_ledger_user on public.points_ledger(user_id, created_at desc);
create index if not exists idx_reports_status on public.reports(status, created_at desc);
create index if not exists idx_payment_user on public.payment_transactions(user_id, created_at desc);

-- BEGIN existing migration 006
-- Stage 1. Apply AFTER 001–005. Additive; never reset production.

alter table public.user_roles drop constraint user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check(role in ('user','admin','super_admin','moderator','finance_admin','support_agent'));
create or replace function public.admin_role() returns text language sql stable security definer set search_path=public as $$
 select case when role='admin' then 'super_admin' else role end from public.user_roles where user_id=auth.uid()
$$;
create or replace function public.admin_can(p_scope text) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(public.admin_role()='super_admin' or
 (public.admin_role()='moderator' and p_scope in ('overview','profiles','social_links','reports','reward_tasks')) or
 (public.admin_role()='finance_admin' and p_scope in ('overview','payment_transactions','subscriptions','promotions','points_ledger','points_balance','referrals')) or
 (public.admin_role()='support_agent' and p_scope in ('overview','profiles','reports','notifications')),false)
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select coalesce(public.admin_role() in ('super_admin','moderator'),false)$$;
create table public.account_restrictions(user_id uuid primary key references auth.users(id) on delete cascade, reason text not null, actor_id uuid, created_at timestamptz not null default now());
alter table public.account_restrictions enable row level security;
create policy "own restriction read" on public.account_restrictions for select to authenticated using(user_id=auth.uid());
grant select on public.account_restrictions to authenticated;
-- Existing broad policies are replaced by explicit server-side scopes.
drop policy "pay own read" on public.payment_transactions;
create policy "pay own read" on public.payment_transactions for select using(user_id=auth.uid());
drop policy "sub own read" on public.subscriptions;
create policy "sub own read" on public.subscriptions for select using(user_id=auth.uid());
drop policy "reports admin update" on public.reports;
drop policy "promo admin write" on public.promotions;
drop policy "audit admin read" on public.audit_logs;
create policy "audit super read" on public.audit_logs for select using(public.admin_role()='super_admin');
-- Notification recipients may mark read, not author arbitrary notifications.
drop policy "notif own" on public.notifications;
create policy "notif own read" on public.notifications for select using(user_id=auth.uid());
create policy "notif own update" on public.notifications for update using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke insert,update on public.notifications from authenticated;
grant update(is_read) on public.notifications to authenticated;
-- Prevent self-inserted sponsored profiles, self-delete bypassing restrictions,
-- and profile/social mutations by restricted accounts. Definer admin actions are trusted.
create or replace function public.guard_account_write() returns trigger language plpgsql set search_path=public as $$
begin
 if current_user in ('authenticated','anon') then
  if exists(select 1 from public.account_restrictions where user_id=auth.uid()) then raise exception 'Account restricted'; end if;
  if tg_table_name='profiles' and tg_op='INSERT' and new.is_sponsored then raise exception 'Sponsorship requires approval'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end$$;
create trigger account_profile_guard before insert or update or delete on public.profiles for each row execute function public.guard_account_write();
create trigger account_social_guard before insert or update or delete on public.social_links for each row execute function public.guard_account_write();
-- Change sponsorship guard to permit trusted RPCs, never client DML.
create or replace function public.guard_sponsored() returns trigger language plpgsql as $$begin
 if new.is_sponsored is distinct from old.is_sponsored and current_user in ('authenticated','anon') then raise exception 'Sponsorship requires approval'; end if; return new; end$$;
create or replace function public.require_active_account() returns void language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if exists(select 1 from public.account_restrictions where user_id=auth.uid()) then raise exception 'Account restricted'; end if;
end$$;
-- Dashboard reads: fixed allowlist, quoted identifiers, bounded page size, bound search.
create or replace function public.admin_list(p_resource text,p_search text default '',p_status text default '',p_page int default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare tbl text; search_col text; status_col text; order_col text; clause text; result jsonb; total bigint;
begin
 if not public.admin_can(p_resource) then raise exception 'Permission denied' using errcode='42501'; end if;
 case p_resource
 when 'profiles' then tbl:='profiles'; search_col:='username'; order_col:='created_at';
 when 'social_links' then tbl:='social_links'; search_col:='url'; status_col:='platform'; order_col:='id';
 when 'reports' then tbl:='reports'; search_col:='reason'; status_col:='status'; order_col:='created_at';
 when 'points_ledger' then tbl:='points_ledger'; search_col:='reason'; order_col:='created_at';
 when 'points_balance' then tbl:='points_balance'; search_col:='referral_code'; order_col:='user_id';
 when 'reward_tasks' then tbl:='reward_tasks'; search_col:='title'; order_col:='slug';
 when 'reward_config' then tbl:='reward_config'; search_col:='key'; order_col:='key';
 when 'payment_transactions' then tbl:='payment_transactions'; search_col:='reference'; status_col:='status'; order_col:='created_at';
 when 'subscriptions' then tbl:='subscriptions'; search_col:='plan'; status_col:='status'; order_col:='starts_at';
 when 'promotions' then tbl:='promotions'; search_col:='title'; order_col:='created_at';
 when 'referrals' then tbl:='referrals'; search_col:='referred_id'; order_col:='created_at';
 when 'notifications' then tbl:='notifications'; search_col:='title'; order_col:='created_at';
 when 'audit_logs' then tbl:='audit_logs'; search_col:='action'; order_col:='created_at';
 when 'user_roles' then tbl:='user_roles'; search_col:='user_id'; status_col:='role'; order_col:='created_at';
 when 'account_restrictions' then tbl:='account_restrictions'; search_col:='reason'; order_col:='created_at';
 else raise exception 'Unsupported resource'; end case;
 clause:=format(' where ($1 = '''' or %I::text ilike ''%%'' || $1 || ''%%'')',search_col);
 if status_col is not null then clause:=clause||format(' and ($2 = '''' or %I::text = $2)',status_col); end if;
 execute format('select count(*) from public.%I',tbl)||clause into total using left(p_search,200),p_status;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select * from public.%I',tbl)||clause||format(' order by %I desc limit 25 offset $3) r',order_col)
 into result using left(p_search,200),p_status,greatest(0,least(p_page,100000))*25;
 return jsonb_build_object('rows',result,'total',total);
end$$;
create or replace function public.admin_overview() returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; trend jsonb;
begin
 if not public.admin_can('overview') then raise exception 'Permission denied' using errcode='42501'; end if;
 select jsonb_agg(jsonb_build_object('day',d::date,'users',(select count(*) from public.profiles where created_at>=d and created_at<d+interval '1 day'))) into trend
 from generate_series(current_date-13,current_date,interval '1 day') d;
 result:=jsonb_build_object('profiles',(select count(*) from public.profiles),'social_links',(select count(*) from public.social_links),'open_reports',(select count(*) from public.reports where status='open'),'trend',trend,'refreshed_at',now());
 if public.admin_can('payment_transactions') then result:=result||jsonb_build_object('revenue_kobo',(select coalesce(sum(amount_kobo::bigint),0) from public.payment_transactions where status='verified'),'pending_payments',(select count(*) from public.payment_transactions where status='pending')); end if;
 return result;
end$$;
create or replace function public.admin_mutate(p_action text,p_target text,p_value jsonb,p_reason text,p_request uuid)
returns void language plpgsql security definer set search_path=public as $$
declare before_row jsonb; v_role text; delta int;
begin
 if length(trim(p_reason))<8 or length(p_reason)>1000 or p_request is null then raise exception 'Provide an 8–1000 character reason and request ID'; end if;
 -- serialize identical requests; an audit entry doubles as an idempotency marker
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 if exists(select 1 from public.audit_logs where meta->>'request_id'=p_request::text) then return; end if;
 case p_action
 when 'restrict','reactivate' then
  if public.admin_role() not in ('super_admin','moderator') or public.admin_role() is null then raise exception 'Permission denied'; end if;
  if exists(select 1 from public.user_roles where user_id=p_target::uuid and role<>'user') then raise exception 'Staff restrictions require a separate security review'; end if;
  if p_action='restrict' then insert into public.account_restrictions(user_id,reason,actor_id) values(p_target::uuid,p_reason,auth.uid()) on conflict(user_id) do update set reason=excluded.reason,actor_id=excluded.actor_id,created_at=now();
  else delete from public.account_restrictions where user_id=p_target::uuid; end if;
 when 'resolve_report','dismiss_report' then
  if not public.admin_can('reports') or public.admin_role()='support_agent' then raise exception 'Permission denied'; end if;
  update public.reports set status=case when p_action='resolve_report' then 'resolved' else 'dismissed' end where id=p_target::uuid returning to_jsonb(reports.*) into before_row;
  if not found then raise exception 'Report not found'; end if;
 when 'adjust_points' then
  if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
  delta:=(p_value->>'points')::int;
  if delta is null or delta=0 or abs(delta::bigint)>100000 then raise exception 'Adjustment must be nonzero and at most 100000 points'; end if;
  insert into public.points_balance(user_id,balance) values(p_target::uuid,0) on conflict do nothing;
  select to_jsonb(b.*) into before_row from public.points_balance b where user_id=p_target::uuid for update;
  update public.points_balance set balance=balance+delta where user_id=p_target::uuid;
  insert into public.points_ledger(user_id,points,reason,ref_key) values(p_target::uuid,delta,'admin: '||p_reason,'admin:'||p_request);
 when 'configure_reward' then
  if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
  delta:=(p_value->>'value')::int;
  if delta is null or delta<0 or delta>10000 or (p_target='checkin_enabled' and delta not in (0,1)) then raise exception 'Invalid reward value'; end if;
  update public.reward_config set value=delta where key=p_target;
  if not found then raise exception 'Unknown reward key'; end if;
 when 'toggle_task' then
  if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
  update public.reward_tasks set is_active=(p_value->>'enabled')::boolean where id=p_target::uuid;
  if not found then raise exception 'Task not found'; end if;
 when 'hide_social' then
  if not public.admin_can('social_links') then raise exception 'Permission denied'; end if;
  update public.social_links set is_public=false where id=p_target::uuid;
  if not found then raise exception 'Link not found'; end if;
 when 'notify' then
  if public.admin_role() not in ('super_admin','support_agent') or public.admin_role() is null then raise exception 'Permission denied'; end if;
  if length(p_value->>'title') not between 1 and 120 or length(p_value->>'body') not between 1 and 2000 then raise exception 'Invalid message'; end if;
  insert into public.notifications(user_id,title,body) values(p_target::uuid,p_value->>'title',p_value->>'body');
 when 'set_role' then
  if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
  if p_target::uuid=auth.uid() then raise exception 'Cannot change your own role'; end if;
  v_role:=p_value->>'role';
  if v_role not in ('user','super_admin','moderator','finance_admin','support_agent') or v_role is null then raise exception 'Invalid role'; end if;
  insert into public.user_roles(user_id,role) values(p_target::uuid,v_role) on conflict(user_id) do update set role=excluded.role;
 else raise exception 'Unsupported action'; end case;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),p_action,p_target,jsonb_build_object('reason',p_reason,'value',p_value,'previous',before_row,'request_id',p_request));
end$$;
-- Legacy endpoints cannot bypass the new audited paths.
create or replace function public.admin_resolve_report(p_report uuid,p_status text) returns void language plpgsql as $$begin raise exception 'Use admin_mutate with a reason'; end$$;
create or replace function public.admin_set_sponsored(p_profile uuid,p_on boolean) returns void language plpgsql as $$begin raise exception 'Sponsorship requires a verified campaign workflow'; end$$;
-- No client audit mutation privileges, even if future policies accidentally change.
revoke insert,update,delete,truncate on public.audit_logs from anon,authenticated;
create index admin_audit_request on public.audit_logs((meta->>'request_id')) where meta ? 'request_id';
create index admin_payment_status on public.payment_transactions(status,created_at desc);
create index admin_profiles_created on public.profiles(created_at desc);
revoke all on function public.admin_role(),public.admin_can(text),public.admin_list(text,text,text,int),public.admin_overview(),public.admin_mutate(text,text,jsonb,text,uuid),public.require_active_account() from public,anon;
grant execute on function public.admin_role(),public.admin_can(text),public.admin_list(text,text,text,int),public.admin_overview(),public.admin_mutate(text,text,jsonb,text,uuid),public.require_active_account() to authenticated;

commit;
select to_regprocedure('public.admin_role()') is not null as admin_role_installed,
 to_regprocedure('public.admin_overview()') is not null as admin_overview_installed,
 to_regprocedure('public.admin_list(text,text,text,integer)') is not null as admin_list_installed,
 to_regprocedure('public.admin_mutate(text,text,jsonb,text,uuid)') is not null as admin_mutate_installed;
