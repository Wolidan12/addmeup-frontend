-- Targeted forward addition for the inspected paid-feed baseline. Do NOT replay 020.
-- Review recovery/activation separately: installation creates no credits or connections.
begin;
set local lock_timeout='5s';
lock table auth.users,public.profiles,public.managed_profiles,public.points_balance,public.points_ledger,public.bank_point_orders,public.notifications,public.audit_logs,public.feed_listing_orders,public.favourites,public.blocks in share mode;
do $$begin
 if to_regclass('public.member_connections') is not null or to_regclass('public.connection_reward_events') is not null or to_regclass('public.connection_reward_settings') is not null or to_regprocedure('public.discovery_relationship(uuid,text,boolean)') is not null or to_regprocedure('public.feed_is_active(uuid)') is null or to_regclass('public.feed_listing_settings') is null then raise exception 'Connection rewards require the inspected paid-feed baseline; reconcile before proceeding';end if;
end$$;
create function pg_temp.connection_snapshot() returns jsonb language sql stable as $$
 select jsonb_build_object('users',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from auth.users t),'profiles',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.profiles t),'managed',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.managed_profiles t),'wallets',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text,'null')) from public.points_balance t),'ledger',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.points_ledger t),'deposits',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.bank_point_orders t),'notifications',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.notifications t),'audit',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.audit_logs t),'listings',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.feed_listing_orders t),'favourites',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id,profile_id)::text,'null')) from public.favourites t),'blocks',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by blocker_id,blocked_id)::text,'null')) from public.blocks t))
$$;
create temp table connection_preservation on commit drop as select pg_temp.connection_snapshot() snapshot;
create table public.connection_reward_settings(id boolean primary key default true check(id),enabled boolean not null default true);
insert into public.connection_reward_settings values(true,true);
alter table public.connection_reward_settings enable row level security;
revoke all on public.connection_reward_settings from public,anon,authenticated,service_role;
create table public.member_connections(user_id uuid not null references auth.users(id) on delete cascade,profile_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default clock_timestamp(),primary key(user_id,profile_id),check(user_id<>profile_id));
-- Financial decisions outlive disconnect/block/profile deletion. No cascading history deletion.
create table public.connection_reward_events(user_id uuid not null,profile_id uuid not null,reward_dc integer not null check(reward_dc in (0,7)),outcome text not null check(outcome in ('granted','daily_cap','paused')),rewarded_on date not null,created_at timestamptz not null,primary key(user_id,profile_id),check(user_id<>profile_id),check((outcome='granted')=(reward_dc=7)),check(rewarded_on=(created_at at time zone 'UTC')::date));
create index connection_daily_rewards on public.connection_reward_events(user_id,rewarded_on) where reward_dc=7;
alter table public.member_connections enable row level security;
alter table public.connection_reward_events enable row level security;
create policy "own connections read" on public.member_connections for select to authenticated using(user_id=auth.uid());
create policy "own connection reward read" on public.connection_reward_events for select to authenticated using(user_id=auth.uid());
revoke all on public.member_connections,public.connection_reward_events from public,anon,authenticated,service_role;
grant select on public.member_connections,public.connection_reward_events to authenticated;
revoke insert,update,delete,truncate on public.favourites,public.blocks from public,anon,authenticated,service_role;
create function public.connection_reward_history_immutable() returns trigger language plpgsql set search_path=public as $$begin raise exception 'Connection reward history is append-only';end$$;
revoke all on function public.connection_reward_history_immutable() from public,anon,authenticated,service_role;
create trigger connection_rewards_immutable before update or delete on public.connection_reward_events for each row execute function public.connection_reward_history_immutable();
create trigger connection_rewards_no_truncate before truncate on public.connection_reward_events for each statement execute function public.connection_reward_history_immutable();

