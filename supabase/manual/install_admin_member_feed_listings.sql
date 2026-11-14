-- Adds an audited complimentary listing grant for an existing member's real profile.
-- Separate from managed_profiles: this never creates an account or edits profile data.
-- Requires the installed paid feed, first-50 reward reconciliation, connection rewards,
-- and free admin-managed feed. This file is not a production deployment record.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

lock table auth.users,public.profiles,public.managed_profiles,public.points_balance,
 public.points_ledger,public.bank_point_orders,public.notifications,public.audit_logs,
 public.feed_listing_orders,public.feed_listing_packages,public.feed_listing_settings,
 public.connection_reward_settings,public.member_connections,public.connection_reward_events,
 public.blocks,public.favourites,public.social_links,public.site_settings in share mode;

do $$begin
 if to_regclass('public.profiles') is null
  or to_regclass('public.managed_profiles') is null
  or to_regclass('public.feed_listing_orders') is null
  or to_regclass('public.feed_listing_packages') is null
  or to_regclass('public.feed_listing_settings') is null
  or to_regclass('public.connection_reward_settings') is null
  or to_regclass('public.member_connections') is null
  or to_regclass('public.connection_reward_events') is null
  or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='connection_reward_events' and column_name='outcome')
  or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='role')
  or to_regclass('public.blocks') is null
  or to_regclass('public.favourites') is null
  or to_regclass('public.launch_awards') is null
  or to_regclass('public.launch_campaign') is null
  or not exists(select 1 from pg_constraint c where c.conrelid=to_regclass('public.connection_reward_events') and c.conname='connection_reward_events_outcome_check')
  or to_regprocedure('public.feed_purchased_dc(uuid)') is null
  or to_regprocedure('public.feed_listing_dc(uuid)') is null
  or to_regprocedure('public.feed_profile_ready(uuid)') is null
  or to_regprocedure('public.feed_is_active(uuid)') is null
  or to_regprocedure('public.my_feed_listing(integer)') is null
  or to_regprocedure('public.buy_feed_listing(text,uuid,integer,integer)') is null
  or to_regprocedure('public.managed_feed_item(uuid)') is null
  or to_regprocedure('public.discovery_relationship(uuid,text,boolean)') is null
  or to_regprocedure('public.admin_role()') is null
  or to_regprocedure('public.require_active_account()') is null then
  raise exception 'Admin member listings require the inspected paid-feed, launch-reward, managed-feed and connection baseline';
 end if;
 if to_regclass('public.admin_member_feed_grants') is not null
  or to_regprocedure('public.admin_member_feed_status(uuid)') is not null
  or to_regprocedure('public.admin_grant_member_feed(uuid,text,integer,text,boolean,uuid)') is not null
  or to_regprocedure('public.admin_revoke_member_feed(uuid,text,boolean,uuid)') is not null then
  raise exception 'Admin member listings are already installed; reconcile before replaying';
 end if;
end$$;

create function pg_temp.admin_member_feed_snapshot() returns jsonb language sql stable as $$
 select jsonb_build_object(
  'users',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from auth.users t),
  'profiles',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.profiles t),
  'managed',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.managed_profiles t),
  'wallets',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text,'null')) from public.points_balance t),
  'ledger',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.points_ledger t),
  'deposits',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.bank_point_orders t),
  'notifications',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.notifications t),
  'audit',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.audit_logs t),
  'orders',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.feed_listing_orders t),
  'packages',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by key)::text,'null')) from public.feed_listing_packages t),
  'listing_settings',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.feed_listing_settings t),
  'connection_settings',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.connection_reward_settings t),
  'connections',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id,profile_id)::text,'null')) from public.member_connections t),
  'connection_events',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id,profile_id)::text,'null')) from public.connection_reward_events t),
  'blocks',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by blocker_id,blocked_id)::text,'null')) from public.blocks t),
  'favourites',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id,profile_id)::text,'null')) from public.favourites t),
  'social_links',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.social_links t),
  'launch_awards',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.launch_awards t),
  'launch_campaign',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.launch_campaign t)
 )
$$;
create temp table admin_member_feed_preservation on commit drop as
 select pg_temp.admin_member_feed_snapshot() as snapshot;

alter table public.connection_reward_events
 drop constraint connection_reward_events_outcome_check,
 add constraint connection_reward_events_outcome_check
  check(outcome in ('granted','daily_cap','paused','not_eligible'));

