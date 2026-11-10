-- Explicit owner policy change: purchased DC + proven launch reward may buy listing time.
-- Other rewards remain excluded. No grants, backfill, balance changes or package edits during install.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table auth.users,public.profiles,public.managed_profiles,public.points_balance,public.points_ledger,public.bank_point_orders,public.audit_logs,public.notifications,public.feed_listing_orders,public.feed_listing_packages,public.feed_listing_settings,public.connection_reward_settings,public.member_connections,public.connection_reward_events,public.blocks,public.favourites,public.launch_awards,public.launch_campaign in share mode;
do $$begin
 if to_regclass('public.launch_awards') is null or to_regprocedure('public.feed_purchased_dc(uuid)') is null or to_regprocedure('public.feed_listing_dc(uuid)') is not null then raise exception 'Listing reward reconciliation requires the inspected launch/paid-feed baseline';end if;
end$$;
create function pg_temp.listing_reward_install_snapshot() returns jsonb language sql stable as $$
 select jsonb_build_object('users',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from auth.users t),'profiles',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.profiles t),'managed',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.managed_profiles t),'wallets',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text,'null')) from public.points_balance t),'ledger',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.points_ledger t),'deposits',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.bank_point_orders t),'audit',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.audit_logs t),'notifications',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.notifications t),'orders',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.feed_listing_orders t),'feed_listing_packages',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by key)::text,'null')) from public.feed_listing_packages t),'feed_listing_settings',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.feed_listing_settings t),'connection_reward_settings',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.connection_reward_settings t),'member_connections',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id,profile_id)::text,'null')) from public.member_connections t),'connection_reward_events',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id,profile_id)::text,'null')) from public.connection_reward_events t),'blocks',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by blocker_id,blocked_id)::text,'null')) from public.blocks t),'favourites',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id,profile_id)::text,'null')) from public.favourites t),'launch_awards',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.launch_awards t),'launch_campaign',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.launch_campaign t))
$$;
create temp table listing_reward_install_preservation on commit drop as select pg_temp.listing_reward_install_snapshot() snapshot;

create function public.feed_listing_dc(p_user uuid) returns bigint language sql volatile security definer set search_path=public as $$
 with movements as (
 select l.created_at,sum(case when l.points<0 then l.points::bigint when exists(
  select 1 from public.bank_point_orders b where l.ref_key='bank-order:'||b.id::text and b.user_id=l.user_id and b.status='approved' and b.points=l.points and b.points>0 and b.bank_reference is not null and b.reviewed_at is not null and b.reviewed_by is not null and b.reviewed_by<>b.user_id and b.verified_amount_kobo=b.amount_kobo and b.verified_currency='NGN' and b.verified_recipient='6977298247' and b.account_number='6977298247' and b.points::bigint*100=b.amount_kobo::bigint
 ) or exists(select 1 from public.launch_awards a where a.user_id=l.user_id and a.amount_dc=5000 and a.slot between 1 and 50 and l.points=5000 and a.activity_reference='launch:first50:'||a.user_id and l.ref_key=a.activity_reference) then l.points::bigint else 0 end) as delta from public.points_ledger l where l.user_id=p_user group by l.created_at
 ), running as (select sum(delta) over(order by created_at rows unbounded preceding) as value from movements)
 select greatest(0,least(coalesce((select balance::bigint from public.points_balance where user_id=p_user),0),coalesce((select sum(delta) from movements),0)-least(0,coalesce((select min(value) from running),0))))::bigint
