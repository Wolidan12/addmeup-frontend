-- Member workspace, configurable site content, referrals and bounded point boosters.
begin;
create table public.site_settings(
 id boolean primary key default true check(id), brand_name text not null default 'Danqel Social Boost' check(length(brand_name) between 1 and 60),
 hero_title text not null default 'Good connections. Greater reach.' check(length(hero_title) between 1 and 120),
 hero_description text not null default 'Meet creators, share your social profiles and make meaningful connections.' check(length(hero_description) between 1 and 500),
 support_email text check(support_email is null or support_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
 maintenance_mode boolean not null default false,
 enabled_platforms text[] not null default array['whatsapp','instagram','snapchat','tiktok','facebook','x'] check(enabled_platforms <@ array['whatsapp','instagram','snapchat','tiktok','facebook','x']::text[])
);
insert into public.site_settings(id) values(true);
create table public.boost_plans(
 id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 1 and 80),
 cost_points int not null check(cost_points between 1 and 1000000),multiplier int not null check(multiplier between 2 and 10),
 duration_hours int not null check(duration_hours between 1 and 168),bonus_cap int not null check(bonus_cap between 1 and 1000000),
 is_active boolean not null default true,created_at timestamptz not null default now()
);
create table public.user_boosts(
 id uuid primary key, user_id uuid references auth.users(id) on delete set null,plan_id uuid not null references public.boost_plans(id),
 plan_title text not null,cost_points int not null,multiplier int not null,bonus_cap int not null,bonus_used int not null default 0 check(bonus_used>=0 and bonus_used<=bonus_cap),
 starts_at timestamptz not null default now(),expires_at timestamptz not null,created_at timestamptz not null default now()
);
create index member_boost_active on public.user_boosts(user_id,expires_at desc);
create table public.referral_purchase_rewards(
 order_id uuid primary key references public.bank_point_orders(id),referrer_id uuid,referred_id uuid,
 points int not null check(points>0),percent int not null,created_at timestamptz not null default now()
);
insert into public.reward_config(key,value) values('referral_purchase_percent',0) on conflict do nothing;
alter table public.site_settings enable row level security;
alter table public.boost_plans enable row level security;
alter table public.user_boosts enable row level security;
alter table public.referral_purchase_rewards enable row level security;
create policy "site settings read" on public.site_settings for select using(true);
create policy "active boosters read" on public.boost_plans for select using(is_active);
create policy "own booster history" on public.user_boosts for select to authenticated using(user_id=auth.uid());
create policy "own referral purchase rewards" on public.referral_purchase_rewards for select to authenticated using(referrer_id=auth.uid());
grant select on public.site_settings,public.boost_plans to anon,authenticated;
grant select on public.user_boosts,public.referral_purchase_rewards to authenticated;
revoke insert,update,delete on public.site_settings,public.boost_plans,public.user_boosts,public.referral_purchase_rewards from anon,authenticated;
create or replace function public.require_active_account() returns void language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if exists(select 1 from public.account_restrictions where user_id=auth.uid()) then raise exception 'Account restricted'; end if;
 if exists(select 1 from public.site_settings where maintenance_mode) and public.admin_role() is distinct from 'super_admin' then raise exception 'The platform is temporarily paused for maintenance'; end if;