create table public.admin_member_feed_grants(
 id uuid primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 package_key text not null references public.feed_listing_packages(key),
 duration_hours integer not null check(duration_hours between 7 and 720),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 created_by uuid not null,
 member_authorized boolean not null check(member_authorized),
 reason text not null check(length(trim(reason)) between 8 and 1000),
 created_at timestamptz not null default clock_timestamp(),
 revoked_at timestamptz,
 revoked_by uuid,
 revoke_reason text,
 check(ends_at=starts_at+duration_hours*interval '1 hour'),
 check((revoked_at is null and revoked_by is null and revoke_reason is null)
    or (revoked_at is not null and revoked_by is not null and length(trim(revoke_reason)) between 8 and 1000))
);
create index admin_member_feed_schedule
 on public.admin_member_feed_grants(user_id,starts_at,ends_at)
 where revoked_at is null;
alter table public.admin_member_feed_grants enable row level security;
revoke all on public.admin_member_feed_grants from public,anon,authenticated,service_role;

-- Grant history is append-only except for one audited, one-way revocation.
create function public.guard_admin_member_feed_grant() returns trigger
language plpgsql set search_path=public as $$begin
 if tg_op='DELETE' then raise exception 'Admin member feed history is append-only';end if;
 if new.id is distinct from old.id
  or new.user_id is distinct from old.user_id
  or new.package_key is distinct from old.package_key
  or new.duration_hours is distinct from old.duration_hours
  or new.starts_at is distinct from old.starts_at
  or new.ends_at is distinct from old.ends_at
  or new.created_by is distinct from old.created_by
  or new.member_authorized is distinct from old.member_authorized
  or new.reason is distinct from old.reason
  or new.created_at is distinct from old.created_at
  or old.revoked_at is not null
  or new.revoked_at is null
  or new.revoked_by is null
  or new.revoke_reason is null then
  raise exception 'Admin member feed history is immutable';
 end if;
 return new;
end$$;
create trigger admin_member_feed_grant_guard
 before update or delete on public.admin_member_feed_grants
 for each row execute function public.guard_admin_member_feed_grant();
revoke all on function public.guard_admin_member_feed_grant() from public,anon,authenticated,service_role;

