-- Owner explicitly selected admin_free_exception. Member purchased-DC rules stay intact.
-- Targeted forward reconciliation, not a replay of 016–023. Creates no users or credits.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table auth.users,public.profiles,public.managed_profiles,public.points_balance,public.points_ledger,public.bank_point_orders,public.audit_logs,public.notifications,public.feed_listing_orders,public.feed_listing_packages,public.feed_listing_settings,public.connection_reward_settings,public.member_connections,public.connection_reward_events,public.blocks,public.favourites in share mode;
do $$begin
 if to_regprocedure('public.feed_is_active(uuid)') is null or to_regclass('public.member_connections') is null or to_regprocedure('public.validate_managed_profile(jsonb)') is null or to_regprocedure('public.managed_feed_item(uuid)') is not null then raise exception 'Free admin listings require the inspected paid-feed/connection baseline; reconcile before proceeding';end if;
end$$;
create function pg_temp.managed_feed_snapshot() returns jsonb language sql stable as $$
 select jsonb_build_object('users',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from auth.users t),'profiles',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.profiles t),'managed',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.managed_profiles t),'wallets',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text,'null')) from public.points_balance t),'ledger',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.points_ledger t),'deposits',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.bank_point_orders t),'audit',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.audit_logs t),'notifications',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.notifications t),'orders',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.feed_listing_orders t),'feed_listing_packages',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by key)::text,'null')) from public.feed_listing_packages t),'feed_listing_settings',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.feed_listing_settings t),'connection_reward_settings',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.connection_reward_settings t),'member_connections',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id,profile_id)::text,'null')) from public.member_connections t),'connection_reward_events',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id,profile_id)::text,'null')) from public.connection_reward_events t),'blocks',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by blocker_id,blocked_id)::text,'null')) from public.blocks t),'favourites',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id,profile_id)::text,'null')) from public.favourites t))
$$;
create temp table managed_feed_preservation on commit drop as select pg_temp.managed_feed_snapshot() snapshot;

create or replace function public.admin_save_managed_profile(p_id uuid,p_data jsonb,p_reason text) returns uuid language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();
 if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied' using errcode='42501';end if;
 if p_id is null or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'ID and reason required';end if;
 perform public.validate_managed_profile(p_data);
 if exists(select 1 from public.profiles where username=p_data->>'username') then raise exception 'Username is already used';end if;
 insert into public.managed_profiles(id,username,display_name,bio,country,interests,avatar_url,social_links,is_public,created_by)
 values(p_id,p_data->>'username',trim(p_data->>'display_name'),p_data->>'bio',p_data->>'country',array(select jsonb_array_elements_text(p_data->'interests')),nullif(p_data->>'avatar_url',''),p_data->'social_links',(p_data->>'is_public')::boolean,auth.uid())
 on conflict(id) do update set username=excluded.username,display_name=excluded.display_name,bio=excluded.bio,country=excluded.country,interests=excluded.interests,avatar_url=excluded.avatar_url,social_links=excluded.social_links,is_public=excluded.is_public;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'managed_profile_saved',p_id::text,jsonb_build_object('reason',trim(p_reason),'is_public',(p_data->>'is_public')::boolean,'listing_policy','free_admin_managed'));
 return p_id;
end$$;

