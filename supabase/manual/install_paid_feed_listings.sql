-- Forward installation for inspected baseline 001–015 + 024 + standalone manual deposits.
-- Never replay absent 016–023. Requires separately authorized production activation/recovery decision.
begin;
set local lock_timeout='5s';
lock table auth.users,public.profiles,public.managed_profiles,public.points_balance,public.points_ledger,public.bank_point_orders,public.notifications,public.audit_logs in share mode;
do $$begin
 if to_regclass('public.feed_listing_orders') is not null or to_regprocedure('public.buy_promotion(uuid,uuid,text,integer,integer)') is not null or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='verified_amount_kobo') then raise exception 'Paid feed installation requires inspected baseline; reconcile before proceeding';end if;
end$$;
create function pg_temp.feed_snapshot() returns jsonb language sql stable as $$
 select jsonb_build_object('users',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from auth.users t),'profiles',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.profiles t),'managed',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.managed_profiles t),'wallets',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text,'null')) from public.points_balance t),'ledger',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.points_ledger t),'deposits',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.bank_point_orders t),'notifications',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.notifications t),'audit',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.audit_logs t))
$$;
create temp table feed_preservation on commit drop as select pg_temp.feed_snapshot() as snapshot;
create table public.feed_listing_settings(id boolean primary key default true check(id),enabled boolean not null default true);
insert into public.feed_listing_settings values(true,true);
create table public.feed_listing_packages(key text primary key,label text not null,duration_hours integer not null check(duration_hours between 7 and 720),cost_dc integer not null check(cost_dc>0),enabled boolean not null default true);
insert into public.feed_listing_packages(key,label,duration_hours,cost_dc) values('7h','7 hours',7,1200),('1d','24 hours',24,2400),('2d','48 hours',48,4600),('3d','72 hours',72,6800),('7d','1 week',168,15600),('14d','2 weeks',336,31000),('21d','3 weeks',504,46400),('30d','1 month (30 days)',720,66200);
create table public.feed_listing_orders(id uuid primary key,user_id uuid not null references public.profiles(id) on delete cascade,package_key text not null references public.feed_listing_packages(key),cost_dc integer not null check(cost_dc>0),duration_hours integer not null check(duration_hours between 7 and 720),starts_at timestamptz not null,ends_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),check(ends_at=starts_at+duration_hours*interval '1 hour'));
create index feed_listing_owner_end on public.feed_listing_orders(user_id,ends_at desc);
alter table public.feed_listing_settings enable row level security;
alter table public.feed_listing_packages enable row level security;
alter table public.feed_listing_orders enable row level security;
revoke all on public.feed_listing_settings,public.feed_listing_packages,public.feed_listing_orders from public,anon,authenticated,service_role;
create policy "feed package read" on public.feed_listing_packages for select to authenticated using(true);
create policy "feed order owner read" on public.feed_listing_orders for select to authenticated using(user_id=auth.uid());
grant select on public.feed_listing_packages,public.feed_listing_orders to authenticated;
-- Derived purchased sub-balance: no reclassification, seed grant, or wallet rewrite.
-- Proven deposit credits only; every debit consumes purchased DC first. Same-time events
-- are grouped conservatively. Arbitrary positive awards/refunds never become purchased DC.
create function public.feed_purchased_dc(p_user uuid) returns bigint language sql volatile security definer set search_path=public as $$
 with movements as (
 select l.created_at,sum(case when l.points<0 then l.points::bigint when exists(
  select 1 from public.bank_point_orders b where l.ref_key='bank-order:'||b.id::text and b.user_id=l.user_id and b.status='approved' and b.points=l.points and b.points>0 and b.bank_reference is not null and b.reviewed_at is not null and b.reviewed_by is not null and b.reviewed_by<>b.user_id and b.verified_amount_kobo=b.amount_kobo and b.verified_currency='NGN' and b.verified_recipient='6977298247' and b.account_number='6977298247' and b.points::bigint*100=b.amount_kobo::bigint
 ) then l.points::bigint else 0 end) as delta from public.points_ledger l where l.user_id=p_user group by l.created_at
 ), running as (select sum(delta) over(order by created_at rows unbounded preceding) as value from movements)
 select greatest(0,least(coalesce((select balance::bigint from public.points_balance where user_id=p_user),0),coalesce((select sum(delta) from movements),0)-least(0,coalesce((select min(value) from running),0))))::bigint