-- Sponsored member time satisfies the same public-profile, restriction, link, and
-- reciprocal-block rules as purchased listing time. Managed profiles are separate.
create or replace function public.feed_is_active(p_user uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.feed_profile_ready(p_user)
  and (
   exists(select 1 from public.feed_listing_orders o
          where o.user_id=p_user and o.starts_at<=now() and o.ends_at>now())
   or exists(select 1 from public.admin_member_feed_grants g
             where g.user_id=p_user and g.revoked_at is null
               and g.starts_at<=now() and g.ends_at>now())
  )
  and not exists(select 1 from public.blocks b
   where (b.blocker_id=auth.uid() and b.blocked_id=p_user)
      or (b.blocker_id=p_user and b.blocked_id=auth.uid()))
$$;

-- Older migration-based discovery and RLS paths use this helper. Bring them into
-- parity with the paid-feed policy without opening unpublished or restricted profiles.
create or replace function public.discovery_visible(p_user uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.feed_is_active(p_user)
$$;

create or replace function public.my_feed_listing(p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 return jsonb_build_object(
  'enabled',coalesce((select enabled from public.feed_listing_settings where id),false),
  'server_now',now(),
  'purchased_dc',public.feed_purchased_dc(auth.uid()),
  'funding_policy','purchased_or_launch_reward_v1',
  'listing_dc',public.feed_listing_dc(auth.uid()),
  'launch_reward_dc',greatest(0,public.feed_listing_dc(auth.uid())-public.feed_purchased_dc(auth.uid())),
  'total_dc',coalesce((select balance from public.points_balance where user_id=auth.uid()),0),
  'profile_ready',public.feed_profile_ready(auth.uid()),
  'active_until',(select max(s.ends_at) from (
    select o.ends_at from public.feed_listing_orders o where o.user_id=auth.uid() and o.ends_at>now()
    union all
    select g.ends_at from public.admin_member_feed_grants g where g.user_id=auth.uid() and g.revoked_at is null and g.ends_at>now()
  ) s),
  'in_feed',public.feed_is_active(auth.uid()),
  'packages',(select coalesce(jsonb_agg(to_jsonb(p) order by p.duration_hours),'[]'::jsonb)
    from public.feed_listing_packages p where p.enabled),
  'total',(select count(*) from (
    select o.id from public.feed_listing_orders o where o.user_id=auth.uid()
    union all
    select g.id from public.admin_member_feed_grants g where g.user_id=auth.uid()
  ) history),
  'rows',(select coalesce(jsonb_agg(
    to_jsonb(h)||jsonb_build_object('status',case
     when h.revoked_at is not null then 'revoked'
     when h.ends_at<=now() then 'expired'
     when h.starts_at>now() then 'queued'
     else 'active' end)
    order by h.created_at desc,h.id desc),'[]'::jsonb)
   from (
    select hist.* from (
     select o.id,o.user_id,o.package_key,o.cost_dc,o.duration_hours,o.starts_at,o.ends_at,
      o.created_at,'member_purchase'::text as source,null::timestamptz as revoked_at
     from public.feed_listing_orders o where o.user_id=auth.uid()
     union all
     select g.id,g.user_id,g.package_key,0::integer as cost_dc,g.duration_hours,g.starts_at,g.ends_at,
      g.created_at,'admin_feature'::text as source,g.revoked_at
     from public.admin_member_feed_grants g where g.user_id=auth.uid()
    ) hist order by hist.created_at desc,hist.id desc
    limit 10 offset greatest(0,least(coalesce(p_page,0),100000))*10
   ) h)
 );
end$$;

-- Keep the existing purchased/first-50 funding checks and exact package catalogue.
-- Only the start timestamp now follows any unrevoked admin-sponsored member time.
create or replace function public.buy_feed_listing(
 p_package text,p_request uuid,p_expected_cost integer,p_expected_hours integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 old public.feed_listing_orders;
 pkg public.feed_listing_packages;
 wallet integer;
 purchased bigint;
 available bigint;
 start_time timestamptz;
begin
 perform public.require_active_account();
 if p_request is null then raise exception 'Listing request ID required';end if;
 -- Shared profile lock serializes member purchases with admin grant/revoke operations.
 perform 1 from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Member profile unavailable';end if;
 -- Wallet row lock serializes different requests and keeps reward/deposit accounting atomic.
 select balance into wallet from public.points_balance where user_id=auth.uid() for update;
 if not found then raise exception 'Not enough listing DC';end if;
 select * into old from public.feed_listing_orders where id=p_request;
 if found then
  if old.user_id is distinct from auth.uid() or old.package_key is distinct from p_package
    or old.cost_dc is distinct from p_expected_cost or old.duration_hours is distinct from p_expected_hours then
   raise exception 'Listing request unavailable';
  end if;
  return to_jsonb(old);
 end if;
 if exists(select 1 from public.admin_member_feed_grants g where g.id=p_request) then
  raise exception 'Listing request unavailable';
 end if;
 if not coalesce((select enabled from public.feed_listing_settings where id),false) then
  raise exception 'Feed listing purchases are paused';
 end if;
 select * into pkg from public.feed_listing_packages
  where key=p_package and enabled for share;
 if not found or pkg.cost_dc is distinct from p_expected_cost
   or pkg.duration_hours is distinct from p_expected_hours then
  raise exception 'Listing package changed; refresh before purchasing';
 end if;
 if not public.feed_profile_ready(auth.uid()) then
  raise exception 'Listing needs a public profile, display name and a public social link';
 end if;
 purchased:=public.feed_purchased_dc(auth.uid());
 available:=public.feed_listing_dc(auth.uid());
 if available<pkg.cost_dc or wallet<pkg.cost_dc then raise exception 'Not enough listing DC';end if;
 select greatest(clock_timestamp(),coalesce(max(ends_at),clock_timestamp())) into start_time
 from (
  select o.ends_at from public.feed_listing_orders o where o.user_id=auth.uid()
  union all
  select g.ends_at from public.admin_member_feed_grants g
   where g.user_id=auth.uid() and g.revoked_at is null
 ) scheduled;
 insert into public.feed_listing_orders(id,user_id,package_key,cost_dc,duration_hours,starts_at,ends_at)
 values(p_request,auth.uid(),pkg.key,pkg.cost_dc,pkg.duration_hours,start_time,
  start_time+pkg.duration_hours*interval '1 hour') returning * into old;
 update public.points_balance set balance=balance-pkg.cost_dc where user_id=auth.uid();
 insert into public.points_ledger(user_id,points,reason,ref_key,created_at)
 values(auth.uid(),-pkg.cost_dc,'Feed listing '||pkg.label,'feed-listing:'||p_request,clock_timestamp());
 insert into public.audit_logs(actor_id,action,target,meta)
 values(auth.uid(),'feed_listing_purchased',p_request::text,jsonb_build_object(
  'cost_dc',pkg.cost_dc,'purchased_before',purchased,'listing_dc_before',available,
  'funding_policy','purchased_or_launch_reward_v1','wallet_before',wallet,
  'wallet_after',wallet-pkg.cost_dc,'starts_at',old.starts_at,'ends_at',old.ends_at,
  'package',pkg.key));
 insert into public.notifications(user_id,title,body)
 values(auth.uid(),'Feed listing purchased',pkg.label||': '||pkg.cost_dc||
  ' DC (purchased or launch reward). Starts '||old.starts_at||'; ends '||old.ends_at||
  '. No automatic renewal.');
 return to_jsonb(old);
end$$;

create function public.admin_member_feed_status(p_user uuid) returns jsonb
language plpgsql volatile security definer set search_path=public as $$
declare
 is_member boolean;
 ready boolean;
 listing_enabled boolean;
begin
 perform public.require_active_account();
 if public.admin_role() is distinct from 'super_admin' then
  raise exception 'Permission denied' using errcode='42501';
 end if;
 if p_user is null or p_user=auth.uid() then raise exception 'Choose another member account';end if;
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=p_user) then
  raise exception 'Member profile unavailable';
 end if;
 select coalesce((select r.role from public.user_roles r where r.user_id=p_user),'user')='user'
  into is_member;
 ready:=public.feed_profile_ready(p_user);
 listing_enabled:=coalesce((select s.enabled from public.feed_listing_settings s where s.id),false);
 return jsonb_build_object(
  'user_id',p_user,
  'member_account',is_member,
  'profile_ready',ready,
  'enabled',listing_enabled,
  'eligible',is_member and ready and listing_enabled,
  'server_now',now(),
  'listed_now',ready and (
   exists(select 1 from public.feed_listing_orders o where o.user_id=p_user
    and o.starts_at<=now() and o.ends_at>now())
   or exists(select 1 from public.admin_member_feed_grants g where g.user_id=p_user
    and g.revoked_at is null and g.starts_at<=now() and g.ends_at>now())
  ),
  'paid_until',(select max(o.ends_at) from public.feed_listing_orders o
    where o.user_id=p_user and o.ends_at>now()),
  'admin_until',(select max(g.ends_at) from public.admin_member_feed_grants g
    where g.user_id=p_user and g.revoked_at is null and g.ends_at>now()),
  'active_until',(select max(s.ends_at) from (
    select o.ends_at from public.feed_listing_orders o where o.user_id=p_user and o.ends_at>now()
    union all
    select g.ends_at from public.admin_member_feed_grants g where g.user_id=p_user
     and g.revoked_at is null and g.ends_at>now()
  ) s),
  'packages',(select coalesce(jsonb_agg(jsonb_build_object(
    'key',p.key,'label',p.label,'duration_hours',p.duration_hours)
    order by p.duration_hours),'[]'::jsonb)
   from public.feed_listing_packages p where p.enabled)
 );
end$$;

create function public.admin_grant_member_feed(
 p_user uuid,p_package text,p_expected_hours integer,p_reason text,
 p_member_authorized boolean,p_request uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 pkg public.feed_listing_packages;
 prior public.audit_logs;
 fingerprint text;
 start_time timestamptz;
 created public.admin_member_feed_grants;
 result jsonb;
begin
 perform public.require_active_account();
 if public.admin_role() is distinct from 'super_admin' then
  raise exception 'Permission denied' using errcode='42501';
 end if;
 if p_user is null or p_user=auth.uid() or p_request is null then
  raise exception 'Member and request reference required';
 end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 then
  raise exception 'Provide an 8–1000 character reason';
 end if;
 if p_member_authorized is distinct from true then
  raise exception 'Confirm the member authorized a feature of their public profile';
 end if;
 fingerprint:=md5(jsonb_build_array(p_user,p_package,p_expected_hours,trim(p_reason),p_member_authorized)::text);
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select a.* into prior from public.audit_logs a where a.meta->>'request_id'=p_request::text limit 1;
 if found then
  if prior.actor_id=auth.uid() and prior.action='admin_member_feed_granted'
   and prior.target=p_user::text and prior.meta->>'payload_hash'=fingerprint then
   return prior.meta->'result';
  end if;
  raise exception 'Request reference unavailable';
 end if;
 if exists(select 1 from public.feed_listing_orders o where o.id=p_request) then
  raise exception 'Request reference unavailable';
 end if;
 perform 1 from public.profiles p where p.id=p_user for update;
 if not found then raise exception 'Member profile unavailable';end if;
 if coalesce((select r.role from public.user_roles r where r.user_id=p_user),'user')<>'user' then
  raise exception 'Only member accounts can receive an admin feed feature';
 end if;
 if not coalesce((select s.enabled from public.feed_listing_settings s where s.id),false) then
  raise exception 'New feed listings are paused';
 end if;
 select * into pkg from public.feed_listing_packages p where p.key=p_package and p.enabled for share;
 if not found or pkg.duration_hours is distinct from p_expected_hours then
  raise exception 'Choose the same available listing duration shown in the confirmation';
 end if;
 if not public.feed_profile_ready(p_user) then
  raise exception 'Member profile must be public, unrestricted, and have a supported public social link';
 end if;
 select greatest(clock_timestamp(),coalesce(max(ends_at),clock_timestamp())) into start_time
 from (
  select o.ends_at from public.feed_listing_orders o where o.user_id=p_user
  union all
  select g.ends_at from public.admin_member_feed_grants g
   where g.user_id=p_user and g.revoked_at is null
 ) scheduled;
 insert into public.admin_member_feed_grants(
  id,user_id,package_key,duration_hours,starts_at,ends_at,created_by,
  member_authorized,reason)
 values(p_request,p_user,pkg.key,pkg.duration_hours,start_time,
  start_time+pkg.duration_hours*interval '1 hour',auth.uid(),true,trim(p_reason))
 returning * into created;
 result:=jsonb_build_object(
  'id',created.id,'user_id',created.user_id,'package_key',created.package_key,
  'duration_hours',created.duration_hours,'cost_dc',0,'starts_at',created.starts_at,
  'ends_at',created.ends_at,'created_at',created.created_at,'source','admin_feature');
 insert into public.audit_logs(actor_id,action,target,meta)
 values(auth.uid(),'admin_member_feed_granted',p_user::text,jsonb_build_object(
  'request_id',p_request,'payload_hash',fingerprint,'reason',trim(p_reason),
  'member_authorized',true,'free',true,'listing_type','registered_member_profile',
  'package',pkg.key,'duration_hours',pkg.duration_hours,
  'starts_at',created.starts_at,'ends_at',created.ends_at,'result',result));
 insert into public.notifications(user_id,title,body)
 values(p_user,'Complimentary profile listing scheduled',
  'With your authorization, complimentary feed time has been scheduled for your public member profile. Your saved username, profile details and public social links are used. If you did not authorize this, contact support.');
 return result;
end$$;

create function public.admin_revoke_member_feed(
 p_user uuid,p_reason text,p_confirm boolean,p_request uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 prior public.audit_logs;
 fingerprint text;
 revoked_ids jsonb;
 revoked_count integer;
 result jsonb;
begin
 perform public.require_active_account();
 if public.admin_role() is distinct from 'super_admin' then
  raise exception 'Permission denied' using errcode='42501';
 end if;
 if p_user is null or p_user=auth.uid() or p_request is null then
  raise exception 'Member and request reference required';
 end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 then
  raise exception 'Provide an 8–1000 character reason';
 end if;
 if p_confirm is distinct from true then
  raise exception 'Confirm removal of admin-sponsored time only';
 end if;
 fingerprint:=md5(jsonb_build_array(p_user,trim(p_reason),p_confirm)::text);
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select a.* into prior from public.audit_logs a where a.meta->>'request_id'=p_request::text limit 1;
 if found then
  if prior.actor_id=auth.uid() and prior.action='admin_member_feed_revoked'
   and prior.target=p_user::text and prior.meta->>'payload_hash'=fingerprint then
   return prior.meta->'result';
  end if;
  raise exception 'Request reference unavailable';
 end if;
 if exists(select 1 from public.feed_listing_orders o where o.id=p_request) then
  raise exception 'Request reference unavailable';
 end if;
 perform 1 from public.profiles p where p.id=p_user for update;
 if not found then raise exception 'Member profile unavailable';end if;
 with revoked as (
  update public.admin_member_feed_grants g
   set revoked_at=clock_timestamp(),revoked_by=auth.uid(),revoke_reason=trim(p_reason)
   where g.user_id=p_user and g.revoked_at is null and g.ends_at>clock_timestamp()
   returning g.id
 ) select count(*)::integer,coalesce(jsonb_agg(id),'[]'::jsonb)
   into revoked_count,revoked_ids from revoked;
 result:=jsonb_build_object(
  'user_id',p_user,'revoked_count',revoked_count,
  'listed_now',public.feed_profile_ready(p_user) and (
   exists(select 1 from public.feed_listing_orders o where o.user_id=p_user
    and o.starts_at<=now() and o.ends_at>now())
   or exists(select 1 from public.admin_member_feed_grants g where g.user_id=p_user
    and g.revoked_at is null and g.starts_at<=now() and g.ends_at>now())
  ));
 insert into public.audit_logs(actor_id,action,target,meta)
 values(auth.uid(),'admin_member_feed_revoked',p_user::text,jsonb_build_object(
  'request_id',p_request,'payload_hash',fingerprint,'reason',trim(p_reason),
  'revoked_grant_ids',revoked_ids,'result',result));
 if revoked_count>0 then
  insert into public.notifications(user_id,title,body)
  values(p_user,'Admin-sponsored listing time ended',
   'Complimentary admin-sponsored time on your profile was ended. Purchased listing time and wallet balances are unchanged. Contact support if you did not expect this change.');
 end if;
 return result;
end$$;

-- Preserve the existing discovery response contract and managed-profile branch.
-- Member feed ends include both paid orders and admin-sponsored time; the paid badge
-- remains true only for an active member order, never for a complimentary admin grant.
create or replace function public.public_directory(
 p_search text default '',p_platform text default '',p_country text default '',
 p_interest text default '',p_page integer default 0
) returns jsonb language sql stable security definer set search_path=public as $$
 with matching as (
  select p.id,p.created_at,false as managed,
   jsonb_build_object(
    'id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,
    'country',p.country,'interests',p.interests,'avatar_url',p.avatar_url,
    'created_at',p.created_at,'location',p.location,'categories',p.categories,
    'creator_xp',p.creator_xp,'creator_level',p.creator_level,
    'is_connected',exists(select 1 from public.member_connections c
      where c.user_id=auth.uid() and c.profile_id=p.id),
    'is_saved',exists(select 1 from public.favourites f
      where f.user_id=auth.uid() and f.profile_id=p.id),
    'managed',false,
    'feed_listing_paid',exists(select 1 from public.feed_listing_orders o
      where o.user_id=p.id and o.starts_at<=now() and o.ends_at>now()),
    'feed_ends_at',(select max(s.ends_at) from (
      select o.ends_at from public.feed_listing_orders o
       where o.user_id=p.id and o.ends_at>now()
      union all
      select g.ends_at from public.admin_member_feed_grants g
       where g.user_id=p.id and g.revoked_at is null and g.ends_at>now()
    ) s),
    'social_links',coalesce((select jsonb_agg(to_jsonb(l))
      from public.social_links l where l.profile_id=p.id and l.is_public
       and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])),'[]'::jsonb)
   ) as item
  from public.profiles p where public.feed_is_active(p.id)
   and (coalesce(p_search,'')='' or
    (left(p_search,1)='@' and p.username=lower(substring(left(p_search,200),2))) or
    (left(p_search,1)<>'@' and concat_ws(' ',p.username,p.display_name,p.bio,p.country,
      array_to_string(p.interests,' ')) ilike '%'||left(p_search,200)||'%'))
   and (coalesce(p_country,'')='' or p.country ilike left(p_country,80))
   and (coalesce(p_interest,'')='' or exists(
     select 1 from unnest(p.interests) i where i ilike '%'||left(p_interest,80)||'%'))
   and (coalesce(p_platform,'')='' or exists(
     select 1 from public.social_links l where l.profile_id=p.id and l.is_public
      and l.platform=p_platform
      and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])))
  union all
  select m.id,m.created_at,true as managed,public.managed_feed_item(m.id) as item
  from public.managed_profiles m where public.managed_feed_item(m.id) is not null
   and (coalesce(p_search,'')='' or
    (left(p_search,1)='@' and m.username=lower(substring(left(p_search,200),2))) or
    (left(p_search,1)<>'@' and concat_ws(' ',m.username,m.display_name,m.bio,m.country,
      array_to_string(m.interests,' ')) ilike '%'||left(p_search,200)||'%'))
   and (coalesce(p_country,'')='' or m.country ilike left(p_country,80))
   and (coalesce(p_interest,'')='' or exists(
     select 1 from unnest(m.interests) i where i ilike '%'||left(p_interest,80)||'%'))
   and (coalesce(p_platform,'')='' or exists(
     select 1 from jsonb_array_elements(public.managed_feed_item(m.id)->'social_links') l
      where l->>'platform'=p_platform))
 )
 select jsonb_build_object(
  'feed_policy','purchased_or_admin_member_feature_v1',
  'server_now',now(),
  'total',(select count(*) from matching),
  'paid_rows','[]'::jsonb,
  'rows',(select coalesce(jsonb_agg(item),'[]'::jsonb) from (
    select item from matching order by created_at desc,id desc,managed desc
    limit 12 offset greatest(0,least(coalesce(p_page,0),100000))*12
  ) r)
 )
$$;

create or replace function public.discovery_profile(p_username text,p_managed boolean default false)
returns jsonb language sql stable security definer set search_path=public as $$
 select case when coalesce(p_managed,false) then
  (select public.managed_feed_item(m.id) from public.managed_profiles m
   where m.username=p_username)
 else (
  select jsonb_build_object(
   'id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,
   'country',p.country,'interests',p.interests,'avatar_url',p.avatar_url,
   'created_at',p.created_at,'location',p.location,'categories',p.categories,
   'creator_xp',p.creator_xp,'creator_level',p.creator_level,
   'managed',false,
   'is_connected',exists(select 1 from public.member_connections c
     where c.user_id=auth.uid() and c.profile_id=p.id),
   'is_saved',exists(select 1 from public.favourites f
     where f.user_id=auth.uid() and f.profile_id=p.id),
   'feed_listing_paid',exists(select 1 from public.feed_listing_orders o
     where o.user_id=p.id and o.starts_at<=now() and o.ends_at>now()),
   'feed_ends_at',(select max(s.ends_at) from (
     select o.ends_at from public.feed_listing_orders o
      where o.user_id=p.id and o.ends_at>now()
     union all
     select g.ends_at from public.admin_member_feed_grants g
      where g.user_id=p.id and g.revoked_at is null and g.ends_at>now()
   ) s),
   'social_links',coalesce((select jsonb_agg(to_jsonb(l)) from public.social_links l
     where l.profile_id=p.id and (l.is_public or p.id=auth.uid())
      and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])),'[]'::jsonb)
  ) from public.profiles p
  where p.username=p_username and (p.id=auth.uid() or public.feed_is_active(p.id))
 ) end