end$$;
create or replace function public.ensure_member_balance() returns void language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.points_balance(user_id,referral_code) values(auth.uid(),'DQ-'||replace(auth.uid()::text,'-','')) on conflict(user_id) do update set referral_code=coalesce(public.points_balance.referral_code,excluded.referral_code);
end$$;
create or replace function public.apply_referral(p_code text) returns text language plpgsql security definer set search_path=public as $$
declare inviter uuid;
begin
 perform public.require_active_account();perform public.ensure_member_balance();
 select user_id into inviter from public.points_balance where lower(referral_code)=lower(trim(p_code));
 if inviter is null or inviter=auth.uid() or exists(select 1 from public.account_restrictions where user_id=inviter) then raise exception 'Invalid referral code'; end if;
 if exists(select 1 from public.bank_point_orders where user_id=auth.uid() and status='approved') then raise exception 'A referral must be linked before your first approved purchase'; end if;
 if exists(with recursive chain(id,path) as (
  select inviter,array[inviter] union all select r.referrer_id,c.path||r.referrer_id from public.referrals r join chain c on r.referred_id=c.id where not r.referrer_id=any(c.path)
 ) select 1 from chain where id=auth.uid()) then raise exception 'Circular referrals are not allowed'; end if;
 insert into public.referrals(referrer_id,referred_id,rewarded) values(inviter,auth.uid(),false);
 update public.points_balance set referred_by=inviter where user_id=auth.uid();
 return 'Referral linked. Your referrer can earn points on eligible approved point purchases.';
end$$;
create or replace function public.award_order_referral(p_order uuid) returns void language plpgsql security definer set search_path=public as $$
declare item public.bank_point_orders;inviter uuid;rate int;reward int;
begin
 select * into item from public.bank_point_orders where id=p_order;
 select r.referrer_id into inviter from public.referrals r join auth.users u on u.id=r.referrer_id where r.referred_id=item.user_id;
 select value into rate from public.reward_config where key='referral_purchase_percent';
 if item.status<>'submitted' or inviter is null or inviter=item.user_id or coalesce(rate,0)<=0 or rate>50 or exists(select 1 from public.account_restrictions where user_id=inviter) then return; end if;
 reward:=floor(item.points::numeric*rate/100)::int;
 if reward<1 then return; end if;
 insert into public.referral_purchase_rewards(order_id,referrer_id,referred_id,points,percent) values(p_order,inviter,item.user_id,reward,rate) on conflict do nothing;
 if not found then return; end if;
 insert into public.points_balance(user_id,balance) values(inviter,reward) on conflict(user_id) do update set balance=public.points_balance.balance+reward;
 insert into public.points_ledger(user_id,points,reason,ref_key) values(inviter,reward,'Referral purchase reward','referral-purchase:'||p_order);
 update public.referrals set rewarded=true where referred_id=item.user_id;
 insert into public.notifications(user_id,title,body) values(inviter,'Referral reward earned',reward||' points were added for an approved referral point purchase.');
end$$;
-- Private helper: no browser can call it to manufacture bonus points.
create or replace function public.consume_boost_bonus(p_base int) returns int language plpgsql security definer set search_path=public as $$
declare active public.user_boosts;bonus int;
begin
 select * into active from public.user_boosts where user_id=auth.uid() and expires_at>now() and starts_at<=now() order by expires_at desc limit 1 for update;
 if not found then return 0; end if;
 bonus:=least(greatest(p_base,0)*(active.multiplier-1),active.bonus_cap-active.bonus_used);
 update public.user_boosts set bonus_used=bonus_used+bonus where id=active.id;
 return bonus;
end$$;
create or replace function public.activate_point_boost(p_plan uuid,p_request uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare plan public.boost_plans;existing public.user_boosts;
begin
 perform public.require_active_account();perform public.ensure_member_balance();
 if p_request is null then raise exception 'Request ID required'; end if;
 -- Balance is locked before boost rows, consistent with reward claims.
 perform 1 from public.points_balance where user_id=auth.uid() for update;
 select * into existing from public.user_boosts where id=p_request;
 if found then
  if existing.user_id is distinct from auth.uid() or existing.plan_id<>p_plan then raise exception 'Request unavailable'; end if;
  return existing.id;
 end if;
 if exists(select 1 from public.user_boosts where user_id=auth.uid() and expires_at>now()) then raise exception 'You already have an active booster'; end if;
 select * into plan from public.boost_plans where id=p_plan and is_active for share;
 if not found then raise exception 'Boost plan unavailable'; end if;
 if (select balance from public.points_balance where user_id=auth.uid())<plan.cost_points then raise exception 'Not enough points for this plan'; end if;
 update public.points_balance set balance=balance-plan.cost_points where user_id=auth.uid();
 insert into public.user_boosts(id,user_id,plan_id,plan_title,cost_points,multiplier,bonus_cap,expires_at) values(p_request,auth.uid(),plan.id,plan.title,plan.cost_points,plan.multiplier,plan.bonus_cap,now()+make_interval(hours=>plan.duration_hours));
 insert into public.points_ledger(user_id,points,reason,ref_key) values(auth.uid(),-plan.cost_points,'Booster activation: '||plan.title,'booster:'||p_request);
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'boost_activated',p_request::text,jsonb_build_object('cost_points',plan.cost_points,'multiplier',plan.multiplier));
 return p_request;