$$;
create function public.feed_profile_ready(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=p_user and p.is_public and length(trim(p.display_name))>0 and length(trim(p.username))>=3 and (u.banned_until is null or u.banned_until<=now()) and not exists(select 1 from public.account_restrictions r where r.user_id=p.id) and exists(select 1 from public.social_links l where l.profile_id=p.id and l.is_public and l.platform=any((select enabled_platforms from public.site_settings where id)::text[]) and length(l.url)<=500 and l.url ~ '^https://[^/@:#?]+/[^[:space:]]+$' and l.url !~ '[[:space:]<>\\]' and exists(select 1 from public.social_platforms c,unnest(c.hosts) h where c.key=l.platform and (lower(split_part(split_part(l.url,'://',2),'/',1))=h or lower(split_part(split_part(l.url,'://',2),'/',1))='www.'||h))))
$$;
create function public.feed_is_active(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.feed_profile_ready(p_user) and exists(select 1 from public.feed_listing_orders o where o.user_id=p_user and o.starts_at<=now() and o.ends_at>now()) and not exists(select 1 from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id=p_user) or (b.blocker_id=p_user and b.blocked_id=auth.uid()))
$$;
create function public.my_feed_listing(p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path=public as $$begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 return jsonb_build_object('enabled',coalesce((select enabled from public.feed_listing_settings where id),false),'server_now',now(),'purchased_dc',public.feed_purchased_dc(auth.uid()),'total_dc',coalesce((select balance from public.points_balance where user_id=auth.uid()),0),'profile_ready',public.feed_profile_ready(auth.uid()),'active_until',(select max(ends_at) from public.feed_listing_orders where user_id=auth.uid() and ends_at>now()),'in_feed',public.feed_is_active(auth.uid()),'packages',(select coalesce(jsonb_agg(to_jsonb(p) order by duration_hours),'[]'::jsonb) from public.feed_listing_packages p where p.enabled),'total',(select count(*) from public.feed_listing_orders where user_id=auth.uid()),'rows',(select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('status',case when ends_at<=now() then 'expired' when starts_at>now() then 'queued' else 'active' end) order by created_at desc,id desc),'[]'::jsonb) from (select * from public.feed_listing_orders where user_id=auth.uid() order by created_at desc,id desc limit 10 offset greatest(0,least(coalesce(p_page,0),100000))*10) o));
end$$;
create function public.buy_feed_listing(p_package text,p_request uuid,p_expected_cost integer,p_expected_hours integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare old public.feed_listing_orders; pkg public.feed_listing_packages; wallet integer; purchased bigint; start_time timestamptz;
begin
 perform public.require_active_account();
 if p_request is null then raise exception 'Listing request ID required';end if;
 -- Wallet row lock serializes different requests as well as retries for this owner.
 select balance into wallet from public.points_balance where user_id=auth.uid() for update;
 if not found then raise exception 'Not enough purchased DC';end if;
 select * into old from public.feed_listing_orders where id=p_request;
 if found then
  if old.user_id is distinct from auth.uid() or old.package_key is distinct from p_package or old.cost_dc is distinct from p_expected_cost or old.duration_hours is distinct from p_expected_hours then raise exception 'Listing request unavailable';end if;
  return to_jsonb(old);
 end if;
 if not coalesce((select enabled from public.feed_listing_settings where id),false) then raise exception 'Feed listing purchases are paused';end if;
 select * into pkg from public.feed_listing_packages where key=p_package and enabled for share;
 if not found or pkg.cost_dc is distinct from p_expected_cost or pkg.duration_hours is distinct from p_expected_hours then raise exception 'Listing package changed; refresh before purchasing';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if not public.feed_profile_ready(auth.uid()) then raise exception 'Listing needs a public profile, display name and a public social link';end if;
 purchased:=public.feed_purchased_dc(auth.uid());
 if purchased<pkg.cost_dc or wallet<pkg.cost_dc then raise exception 'Not enough purchased DC';end if;
 start_time:=greatest(clock_timestamp(),coalesce((select max(ends_at) from public.feed_listing_orders where user_id=auth.uid()),clock_timestamp()));
 insert into public.feed_listing_orders(id,user_id,package_key,cost_dc,duration_hours,starts_at,ends_at) values(p_request,auth.uid(),pkg.key,pkg.cost_dc,pkg.duration_hours,start_time,start_time+pkg.duration_hours*interval '1 hour') returning * into old;
 update public.points_balance set balance=balance-pkg.cost_dc where user_id=auth.uid();
 insert into public.points_ledger(user_id,points,reason,ref_key,created_at) values(auth.uid(),-pkg.cost_dc,'Purchased DC: feed listing '||pkg.label,'feed-listing:'||p_request,clock_timestamp());
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'feed_listing_purchased',p_request::text,jsonb_build_object('cost_dc',pkg.cost_dc,'purchased_before',purchased,'wallet_before',wallet,'wallet_after',wallet-pkg.cost_dc,'starts_at',old.starts_at,'ends_at',old.ends_at,'package',pkg.key));
 insert into public.notifications(user_id,title,body) values(auth.uid(),'Feed listing purchased',pkg.label||': '||pkg.cost_dc||' purchased DC. Starts '||old.starts_at||'; ends '||old.ends_at||'. No automatic renewal.');
 return to_jsonb(old);