$$;
create or replace function public.my_feed_listing(p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path=public as $$begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 return jsonb_build_object('enabled',coalesce((select enabled from public.feed_listing_settings where id),false),'server_now',now(),'purchased_dc',public.feed_purchased_dc(auth.uid()),'funding_policy','purchased_or_launch_reward_v1','listing_dc',public.feed_listing_dc(auth.uid()),'launch_reward_dc',greatest(0,public.feed_listing_dc(auth.uid())-public.feed_purchased_dc(auth.uid())),'total_dc',coalesce((select balance from public.points_balance where user_id=auth.uid()),0),'profile_ready',public.feed_profile_ready(auth.uid()),'active_until',(select max(ends_at) from public.feed_listing_orders where user_id=auth.uid() and ends_at>now()),'in_feed',public.feed_is_active(auth.uid()),'packages',(select coalesce(jsonb_agg(to_jsonb(p) order by duration_hours),'[]'::jsonb) from public.feed_listing_packages p where p.enabled),'total',(select count(*) from public.feed_listing_orders where user_id=auth.uid()),'rows',(select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('status',case when ends_at<=now() then 'expired' when starts_at>now() then 'queued' else 'active' end) order by created_at desc,id desc),'[]'::jsonb) from (select * from public.feed_listing_orders where user_id=auth.uid() order by created_at desc,id desc limit 10 offset greatest(0,least(coalesce(p_page,0),100000))*10) o));
end$$;
create or replace function public.buy_feed_listing(p_package text,p_request uuid,p_expected_cost integer,p_expected_hours integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare old public.feed_listing_orders; pkg public.feed_listing_packages; wallet integer; purchased bigint; available bigint; start_time timestamptz;
begin
 perform public.require_active_account();
 if p_request is null then raise exception 'Listing request ID required';end if;
 -- Same lock order as launch grants: profile before wallet.
 perform 1 from public.profiles where id=auth.uid() for update;
 -- Wallet row lock serializes different requests as well as retries for this owner.
 select balance into wallet from public.points_balance where user_id=auth.uid() for update;
 if not found then raise exception 'Not enough listing DC';end if;
 select * into old from public.feed_listing_orders where id=p_request;
 if found then
  if old.user_id is distinct from auth.uid() or old.package_key is distinct from p_package or old.cost_dc is distinct from p_expected_cost or old.duration_hours is distinct from p_expected_hours then raise exception 'Listing request unavailable';end if;
  return to_jsonb(old);
 end if;
 if not coalesce((select enabled from public.feed_listing_settings where id),false) then raise exception 'Feed listing purchases are paused';end if;
 select * into pkg from public.feed_listing_packages where key=p_package and enabled for share;
 if not found or pkg.cost_dc is distinct from p_expected_cost or pkg.duration_hours is distinct from p_expected_hours then raise exception 'Listing package changed; refresh before purchasing';end if;
 if not public.feed_profile_ready(auth.uid()) then raise exception 'Listing needs a public profile, display name and a public social link';end if;
 purchased:=public.feed_purchased_dc(auth.uid());
 available:=public.feed_listing_dc(auth.uid());
 if available<pkg.cost_dc or wallet<pkg.cost_dc then raise exception 'Not enough listing DC';end if;
 start_time:=greatest(clock_timestamp(),coalesce((select max(ends_at) from public.feed_listing_orders where user_id=auth.uid()),clock_timestamp()));
 insert into public.feed_listing_orders(id,user_id,package_key,cost_dc,duration_hours,starts_at,ends_at) values(p_request,auth.uid(),pkg.key,pkg.cost_dc,pkg.duration_hours,start_time,start_time+pkg.duration_hours*interval '1 hour') returning * into old;
 update public.points_balance set balance=balance-pkg.cost_dc where user_id=auth.uid();
 insert into public.points_ledger(user_id,points,reason,ref_key,created_at) values(auth.uid(),-pkg.cost_dc,'Feed listing '||pkg.label,'feed-listing:'||p_request,clock_timestamp());
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'feed_listing_purchased',p_request::text,jsonb_build_object('cost_dc',pkg.cost_dc,'purchased_before',purchased,'listing_dc_before',available,'funding_policy','purchased_or_launch_reward_v1','wallet_before',wallet,'wallet_after',wallet-pkg.cost_dc,'starts_at',old.starts_at,'ends_at',old.ends_at,'package',pkg.key));
 insert into public.notifications(user_id,title,body) values(auth.uid(),'Feed listing purchased',pkg.label||': '||pkg.cost_dc||' DC (purchased or launch reward). Starts '||old.starts_at||'; ends '||old.ends_at||'. No automatic renewal.');
 return to_jsonb(old);
end$$;
revoke all on function public.feed_listing_dc(uuid),public.my_feed_listing(integer),public.buy_feed_listing(text,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.my_feed_listing(integer),public.buy_feed_listing(text,uuid,integer,integer) to authenticated;
do $$begin if (select snapshot from listing_reward_install_preservation) is distinct from pg_temp.listing_reward_install_snapshot() then raise exception 'Listing reward install changed existing rows; abort';end if;end$$;
notify pgrst,'reload schema';
commit;