end$$;
create or replace function public.member_overview() returns jsonb language plpgsql security definer set search_path=public as $$begin
 perform public.ensure_member_balance();
 return jsonb_build_object(
 'balance',(select to_jsonb(b) from public.points_balance b where user_id=auth.uid()),
 'profile',(select to_jsonb(p) from public.profiles p where id=auth.uid()),
 'social_count',(select count(*) from public.social_links where profile_id=auth.uid()),
 'profile_views',(select count(*) from public.profile_views where profile_id=auth.uid()),
 'referral_count',(select count(*) from public.referrals where referrer_id=auth.uid()),
 'referral_earnings',(select coalesce(sum(points::bigint),0) from public.points_ledger where user_id=auth.uid() and (reason='referral' or ref_key like 'referral-purchase:%')),
 'referral_percent',(select value from public.reward_config where key='referral_purchase_percent'),
 'referred_by',(select referrer_id from public.referrals where referred_id=auth.uid()),
 'active_boost',(select to_jsonb(b) from public.user_boosts b where user_id=auth.uid() and expires_at>now() order by expires_at desc limit 1),
 'recent_activity',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (select * from public.points_ledger where user_id=auth.uid() order by created_at desc,id desc limit 6) r),
 'unread_notifications',(select count(*) from public.notifications where user_id=auth.uid() and not is_read),
 'pending_orders',(select count(*) from public.bank_point_orders where user_id=auth.uid() and status in ('submitted','awaiting_transfer')),
 'restricted',exists(select 1 from public.account_restrictions where user_id=auth.uid()),
 'role',public.admin_role());
end$$;
create or replace function public.member_referrals(p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return jsonb_build_object('total',(select count(*) from public.referrals where referrer_id=auth.uid()),'rows',(
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
 select f.id,case when p.is_public then p.display_name else 'Member' end as display_name,f.created_at,f.rewarded,
 (select coalesce(sum(x.points),0) from public.referral_purchase_rewards x where x.referred_id=f.referred_id and x.referrer_id=auth.uid()) as purchase_reward_points
 from public.referrals f left join public.profiles p on p.id=f.referred_id where f.referrer_id=auth.uid() order by f.created_at desc,f.id desc limit 20 offset greatest(0,least(p_page,100000))*20
 ) r));
end$$;
create or replace function public.admin_save_boost_plan(p_id uuid,p_data jsonb,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
 if p_id is null or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'ID and reason required'; end if;
 insert into public.boost_plans(id,title,cost_points,multiplier,duration_hours,bonus_cap,is_active) values(p_id,trim(p_data->>'title'),(p_data->>'cost_points')::int,(p_data->>'multiplier')::int,(p_data->>'duration_hours')::int,(p_data->>'bonus_cap')::int,(p_data->>'is_active')::boolean)
 on conflict(id) do update set title=excluded.title,cost_points=excluded.cost_points,multiplier=excluded.multiplier,duration_hours=excluded.duration_hours,bonus_cap=excluded.bonus_cap,is_active=excluded.is_active;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'boost_plan_saved',p_id::text,jsonb_build_object('reason',p_reason,'config',p_data));