end$$;
-- All feed entry points use this RPC, including home/dashboard previews.
create or replace function public.public_directory(p_search text default '',p_platform text default '',p_country text default '',p_interest text default '',p_page integer default 0) returns jsonb language sql stable security definer set search_path=public as $$
 with matching as (
 select p.id,p.created_at,jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'country',p.country,'interests',p.interests,'avatar_url',p.avatar_url,'created_at',p.created_at,'location',p.location,'categories',p.categories,'creator_xp',p.creator_xp,'creator_level',p.creator_level,'managed',false,'feed_listing_paid',true,'feed_ends_at',(select max(ends_at) from public.feed_listing_orders where user_id=p.id and ends_at>now()),'social_links',coalesce((select jsonb_agg(to_jsonb(l)) from public.social_links l where l.profile_id=p.id and l.is_public and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])),'[]'::jsonb)) as item
 from public.profiles p where public.feed_is_active(p.id)
 and (coalesce(p_search,'')='' or concat_ws(' ',p.username,p.display_name,p.bio,p.country,array_to_string(p.interests,' ')) ilike '%'||left(p_search,200)||'%')
 and (coalesce(p_country,'')='' or p.country ilike left(p_country,80))
 and (coalesce(p_interest,'')='' or exists(select 1 from unnest(p.interests) i where i ilike '%'||left(p_interest,80)||'%'))
 and (coalesce(p_platform,'')='' or exists(select 1 from public.social_links l where l.profile_id=p.id and l.is_public and l.platform=p_platform and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])))
 ) select jsonb_build_object('feed_policy','purchased_dc_v1','server_now',now(),'total',(select count(*) from matching),'paid_rows','[]'::jsonb,'rows',(select coalesce(jsonb_agg(item),'[]'::jsonb) from (select item from matching order by created_at desc,id desc limit 12 offset greatest(0,least(coalesce(p_page,0),100000))*12) r))
$$;
-- No public REST bypass. Owners keep access to their own unpaid/expired profile.
alter policy "public profiles readable" on public.profiles using(public.feed_is_active(id) or auth.uid()=id);
-- Managed listings have no purchased owner/order; cannot receive free feed placement.
alter policy "managed profiles read" on public.managed_profiles using(false);
create function public.discovery_profile(p_username text,p_managed boolean default false) returns jsonb language sql stable security definer set search_path=public as $$
 select case when coalesce(p_managed,false) then null else (select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'country',p.country,'interests',p.interests,'avatar_url',p.avatar_url,'created_at',p.created_at,'location',p.location,'categories',p.categories,'creator_xp',p.creator_xp,'creator_level',p.creator_level,'feed_listing_paid',public.feed_is_active(p.id),'social_links',coalesce((select jsonb_agg(to_jsonb(l)) from public.social_links l where l.profile_id=p.id and (l.is_public or p.id=auth.uid()) and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])),'[]'::jsonb)) from public.profiles p where p.username=p_username and (p.id=auth.uid() or public.feed_is_active(p.id))) end
$$;
revoke all on function public.feed_purchased_dc(uuid),public.feed_profile_ready(uuid),public.feed_is_active(uuid),public.my_feed_listing(integer),public.buy_feed_listing(text,uuid,integer,integer),public.discovery_profile(text,boolean),public.public_directory(text,text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.feed_is_active(uuid),public.discovery_profile(text,boolean),public.public_directory(text,text,text,text,integer) to anon,authenticated;
grant execute on function public.my_feed_listing(integer),public.buy_feed_listing(text,uuid,integer,integer) to authenticated;
do $$begin if (select snapshot from feed_preservation) is distinct from pg_temp.feed_snapshot() then raise exception 'Paid feed install changed original records; abort';end if;end$$;
notify pgrst,'reload schema';
commit;