create function public.discovery_relationship(p_target uuid,p_action text,p_enabled boolean) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid();v_reward integer:=0;v_outcome text:='not_applicable';v_count integer;v_now timestamptz;v_day date;v_balance integer;v_new integer;v_enabled boolean;begin
 perform public.require_active_account();
 if exists(select 1 from auth.users where id=actor and banned_until>now()) then raise exception 'Account restricted';end if;
 if p_enabled is null or p_target is null or p_target=actor or p_action is null or p_action not in ('connect','save','block') then raise exception 'Invalid relationship action';end if;
 -- The same unordered pair lock serializes reciprocal connect/block operations.
 perform pg_advisory_xact_lock(hashtextextended(least(actor::text,p_target::text)||':'||greatest(actor::text,p_target::text),27));
 if not exists(select 1 from public.profiles where id=p_target) then raise exception 'Profile unavailable';end if;
 if p_action='block' then
  if p_enabled then
   insert into public.blocks(blocker_id,blocked_id) values(actor,p_target) on conflict do nothing;
   delete from public.member_connections where (user_id=actor and profile_id=p_target) or (user_id=p_target and profile_id=actor);
   delete from public.favourites where (user_id=actor and profile_id=p_target) or (user_id=p_target and profile_id=actor);
  else delete from public.blocks where blocker_id=actor and blocked_id=p_target;end if;
 else
  if p_enabled and not public.feed_is_active(p_target) then raise exception 'Profile unavailable or blocked';end if;
  if p_action='save' then
   if p_enabled then insert into public.favourites(user_id,profile_id) values(actor,p_target) on conflict do nothing;else delete from public.favourites where user_id=actor and profile_id=p_target;end if;
  elsif not p_enabled then delete from public.member_connections where user_id=actor and profile_id=p_target;
  else
   -- Same wallet lock as deposits/listing spend: serializes ALL rewards for this user.
   insert into public.points_balance(user_id) values(actor) on conflict(user_id) do nothing;
   select balance into v_balance from public.points_balance where user_id=actor for update;
   -- Recheck after waiting; disabled/expired/blocked listings cannot earn rewards.
   if not public.feed_is_active(p_target) or not exists(select 1 from public.feed_listing_orders where user_id=p_target and starts_at<=clock_timestamp() and ends_at>clock_timestamp()) then raise exception 'Profile unavailable or blocked';end if;
   insert into public.member_connections(user_id,profile_id) values(actor,p_target) on conflict do nothing;
   get diagnostics v_new=row_count;
   v_now:=clock_timestamp();v_day:=(v_now at time zone 'UTC')::date;
   select count(*) into v_count from public.connection_reward_events where user_id=actor and rewarded_on=v_day and reward_dc=7;
   if exists(select 1 from public.connection_reward_events where user_id=actor and profile_id=p_target) or v_new=0 then v_outcome:='already_processed';
   else
    select enabled into v_enabled from public.connection_reward_settings where id;
    v_reward:=case when v_count<50 and coalesce(v_enabled,false) then 7 else 0 end;
    v_outcome:=case when not coalesce(v_enabled,false) then 'paused' when v_reward=7 then 'granted' else 'daily_cap' end;
    insert into public.connection_reward_events(user_id,profile_id,reward_dc,outcome,rewarded_on,created_at) values(actor,p_target,v_reward,v_outcome,v_day,v_now);
    if v_reward=7 then
     insert into public.points_ledger(user_id,points,reason,ref_key,created_at) values(actor,7,'Connection reward','connection-reward:'||actor::text||':'||p_target::text,v_now);
     update public.points_balance set balance=balance+7 where user_id=actor returning balance into v_balance;
     insert into public.audit_logs(actor_id,action,target,meta) values(actor,'connection_reward_granted',p_target::text,jsonb_build_object('reward_dc',7,'utc_day',v_day,'ref_key','connection-reward:'||actor::text||':'||p_target::text));
     v_count:=v_count+1;
    end if;
   end if;
  end if;
 end if;
 return jsonb_build_object('action',p_action,'enabled',p_enabled,'reward_dc',v_reward,'reward_status',v_outcome,'rewarded_today',v_count,'daily_limit',50,'balance',v_balance);
end$$;