end$$;
create or replace function public.admin_save_site_settings(p_data jsonb,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Reason required'; end if;
 update public.site_settings set support_email=nullif(trim(p_data->>'support_email'),''),brand_name=p_data->>'brand_name',hero_title=p_data->>'hero_title',hero_description=p_data->>'hero_description',maintenance_mode=(p_data->>'maintenance_mode')::boolean,enabled_platforms=array(select jsonb_array_elements_text(p_data->'enabled_platforms')) where id;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'site_settings_saved','site',jsonb_build_object('reason',p_reason,'config',p_data));
end$$;
-- Real directory only. Fixed queries, public links only, bounded pagination and block enforcement.
create or replace function public.public_directory(p_search text default '',p_platform text default '',p_country text default '',p_interest text default '',p_page int default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 with all_profiles as (
 select p.id,p.username,p.display_name,p.bio,p.country,p.interests,p.is_sponsored,p.created_at,
 to_jsonb(p)||jsonb_build_object('managed',false,'social_links',coalesce((select jsonb_agg(to_jsonb(l)) from public.social_links l where l.profile_id=p.id and l.is_public and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])),'[]'::jsonb)) as item
 from public.profiles p where p.is_public and not exists(select 1 from public.blocks where blocker_id=auth.uid() and blocked_id=p.id)
 union all
 select p.id,p.username,p.display_name,p.bio,p.country,p.interests,false,p.created_at,
 (to_jsonb(p)-'created_by')||jsonb_build_object('managed',true,'social_links',coalesce((select jsonb_agg(l) from jsonb_array_elements(p.social_links) l where l->>'is_public'='true' and l->>'platform'=any((select enabled_platforms from public.site_settings where id)::text[])),'[]'::jsonb))
 from public.managed_profiles p where p.is_public
 ), matching as (
 select * from all_profiles p where (coalesce(p_search,'')='' or concat_ws(' ',p.username,p.display_name,p.bio,p.country,array_to_string(p.interests,' ')) ilike '%'||left(p_search,200)||'%')
 and (coalesce(p_country,'')='' or p.country ilike left(p_country,80)) and (coalesce(p_interest,'')='' or exists(select 1 from unnest(p.interests) i where i ilike '%'||left(p_interest,80)||'%'))
 and (coalesce(p_platform,'')='' or exists(select 1 from jsonb_array_elements(p.item->'social_links') l where l->>'platform'=p_platform))
 ) select jsonb_build_object('total',(select count(*) from matching),'rows',(select coalesce(jsonb_agg(item),'[]'::jsonb) from (select item from matching order by is_sponsored desc,created_at desc,id desc limit 12 offset greatest(0,least(p_page,100000))*12) r)) into result;
 return result;
end$$;
revoke all on function public.ensure_member_balance(),public.award_order_referral(uuid),public.consume_boost_bonus(int) from public,anon,authenticated;
revoke all on function public.activate_point_boost(uuid,uuid),public.member_overview(),public.member_referrals(int),public.admin_save_boost_plan(uuid,jsonb,text),public.admin_save_site_settings(jsonb,text) from public,anon;
grant execute on function public.activate_point_boost(uuid,uuid),public.member_overview(),public.member_referrals(int),public.admin_save_boost_plan(uuid,jsonb,text),public.admin_save_site_settings(jsonb,text) to authenticated;
grant execute on function public.public_directory(text,text,text,text,int) to anon,authenticated;

create or replace function public.claim_daily_checkin() returns text language plpgsql security definer set search_path=public as $$declare pts int; b record; bonus int; begin perform public.require_active_account(); if auth.uid() is null then raise exception 'Not signed in'; end if; if not exists(select 1 from public.reward_config where key='checkin_enabled' and value=1) then raise exception 'Daily rewards paused'; end if; select value into pts from public.reward_config where key='daily_checkin_points'; insert into public.points_balance(user_id,referral_code) values(auth.uid(),'DQ-'||substr(md5(auth.uid()::text),1,8)) on conflict(user_id) do nothing; select * into b from public.points_balance where user_id=auth.uid() for update; if b.last_checkin=current_date then raise exception 'Already checked in today'; end if; bonus:=public.consume_boost_bonus(pts); pts:=pts+bonus; update public.points_balance set balance=balance+pts, current_streak=case when b.last_checkin=current_date-1 then b.current_streak+1 else 1 end, last_checkin=current_date where user_id=auth.uid(); insert into public.points_ledger(user_id,points,reason,ref_key) values(auth.uid(),pts,'daily_checkin','checkin:'||auth.uid()||':'||current_date); return 'Check-in complete: +'||pts||' pts'; end$$;