-- Public projection only. Do NOT reopen raw managed_profiles REST reads: those contain
-- private social links and creator/audit metadata. Only explicitly public links are returned.
create function public.managed_feed_item(p_id uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',m.id,'username',m.username,'display_name',m.display_name,'bio',m.bio,'country',m.country,'interests',m.interests,'avatar_url',m.avatar_url,'created_at',m.created_at,'managed',true,'listing_source','admin_managed','feed_listing_paid',false,'social_links',coalesce((select jsonb_agg(l) from jsonb_array_elements(m.social_links) l where l->'is_public'='true'::jsonb and l->>'platform'=any((select enabled_platforms from public.site_settings where id)::text[]) and length(l->>'url')<=500 and l->>'url' ~ '^https://[^/@:#?]+/[^[:space:]<>]+$' and l->>'url' !~ '[[:space:]<>\\]' and exists(select 1 from public.social_platforms c,unnest(c.hosts) h where c.key=l->>'platform' and (lower(split_part(split_part(l->>'url','://',2),'/',1))=h or lower(split_part(split_part(l->>'url','://',2),'/',1))='www.'||h))),'[]'::jsonb))
 from public.managed_profiles m where m.id=p_id and m.is_public and m.username ~ '^[a-z0-9_]{3,24}$' and length(trim(m.display_name)) between 1 and 60
$$;
revoke all on function public.managed_feed_item(uuid) from public,anon,authenticated,service_role;

create or replace function public.public_directory(p_search text default '',p_platform text default '',p_country text default '',p_interest text default '',p_page integer default 0) returns jsonb language sql stable security definer set search_path=public as $$
 with matching as (
 select p.id,p.created_at,false as managed,jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'country',p.country,'interests',p.interests,'avatar_url',p.avatar_url,'created_at',p.created_at,'location',p.location,'categories',p.categories,'creator_xp',p.creator_xp,'creator_level',p.creator_level,'is_connected',exists(select 1 from public.member_connections c where c.user_id=auth.uid() and c.profile_id=p.id),'is_saved',exists(select 1 from public.favourites f where f.user_id=auth.uid() and f.profile_id=p.id),'managed',false,'feed_listing_paid',true,'feed_ends_at',(select max(ends_at) from public.feed_listing_orders where user_id=p.id and ends_at>now()),'social_links',coalesce((select jsonb_agg(to_jsonb(l)) from public.social_links l where l.profile_id=p.id and l.is_public and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])),'[]'::jsonb)) as item
 from public.profiles p where public.feed_is_active(p.id)
 and (coalesce(p_search,'')='' or (left(p_search,1)='@' and p.username=lower(substring(left(p_search,200),2))) or (left(p_search,1)<>'@' and concat_ws(' ',p.username,p.display_name,p.bio,p.country,array_to_string(p.interests,' ')) ilike '%'||left(p_search,200)||'%'))
 and (coalesce(p_country,'')='' or p.country ilike left(p_country,80))
 and (coalesce(p_interest,'')='' or exists(select 1 from unnest(p.interests) i where i ilike '%'||left(p_interest,80)||'%'))
 and (coalesce(p_platform,'')='' or exists(select 1 from public.social_links l where l.profile_id=p.id and l.is_public and l.platform=p_platform and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])))

 union all
 select m.id,m.created_at,true as managed,public.managed_feed_item(m.id) as item
 from public.managed_profiles m where public.managed_feed_item(m.id) is not null
 and (coalesce(p_search,'')='' or (left(p_search,1)='@' and m.username=lower(substring(left(p_search,200),2))) or (left(p_search,1)<>'@' and concat_ws(' ',m.username,m.display_name,m.bio,m.country,array_to_string(m.interests,' ')) ilike '%'||left(p_search,200)||'%'))
 and (coalesce(p_country,'')='' or m.country ilike left(p_country,80))
 and (coalesce(p_interest,'')='' or exists(select 1 from unnest(m.interests) i where i ilike '%'||left(p_interest,80)||'%'))
 and (coalesce(p_platform,'')='' or exists(select 1 from jsonb_array_elements(public.managed_feed_item(m.id)->'social_links') l where l->>'platform'=p_platform))
 ) select jsonb_build_object('feed_policy','purchased_dc_with_admin_exception_v1','server_now',now(),'total',(select count(*) from matching),'paid_rows','[]'::jsonb,'rows',(select coalesce(jsonb_agg(item),'[]'::jsonb) from (select item from matching order by created_at desc,id desc,managed desc limit 12 offset greatest(0,least(coalesce(p_page,0),100000))*12) r))
$$;
create or replace function public.discovery_profile(p_username text,p_managed boolean default false) returns jsonb language sql stable security definer set search_path=public as $$
 select case when coalesce(p_managed,false) then (select public.managed_feed_item(id) from public.managed_profiles where username=p_username) else (select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'country',p.country,'interests',p.interests,'avatar_url',p.avatar_url,'created_at',p.created_at,'location',p.location,'categories',p.categories,'creator_xp',p.creator_xp,'creator_level',p.creator_level,'is_connected',exists(select 1 from public.member_connections c where c.user_id=auth.uid() and c.profile_id=p.id),'is_saved',exists(select 1 from public.favourites f where f.user_id=auth.uid() and f.profile_id=p.id),'feed_listing_paid',public.feed_is_active(p.id),'social_links',coalesce((select jsonb_agg(to_jsonb(l)) from public.social_links l where l.profile_id=p.id and (l.is_public or p.id=auth.uid()) and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])),'[]'::jsonb)) from public.profiles p where p.username=p_username and (p.id=auth.uid() or public.feed_is_active(p.id))) end
$$;
revoke all on function public.admin_save_managed_profile(uuid,jsonb,text),public.public_directory(text,text,text,text,integer),public.discovery_profile(text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.admin_save_managed_profile(uuid,jsonb,text) to authenticated;
grant execute on function public.public_directory(text,text,text,text,integer),public.discovery_profile(text,boolean) to anon,authenticated;
do $$begin if (select snapshot from managed_feed_preservation) is distinct from pg_temp.managed_feed_snapshot() then raise exception 'Managed feed install changed original records; abort';end if;end$$;
notify pgrst,'reload schema';
commit;