$$;

-- Sponsored profiles may be connected to for free, but keep the existing reward
-- eligibility: only a target with an active paid order can trigger 7 DC. Record a
-- zero-value not_eligible event so an ineligible connection can never earn on reconnect.
create or replace function public.discovery_relationship(
 p_target uuid,p_action text,p_enabled boolean
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 actor uuid:=auth.uid();
 v_reward integer:=0;
 v_outcome text:='not_applicable';
 v_count integer;
 v_now timestamptz;
 v_day date;
 v_balance integer;
 v_new integer;
 v_enabled boolean;
 v_paid_target boolean;
begin
 perform public.require_active_account();
 if exists(select 1 from auth.users where id=actor and banned_until>now()) then
  raise exception 'Account restricted';
 end if;
 if p_enabled is null or p_target is null or p_target=actor or p_action is null
   or p_action not in ('connect','save','block') then
  raise exception 'Invalid relationship action';
 end if;
 -- The same unordered pair lock serializes reciprocal connect/block operations.
 perform pg_advisory_xact_lock(hashtextextended(
  least(actor::text,p_target::text)||':'||greatest(actor::text,p_target::text),27));
 if not exists(select 1 from public.profiles where id=p_target) then
  raise exception 'Profile unavailable';
 end if;
 if p_action='block' then
  if p_enabled then
   insert into public.blocks(blocker_id,blocked_id) values(actor,p_target) on conflict do nothing;
   delete from public.member_connections where (user_id=actor and profile_id=p_target)
     or (user_id=p_target and profile_id=actor);
   delete from public.favourites where (user_id=actor and profile_id=p_target)
     or (user_id=p_target and profile_id=actor);
  else
   delete from public.blocks where blocker_id=actor and blocked_id=p_target;
  end if;
 else
  if p_enabled and not public.feed_is_active(p_target) then
   raise exception 'Profile unavailable or blocked';
  end if;
  if p_action='save' then
   if p_enabled then
    insert into public.favourites(user_id,profile_id) values(actor,p_target) on conflict do nothing;
   else
    delete from public.favourites where user_id=actor and profile_id=p_target;
   end if;
  elsif not p_enabled then
   delete from public.member_connections where user_id=actor and profile_id=p_target;
  else
   -- Preserve the same owner-wallet lock and UTC daily-cap accounting.
   insert into public.points_balance(user_id) values(actor) on conflict(user_id) do nothing;
   select balance into v_balance from public.points_balance where user_id=actor for update;
   if not public.feed_is_active(p_target) then
    raise exception 'Profile unavailable or blocked';
   end if;
   insert into public.member_connections(user_id,profile_id) values(actor,p_target) on conflict do nothing;
   get diagnostics v_new=row_count;
   v_now:=clock_timestamp();
   v_day:=(v_now at time zone 'UTC')::date;
   select count(*) into v_count from public.connection_reward_events
    where user_id=actor and rewarded_on=v_day and reward_dc=7;
   if exists(select 1 from public.connection_reward_events
      where user_id=actor and profile_id=p_target) or v_new=0 then
    v_outcome:='already_processed';
   else
    select exists(select 1 from public.feed_listing_orders o
      where o.user_id=p_target and o.starts_at<=v_now and o.ends_at>v_now)
      into v_paid_target;
    if not v_paid_target then
     v_outcome:='not_eligible';
     insert into public.connection_reward_events(
      user_id,profile_id,reward_dc,outcome,rewarded_on,created_at)
     values(actor,p_target,0,v_outcome,v_day,v_now);
    else
     select enabled into v_enabled from public.connection_reward_settings where id;
     v_reward:=case when v_count<50 and coalesce(v_enabled,false) then 7 else 0 end;
     v_outcome:=case when not coalesce(v_enabled,false) then 'paused'
      when v_reward=7 then 'granted' else 'daily_cap' end;
     insert into public.connection_reward_events(
      user_id,profile_id,reward_dc,outcome,rewarded_on,created_at)
     values(actor,p_target,v_reward,v_outcome,v_day,v_now);
     if v_reward=7 then
      insert into public.points_ledger(user_id,points,reason,ref_key,created_at)
      values(actor,7,'Connection reward',
       'connection-reward:'||actor::text||':'||p_target::text,v_now);
      update public.points_balance set balance=balance+7 where user_id=actor
       returning balance into v_balance;
      insert into public.audit_logs(actor_id,action,target,meta)
      values(actor,'connection_reward_granted',p_target::text,
       jsonb_build_object('reward_dc',7,'utc_day',v_day,
        'ref_key','connection-reward:'||actor::text||':'||p_target::text));
      v_count:=v_count+1;
     end if;
    end if;
   end if;
  end if;
 end if;
 return jsonb_build_object('action',p_action,'enabled',p_enabled,
  'reward_dc',v_reward,'reward_status',v_outcome,'rewarded_today',v_count,
  'daily_limit',50,'balance',v_balance);
end$$;

revoke all on function public.admin_member_feed_status(uuid),
 public.admin_grant_member_feed(uuid,text,integer,text,boolean,uuid),
 public.admin_revoke_member_feed(uuid,text,boolean,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.admin_member_feed_status(uuid),
 public.admin_grant_member_feed(uuid,text,integer,text,boolean,uuid),
 public.admin_revoke_member_feed(uuid,text,boolean,uuid) to authenticated;
revoke all on function public.guard_admin_member_feed_grant(),
 public.feed_is_active(uuid),public.discovery_visible(uuid),
 public.my_feed_listing(integer),public.buy_feed_listing(text,uuid,integer,integer),
 public.discovery_relationship(uuid,text,boolean),
 public.public_directory(text,text,text,text,integer),
 public.discovery_profile(text,boolean)
 from public,anon,authenticated,service_role;
grant execute on function public.feed_is_active(uuid),public.discovery_visible(uuid),
 public.public_directory(text,text,text,text,integer),public.discovery_profile(text,boolean)
 to anon,authenticated;
grant execute on function public.my_feed_listing(integer),
 public.buy_feed_listing(text,uuid,integer,integer),
 public.discovery_relationship(uuid,text,boolean) to authenticated;

do $$begin
 if (select snapshot from admin_member_feed_preservation)
   is distinct from pg_temp.admin_member_feed_snapshot() then
  raise exception 'Admin member feed install changed existing rows; abort';
 end if;
end$$;
notify pgrst,'reload schema';
commit;