create or replace function public.claim_task(p_task text) returns text language plpgsql security definer set search_path=public as $$
declare t record; c int; awarded int;
begin
 perform public.require_active_account();
 select * into t from public.reward_tasks where slug=p_task and is_active for share;
 if not found then raise exception 'Task unavailable'; end if;
 if t.daily_limit is null or t.daily_limit<1 then raise exception 'Invalid task configuration'; end if;
 if p_task='complete-profile' then
  if not exists(select 1 from public.profiles where id=auth.uid() and length(trim(bio))>0 and length(trim(country))>0 and cardinality(interests)>0 and display_name<>'New creator') then raise exception 'Complete your profile first'; end if;
 elsif p_task='add-social-link' then
  if not exists(select 1 from public.social_links where profile_id=auth.uid() and is_public and platform=any((select enabled_platforms from public.site_settings where id)::text[]) and (url ~ '^https://[^[:space:]]+$' or (platform='whatsapp' and url ~ '^\+?[0-9[:space:]-]{7,20}$'))) then raise exception 'Add a public HTTPS social link first'; end if;
 else
  -- Browsing is not trustworthy proof. Custom tasks need evidence approval in stage 2.
  raise exception 'This task requires a server-verified evidence workflow';
 end if;
 insert into public.task_claims(user_id,task_slug,count) values(auth.uid(),p_task,1)
 on conflict(user_id,task_slug,claimed_on) do update set count=public.task_claims.count+1 returning count into c;
 if c>t.daily_limit then raise exception 'Daily limit reached'; end if;
 perform public.ensure_member_balance();
 perform 1 from public.points_balance where user_id=auth.uid() for update;
 awarded:=t.points+public.consume_boost_bonus(t.points);
 insert into public.points_balance(user_id,balance) values(auth.uid(),awarded)
 on conflict(user_id) do update set balance=public.points_balance.balance+awarded;
 insert into public.points_ledger(user_id,points,reason,ref_key) values(auth.uid(),awarded,'task:'||p_task,'task:'||auth.uid()||':'||p_task||':'||current_date||':'||c);
 return 'Task claimed: +'||awarded||' pts';
end$$;

create or replace function public.admin_review_bank_order(p_order uuid,p_approve boolean,p_bank_reference text,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare item public.bank_point_orders;
begin
 if coalesce(public.admin_role(),'') not in ('super_admin','finance_admin') then raise exception 'Permission denied' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 or p_approve is null then raise exception 'Review reason is required'; end if;
 select * into item from public.bank_point_orders where id=p_order for update;
 if not found then raise exception 'Order not found'; end if;
 if item.user_id is null then raise exception 'Account has been deleted; resolve this payment outside the points system'; end if;
 if item.user_id=auth.uid() then raise exception 'You cannot review your own payment'; end if;
 if item.status=(case when p_approve then 'approved' else 'rejected' end) then return; end if;
 if item.status<>'submitted' then raise exception 'Only submitted payments may be reviewed'; end if;
 if p_approve then
  if p_bank_reference is null or length(trim(p_bank_reference)) not between 4 and 120 then raise exception 'Bank statement transaction reference is required'; end if;
  -- Exact normalized bank transaction ID can fund only one order. Receipt images are NOT verification.
  update public.bank_point_orders set bank_reference=lower(trim(p_bank_reference)) where id=p_order;
  insert into public.points_balance(user_id,balance) values(item.user_id,item.points)
  on conflict(user_id) do update set balance=public.points_balance.balance+item.points;
  insert into public.points_ledger(user_id,points,reason,ref_key) values(item.user_id,item.points,'Bank transfer: '||item.package_title,'bank-order:'||item.id);
  perform public.award_order_referral(p_order);
 end if;
 update public.bank_point_orders set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),review_note=trim(p_reason),reviewed_at=now() where id=p_order;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),case when p_approve then 'bank_order_approved' else 'bank_order_rejected' end,p_order::text,jsonb_build_object('reason',p_reason,'bank_reference',case when p_approve then lower(trim(p_bank_reference)) end,'points',item.points,'amount_kobo',item.amount_kobo));
 insert into public.notifications(user_id,title,body) values(item.user_id,case when p_approve then 'Payment approved' else 'Payment not approved' end,case when p_approve then item.points||' points have been added to your balance.' else 'Your transfer needs attention: '||trim(p_reason) end);