-- Preserve the purchased-only query, filters and response contract; add owner-scoped relationship flags.
create or replace function public.public_directory(p_search text default '',p_platform text default '',p_country text default '',p_interest text default '',p_page integer default 0) returns jsonb language sql stable security definer set search_path=public as $$
 with matching as (
 select p.id,p.created_at,jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'country',p.country,'interests',p.interests,'avatar_url',p.avatar_url,'created_at',p.created_at,'location',p.location,'categories',p.categories,'creator_xp',p.creator_xp,'creator_level',p.creator_level,'is_connected',exists(select 1 from public.member_connections c where c.user_id=auth.uid() and c.profile_id=p.id),'is_saved',exists(select 1 from public.favourites f where f.user_id=auth.uid() and f.profile_id=p.id),'managed',false,'feed_listing_paid',true,'feed_ends_at',(select max(ends_at) from public.feed_listing_orders where user_id=p.id and ends_at>now()),'social_links',coalesce((select jsonb_agg(to_jsonb(l)) from public.social_links l where l.profile_id=p.id and l.is_public and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])),'[]'::jsonb)) as item
 from public.profiles p where public.feed_is_active(p.id)
 and (coalesce(p_search,'')='' or concat_ws(' ',p.username,p.display_name,p.bio,p.country,array_to_string(p.interests,' ')) ilike '%'||left(p_search,200)||'%')
 and (coalesce(p_country,'')='' or p.country ilike left(p_country,80))
 and (coalesce(p_interest,'')='' or exists(select 1 from unnest(p.interests) i where i ilike '%'||left(p_interest,80)||'%'))
 and (coalesce(p_platform,'')='' or exists(select 1 from public.social_links l where l.profile_id=p.id and l.is_public and l.platform=p_platform and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])))
 ) select jsonb_build_object('feed_policy','purchased_dc_v1','server_now',now(),'total',(select count(*) from matching),'paid_rows','[]'::jsonb,'rows',(select coalesce(jsonb_agg(item),'[]'::jsonb) from (select item from matching order by created_at desc,id desc limit 12 offset greatest(0,least(coalesce(p_page,0),100000))*12) r))
$$;

-- Preserve the purchased-only query, filters and response contract; add owner-scoped relationship flags.
create or replace function public.discovery_profile(p_username text,p_managed boolean default false) returns jsonb language sql stable security definer set search_path=public as $$
 select case when coalesce(p_managed,false) then null else (select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'country',p.country,'interests',p.interests,'avatar_url',p.avatar_url,'created_at',p.created_at,'location',p.location,'categories',p.categories,'creator_xp',p.creator_xp,'creator_level',p.creator_level,'is_connected',exists(select 1 from public.member_connections c where c.user_id=auth.uid() and c.profile_id=p.id),'is_saved',exists(select 1 from public.favourites f where f.user_id=auth.uid() and f.profile_id=p.id),'feed_listing_paid',public.feed_is_active(p.id),'social_links',coalesce((select jsonb_agg(to_jsonb(l)) from public.social_links l where l.profile_id=p.id and (l.is_public or p.id=auth.uid()) and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])),'[]'::jsonb)) from public.profiles p where p.username=p_username and (p.id=auth.uid() or public.feed_is_active(p.id))) end
$$;

create function public.discovery_connections(p_kind text default 'connected',p_page integer default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare v_rows jsonb;v_total bigint;begin
 perform public.require_active_account();
 if p_kind is null or p_kind not in ('connected','saved','blocked') or p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid connection filter';end if;
 with entries as(select profile_id,created_at from public.member_connections where user_id=auth.uid() and p_kind='connected' union all select profile_id,created_at from public.favourites where user_id=auth.uid() and p_kind='saved' union all select blocked_id,created_at from public.blocks where blocker_id=auth.uid() and p_kind='blocked'),matching as(select * from entries where p_kind='blocked' or public.feed_is_active(profile_id))
 select (select count(*) from matching),(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from(select m.profile_id,m.created_at,case when p_kind='blocked' then null else public.discovery_profile((select username from public.profiles where id=m.profile_id),false) end profile from matching m order by created_at desc,profile_id limit 12 offset p_page*12) r) into v_total,v_rows;
 return jsonb_build_object('rows',v_rows,'total',v_total);
end$$;
revoke all on function public.discovery_relationship(uuid,text,boolean),public.discovery_connections(text,integer),public.discovery_profile(text,boolean),public.public_directory(text,text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.discovery_relationship(uuid,text,boolean),public.discovery_connections(text,integer) to authenticated;
grant execute on function public.discovery_profile(text,boolean),public.public_directory(text,text,text,text,integer) to anon,authenticated;
do $$begin if (select snapshot from connection_preservation) is distinct from pg_temp.connection_snapshot() then raise exception 'Connection reward install changed original records; abort';end if;end$$;
commit;