end$$;

create or replace function public.admin_list(p_resource text,p_search text default '',p_status text default '',p_page int default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare tbl text; search_col text; status_col text; order_col text; clause text; result jsonb; total bigint;
begin
 if not public.admin_can(p_resource) then raise exception 'Permission denied' using errcode='42501'; end if;
 case p_resource
 when 'bank_transfer_details' then tbl:='bank_transfer_details'; search_col:='bank_name'; order_col:='id';
 when 'site_settings' then tbl:='site_settings'; search_col:='brand_name'; order_col:='id';
 when 'boost_plans' then tbl:='boost_plans'; search_col:='title'; order_col:='created_at';
 when 'user_boosts' then tbl:='user_boosts'; search_col:='plan_title'; order_col:='created_at';
 when 'referral_purchase_rewards' then tbl:='referral_purchase_rewards'; search_col:='referrer_id'; order_col:='created_at';
 when 'point_packages' then tbl:='point_packages'; search_col:='title'; order_col:='created_at';
 when 'bank_point_orders' then tbl:='bank_point_orders'; search_col:='payer_name'; status_col:='status'; order_col:='created_at';
 when 'managed_profiles' then tbl:='managed_profiles'; search_col:='username'; order_col:='created_at';
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
  if p_target='referral_purchase_percent' and (delta<0 or delta>50) then raise exception 'Referral percentage must be 0–50'; end if;
  if delta is null or delta<0 or delta>10000 or (p_target='checkin_enabled' and delta not in (0,1)) then raise exception 'Invalid reward value'; end if;
  update public.reward_config set value=delta where key=p_target;
  if not found then raise exception 'Unknown reward key'; end if;
 when 'toggle_task' then
  if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
  if (p_value->>'enabled')::boolean and not exists(select 1 from public.reward_tasks where id=p_target::uuid and slug in ('complete-profile','add-social-link')) then raise exception 'Task requires evidence review before activation'; end if;
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


create or replace function public.admin_save_bank_details(p_data jsonb,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 or coalesce(p_data->>'account_number','') !~ '^[0-9]{10}$' or length(coalesce(p_data->>'account_name','')) not between 2 and 120 or length(coalesce(p_data->>'bank_name','')) not between 2 and 80 then raise exception 'Valid bank details and reason required'; end if;
 update public.bank_transfer_details set account_number=p_data->>'account_number',account_name=trim(p_data->>'account_name'),bank_name=trim(p_data->>'bank_name') where id;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'bank_details_saved','bank',jsonb_build_object('reason',p_reason,'details',p_data));
end$$;
create or replace function public.admin_edit_profile(p_id uuid,p_data jsonb,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Reason required'; end if;
 update public.profiles set username=p_data->>'username',display_name=trim(p_data->>'display_name'),bio=p_data->>'bio',country=left(p_data->>'country',80),is_public=(p_data->>'is_public')::boolean where id=p_id;
 if not found then raise exception 'Profile not found'; end if;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'profile_edited',p_id::text,jsonb_build_object('reason',p_reason,'changes',p_data));
end$$;
create or replace function public.admin_edit_reward_task(p_id uuid,p_data jsonb,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare task public.reward_tasks;begin
 if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Reason required'; end if;
 select * into task from public.reward_tasks where id=p_id for update;
 if not found then raise exception 'Task not found'; end if;
 if task.slug not in ('complete-profile','add-social-link') and (p_data->>'is_active')::boolean then raise exception 'This task requires an evidence-review workflow before activation'; end if;
 if length(trim(coalesce(p_data->>'title',''))) not between 1 and 120 or (p_data->>'points')::int not between 1 and 10000 or (p_data->>'daily_limit')::int not between 1 and 10 then raise exception 'Invalid task limits'; end if;
 update public.reward_tasks set title=trim(p_data->>'title'),description=left(p_data->>'description',500),points=(p_data->>'points')::int,daily_limit=(p_data->>'daily_limit')::int,is_active=(p_data->>'is_active')::boolean where id=p_id;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'reward_task_edited',p_id::text,jsonb_build_object('reason',p_reason,'changes',p_data));
end$$;
revoke all on function public.admin_save_bank_details(jsonb,text),public.admin_edit_profile(uuid,jsonb,text),public.admin_edit_reward_task(uuid,jsonb,text) from public,anon;
grant execute on function public.admin_save_bank_details(jsonb,text),public.admin_edit_profile(uuid,jsonb,text),public.admin_edit_reward_task(uuid,jsonb,text) to authenticated;
create or replace function public.guard_account_write() returns trigger language plpgsql set search_path=public as $$declare host_pattern text; begin
 if current_user in ('authenticated','anon') then
  perform public.require_active_account();
  if tg_table_name='profiles' then
   if tg_op='INSERT' then if new.is_sponsored then raise exception 'Sponsorship requires approval'; end if; end if;
  end if;
  if tg_table_name='social_links' then
   if tg_op<>'DELETE' then
    if not exists(select 1 from public.site_settings where new.platform=any(enabled_platforms)) then raise exception 'This social platform is not currently available'; end if;
    if new.platform='whatsapp' and new.url ~ '^\+?[0-9[:space:]-]{7,20}$' then new.url:='https://wa.me/'||regexp_replace(new.url,'[^0-9]','','g'); end if;
    host_pattern:=case new.platform when 'whatsapp' then '^https://wa\.me/[0-9]{7,20}$' when 'instagram' then '^https://(www\.)?instagram\.com(/|$)' when 'snapchat' then '^https://(www\.)?snapchat\.com(/|$)' when 'tiktok' then '^https://(www\.)?tiktok\.com(/|$)' when 'facebook' then '^https://(www\.)?(facebook|fb)\.com(/|$)' when 'x' then '^https://(www\.)?(x|twitter)\.com(/|$)' end;
    if new.is_public and (host_pattern is null or new.url !~ host_pattern or new.url ~ '[[:space:]]' or length(new.url)>500) then raise exception 'Use a valid official HTTPS social profile URL'; end if;
   end if;
  end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end$$;

create or replace function public.admin_can(p_scope text) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(public.admin_role()='super_admin' or
 (public.admin_role()='moderator' and p_scope in ('overview','profiles','social_links','reports','reward_tasks')) or
 (public.admin_role()='finance_admin' and p_scope in ('overview','payment_transactions','subscriptions','promotions','points_ledger','points_balance','referrals','bank_point_orders','user_boosts','referral_purchase_rewards')) or
 (public.admin_role()='support_agent' and p_scope in ('overview','profiles','reports','notifications')),false)
$$;



-- A private parent profile must not leak its links through direct table reads.
drop policy "public links readable" on public.social_links;
create policy "public links readable" on public.social_links for select using(
 profile_id=auth.uid() or (is_public and platform=any((select enabled_platforms from public.site_settings where id)::text[])
 and exists(select 1 from public.profiles p where p.id=profile_id and p.is_public))
);

commit;
