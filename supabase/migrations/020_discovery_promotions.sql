-- Extends existing discovery, DC products/orders, ledger and staff audit. No resets.
begin;
-- Fail closed for accounts without a user_roles row (SQL NULL is not authorization).
create or replace function public.mission_staff_access() returns boolean language sql stable security definer set search_path=public as $$select coalesce(public.reward_account_verified(auth.uid()) and public.admin_role()='super_admin',false)$$;
create function public.discovery_visible(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles where id=p_user and is_public) and not exists(select 1 from public.account_restrictions where user_id=p_user) and not exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_user) or (blocked_id=auth.uid() and blocker_id=p_user))$$;
revoke all on function public.discovery_visible(uuid) from public,anon,authenticated,service_role;
grant execute on function public.discovery_visible(uuid) to anon,authenticated;
drop policy "public profiles readable" on public.profiles;
create policy "public profiles readable" on public.profiles for select using(id=auth.uid() or public.discovery_visible(id));
drop policy "public links readable" on public.social_links;
create policy "public links readable" on public.social_links for select using(profile_id=auth.uid() or (is_public and public.discovery_visible(profile_id) and platform=any((select enabled_platforms from public.site_settings where id)::text[])));
create table public.member_connections(user_id uuid not null references auth.users(id) on delete cascade,profile_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,profile_id),check(user_id<>profile_id));
alter table public.member_connections enable row level security;
create policy "own connections read" on public.member_connections for select to authenticated using(user_id=auth.uid());
revoke all on public.member_connections from public,anon,authenticated,service_role;grant select on public.member_connections to authenticated;
revoke insert,update,delete,truncate on public.favourites,public.blocks from public,anon,authenticated;
create function public.discovery_relationship(p_target uuid,p_action text,p_enabled boolean) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();
 if p_enabled is null or p_target is null or p_target=auth.uid() or p_action is null or p_action not in ('connect','save','block') then raise exception 'Invalid relationship action';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(auth.uid()::text,p_target::text)||':'||greatest(auth.uid()::text,p_target::text),20));
 if not exists(select 1 from public.profiles where id=p_target) then raise exception 'Profile unavailable';end if;
 if p_action='block' then
  if p_enabled then
   insert into public.blocks(blocker_id,blocked_id) values(auth.uid(),p_target) on conflict do nothing;
   delete from public.member_connections where (user_id=auth.uid() and profile_id=p_target) or (user_id=p_target and profile_id=auth.uid());
   delete from public.favourites where (user_id=auth.uid() and profile_id=p_target) or (user_id=p_target and profile_id=auth.uid());
  else delete from public.blocks where blocker_id=auth.uid() and blocked_id=p_target;end if;
 else
  if p_enabled and not public.discovery_visible(p_target) then raise exception 'Profile unavailable or blocked';end if;
  if p_action='connect' then
   if p_enabled then insert into public.member_connections(user_id,profile_id) values(auth.uid(),p_target) on conflict do nothing;else delete from public.member_connections where user_id=auth.uid() and profile_id=p_target;end if;
  else
   if p_enabled then insert into public.favourites(user_id,profile_id) values(auth.uid(),p_target) on conflict do nothing;else delete from public.favourites where user_id=auth.uid() and profile_id=p_target;end if;
  end if;
 end if;
 -- Intentionally no balance, XP, mission or reward writes.
end$$;
drop policy "own reports insert" on public.reports;
create policy "own reports insert" on public.reports for insert to authenticated with check(reporter_id=auth.uid() and profile_id<>auth.uid() and status='open' and length(trim(reason)) between 8 and 500 and public.discovery_visible(profile_id));
revoke insert on public.reports from public,anon,authenticated;grant insert(reporter_id,profile_id,reason) on public.reports to authenticated;

alter table public.dc_products add column promotion_kind text check(promotion_kind in ('spotlight','visibility','featured','social','badge')),add column duration_hours int check(duration_hours between 1 and 8760);
update public.dc_products p set promotion_kind=v.kind,duration_hours=v.hours,cost_dc=coalesce(p.cost_dc,v.cost),is_active=case when p.cost_dc is null then true else p.is_active end,description=v.description from(values
 ('profile_spotlight','spotlight',24,500,'A clearly labelled paid Spotlight placement in filtered Explore results for 24 hours.'),
 ('profile_visibility_boost','visibility',168,800,'A labelled paid visibility placement in Explore for 7 days. Organic ordering stays separate.'),
 ('featured_profile','featured',24,1000,'A labelled paid Featured Profile placement for 24 hours.'),
 ('social_media_promotion','social',168,1500,'A reviewed 7-day in-app social promotion placement with your permitted public social links. No off-platform delivery is implied.'),
 ('premium_profile_badge','badge',720,400,'A paid cosmetic Premium badge for 30 days. This is not identity or social-account verification.')
) v(slug,kind,hours,cost,description) where p.slug=v.slug;
create table public.promotion_campaigns(id uuid primary key references public.dc_orders(id),user_id uuid not null,product_id uuid not null references public.dc_products(id),title text not null,kind text not null check(kind in ('spotlight','visibility','featured','social','badge')),description text not null,cost_dc numeric(20,2) not null check(cost_dc>0),duration_hours int not null check(duration_hours between 1 and 8760),status text not null default 'pending' check(status in ('pending','active','expired','paused','rejected')),submission text not null,created_at timestamptz not null default now(),starts_at timestamptz,ends_at timestamptz,reviewed_at timestamptz,review_note text,refunded_at timestamptz,check((starts_at is null and ends_at is null) or (starts_at is not null and ends_at>starts_at)));
create index promotion_window on public.promotion_campaigns(user_id,status,ends_at);
create table public.promotion_events(campaign_id uuid not null references public.promotion_campaigns(id),viewer_id uuid not null,observed_on date not null default (now() at time zone 'UTC')::date,kind text not null check(kind in ('profile_open','social_open')),platform text not null default '',created_at timestamptz not null default clock_timestamp(),primary key(campaign_id,viewer_id,observed_on,kind,platform));
alter table public.promotion_campaigns enable row level security;alter table public.promotion_events enable row level security;
create policy "own or staff campaigns" on public.promotion_campaigns for select to authenticated using(user_id=auth.uid() or public.reward_finance_access());
revoke all on public.promotion_campaigns,public.promotion_events from public,anon,authenticated,service_role;grant select on public.promotion_campaigns to authenticated;
create trigger immutable_events before update or delete on public.promotion_events for each row execute function public.reward_history_immutable();
create trigger immutable_events_truncate before truncate on public.promotion_events for each statement execute function public.reward_history_immutable();
create function public.promotion_status(p_campaign public.promotion_campaigns) returns text language sql stable as $$select case when p_campaign.status in ('active','paused') and p_campaign.ends_at<=now() then 'expired' else p_campaign.status end$$;
alter function public.dc_spend(uuid,uuid,text) rename to dc_spend_before_promotions;
revoke all on function public.dc_spend_before_promotions(uuid,uuid,text) from public,anon,authenticated,service_role;
create function public.buy_promotion(p_product uuid,p_request uuid,p_details text,p_expected_cost numeric,p_expected_hours int) returns uuid language plpgsql security definer set search_path=public as $$declare product public.dc_products;prior public.promotion_campaigns;identifier uuid;begin
 perform public.require_active_account();if p_request is null or p_details is null or length(trim(p_details)) not between 8 and 1000 then raise exception 'Provide a valid promotion submission';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,16));
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into prior from public.promotion_campaigns where id=p_request;
 if found then if prior.user_id<>auth.uid() or prior.product_id<>p_product or prior.submission<>trim(p_details) then raise exception 'Request reference already used';end if;return prior.id;end if;
 if not public.reward_account_verified(auth.uid()) or not public.launch_profile_complete(auth.uid()) or not public.discovery_visible(auth.uid()) then raise exception 'Publish a verified eligible profile before buying a promotion';end if;
 select * into product from public.dc_products where id=p_product and is_active and promotion_kind is not null for share;
 if not found or product.duration_hours is null then raise exception 'Promotion package unavailable';end if;
 if p_expected_cost is distinct from product.cost_dc or p_expected_hours is distinct from product.duration_hours then raise exception 'Package changed. Refresh before confirming a new purchase';end if;
 if exists(select 1 from public.promotion_campaigns where user_id=auth.uid() and kind=product.promotion_kind and public.promotion_status(promotion_campaigns) in ('pending','active','paused')) then raise exception 'A campaign of this kind is already pending or running';end if;
 -- The locked wallet update and request UUID in the existing ledger implementation prevent overspending.
 identifier:=public.dc_spend_before_promotions(p_product,p_request,p_details);
 insert into public.promotion_campaigns(id,user_id,product_id,title,kind,description,cost_dc,duration_hours,submission) values(identifier,auth.uid(),product.id,product.title,product.promotion_kind,product.description,product.cost_dc,product.duration_hours,trim(p_details));
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'promotion_submitted',identifier::text,jsonb_build_object('cost_dc',product.cost_dc,'duration_hours',product.duration_hours));return identifier;
end$$;
-- Serializes two different same-kind requests as well as different products debiting one wallet.
create unique index one_unstarted_promotion on public.promotion_campaigns(user_id,kind) where status='pending';
create function public.dc_spend(p_product uuid,p_request uuid,p_details text) returns uuid language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from public.dc_products where id=p_product and promotion_kind is not null) then raise exception 'Use Boost Center purchase confirmation';end if;
 return public.dc_spend_before_promotions(p_product,p_request,p_details);
end$$;
alter function public.admin_dc_review_order(uuid,boolean,text) rename to admin_dc_review_order_before_promotions;
revoke all on function public.admin_dc_review_order_before_promotions(uuid,boolean,text) from public,anon,authenticated,service_role;
create function public.admin_dc_review_order(p_order uuid,p_complete boolean,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from public.promotion_campaigns where id=p_order) then raise exception 'Use the promotion campaign review controls';end if;
 perform public.admin_dc_review_order_before_promotions(p_order,p_complete,p_reason);
end$$;
create function public.admin_review_promotion(p_campaign uuid,p_action text,p_reason text) returns void language plpgsql security definer set search_path=public as $$declare item public.promotion_campaigns;start_time timestamptz;begin
 perform public.require_active_account();if not public.mission_staff_access() then raise exception 'Permission denied';end if;
 if p_action is null or p_action not in ('approve','reject','pause','resume') or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Review action and reason required';end if;
 select * into item from public.promotion_campaigns where id=p_campaign for update;
 if not found then raise exception 'Campaign unavailable';end if;
 if item.user_id=auth.uid() then raise exception 'Another administrator must review your campaign';end if;
 if (p_action='reject' and item.status='rejected') or (p_action in ('approve','resume') and public.promotion_status(item)='active') or (p_action='pause' and public.promotion_status(item)='paused') then return;end if;
 if public.promotion_status(item)='expired' then raise exception 'Campaign expired';end if;
 if p_action='approve' then
  if item.status<>'pending' or not public.discovery_visible(item.user_id) or not public.reward_account_verified(item.user_id) then raise exception 'Only an eligible pending campaign can start';end if;
  start_time:=clock_timestamp();
  update public.promotion_campaigns set status='active',starts_at=start_time,ends_at=start_time+make_interval(hours=>item.duration_hours),reviewed_at=clock_timestamp(),review_note=trim(p_reason) where id=item.id;
  perform public.admin_dc_review_order_before_promotions(item.id,true,p_reason);
 elsif p_action='reject' then
  if item.status not in ('pending','active','paused') then raise exception 'Campaign already reviewed';end if;
  if item.status='pending' then perform public.admin_dc_review_order_before_promotions(item.id,false,p_reason);
  else
   insert into public.points_balance(user_id,balance) values(item.user_id,item.cost_dc) on conflict(user_id) do update set balance=public.points_balance.balance+item.cost_dc;
   insert into public.points_ledger(user_id,points,reason,ref_key) values(item.user_id,item.cost_dc,'Promotion rejected: '||item.title,'dc-refund:'||item.id);
   update public.dc_orders set status='refunded',fulfillment_note=trim(p_reason),reviewed_at=now() where id=item.id;
  end if;
  update public.promotion_campaigns set status='rejected',refunded_at=clock_timestamp(),reviewed_at=clock_timestamp(),review_note=trim(p_reason) where id=item.id;
 else
  if (p_action='pause' and item.status<>'active') or (p_action='resume' and item.status<>'paused') then raise exception 'Invalid campaign transition';end if;
  if p_action='resume' and (not public.discovery_visible(item.user_id) or not public.reward_account_verified(item.user_id)) then raise exception 'Profile is not eligible for promotion';end if;
  update public.promotion_campaigns set status=case when p_action='pause' then 'paused' else 'active' end,review_note=trim(p_reason) where id=item.id;
 end if;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'promotion_'||p_action,item.id::text,jsonb_build_object('reason',trim(p_reason),'before',to_jsonb(item),'full_dc_refund',p_action='reject'));
end$$;
create function public.admin_save_promotion_package(p_product uuid,p_cost numeric,p_hours int,p_active boolean,p_description text,p_reason text) returns void language plpgsql security definer set search_path=public as $$declare prior public.dc_products;begin
 perform public.require_active_account();if not public.mission_staff_access() then raise exception 'Permission denied';end if;
 if p_cost is null or p_cost<>round(p_cost,2) or p_hours is null or p_active is null or p_description is null or length(trim(p_description)) not between 8 and 1000 or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Valid price, duration, description and reason required';end if;
 select * into prior from public.dc_products where id=p_product and promotion_kind is not null for update;if not found then raise exception 'Promotion package unavailable';end if;
 update public.dc_products set cost_dc=p_cost,duration_hours=p_hours,is_active=p_active,description=trim(p_description) where id=p_product;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'promotion_package_saved',p_product::text,jsonb_build_object('before',to_jsonb(prior),'cost_dc',p_cost,'hours',p_hours,'active',p_active,'description',p_description,'reason',trim(p_reason)));
end$$;
create function public.my_promotion_campaigns(p_status text default '',p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare rows jsonb;total bigint;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_status is null or p_status not in ('','pending','active','expired','paused','rejected') or p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid campaign filter';end if;
 select count(*) into total from public.promotion_campaigns c where user_id=auth.uid() and (p_status='' or public.promotion_status(c)=p_status);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select c.*,public.promotion_status(c) effective_status,(select count(*) from public.promotion_events e where e.campaign_id=c.id and e.kind='profile_open') recorded_profile_opens,(select count(*) from public.promotion_events e where e.campaign_id=c.id and e.kind='social_open') recorded_social_opens from public.promotion_campaigns c where c.user_id=auth.uid() and (p_status='' or public.promotion_status(c)=p_status) order by c.created_at desc,c.id desc limit 10 offset p_page*10) r;
 return jsonb_build_object('rows',rows,'total',total,'balance',coalesce((select balance from public.points_balance where user_id=auth.uid()),0));
end$$;
create function public.discovery_profile_item(p_user uuid,p_managed boolean default false) returns jsonb language plpgsql stable security definer set search_path=public as $$declare item jsonb;begin
 if p_managed then
  select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'avatar_url',p.avatar_url,'country',p.country,'interests',p.interests,'created_at',p.created_at,'managed',true,'is_sponsored',false,'social_links',coalesce((select jsonb_agg(l) from jsonb_array_elements(p.social_links) l where l->>'is_public'='true' and l->>'platform'=any((select enabled_platforms from public.site_settings where id)::text[])),'[]')) into item from public.managed_profiles p where p.id=p_user and p.is_public;
 else
  select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'avatar_url',p.avatar_url,'country',p.country,'location',p.location,'categories',p.categories,'interests',p.interests,'created_at',p.created_at,'creator_xp',p.creator_xp,'creator_level',p.creator_level,'managed',false,'is_sponsored',false,
  'paid_placements',coalesce((select jsonb_agg(jsonb_build_object('promotion_id',c.id,'promotion_kind',c.kind,'promotion_copy',c.submission)) from public.promotion_campaigns c where c.user_id=p.id and c.kind<>'badge' and public.promotion_status(c)='active' and c.starts_at<=now() and c.ends_at>now() and public.discovery_visible(p.id) and public.reward_account_verified(p.id)),'[]'),
  'is_connected',exists(select 1 from public.member_connections where user_id=auth.uid() and profile_id=p.id),'is_saved',exists(select 1 from public.favourites where user_id=auth.uid() and profile_id=p.id),
  'paid_premium_badge',exists(select 1 from public.promotion_campaigns c where c.user_id=p.id and c.kind='badge' and public.promotion_status(c)='active' and c.starts_at<=now() and c.ends_at>now()),
  'social_links',coalesce((select jsonb_agg(jsonb_build_object('platform',l.platform,'url',l.url,'is_public',true)) from public.social_links l where l.profile_id=p.id and l.is_public and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])),'[]')) into item from public.profiles p where p.id=p_user and (public.discovery_visible(p.id) or p.id=auth.uid());
 end if;return item;
end$$;
create function public.discovery_profile(p_username text,p_managed boolean default false) returns jsonb language plpgsql stable security definer set search_path=public as $$declare identifier uuid;begin
 if p_managed then select id into identifier from public.managed_profiles where username=p_username and is_public;else select id into identifier from public.profiles where username=p_username;end if;
 return public.discovery_profile_item(identifier,p_managed);
end$$;
create or replace function public.public_directory(p_search text default '',p_platform text default '',p_country text default '',p_interest text default '',p_page int default 0) returns jsonb language plpgsql stable security definer set search_path=public as $$declare result jsonb;begin
 with candidates as(
  select p.id,p.created_at,public.discovery_profile_item(p.id,false) item from public.profiles p where public.discovery_visible(p.id)
  union all select p.id,p.created_at,public.discovery_profile_item(p.id,true) from public.managed_profiles p where p.is_public
 ),matching as(select * from candidates where (coalesce(p_search,'')='' or concat_ws(' ',item->>'username',item->>'display_name',item->>'bio') ilike '%'||left(p_search,200)||'%') and (coalesce(p_country,'')='' or item->>'country' ilike left(p_country,80)) and (coalesce(p_interest,'')='' or exists(select 1 from jsonb_array_elements_text(item->'interests') i where i ilike '%'||left(p_interest,80)||'%')) and (coalesce(p_platform,'')='' or exists(select 1 from jsonb_array_elements(item->'social_links') l where l->>'platform'=p_platform))),
 paid as(select m.item||jsonb_build_object('promotion_id',c.id,'promotion_kind',c.kind,'promotion_copy',c.submission,'is_sponsored',true) item,c.id from matching m join public.promotion_campaigns c on c.user_id=m.id where m.item->>'managed'='false' and c.kind<>'badge' and public.promotion_status(c)='active' and c.starts_at<=now() and c.ends_at>now() and public.reward_account_verified(c.user_id))
 select jsonb_build_object('total',(select count(*) from matching),'rows',(select coalesce(jsonb_agg(item),'[]') from(select item from matching order by created_at desc,id desc limit 12 offset greatest(0,least(coalesce(p_page,0),100000))*12)r),'paid_total',(select count(*) from paid),'paid_rows',(select coalesce(jsonb_agg(item),'[]') from(select item from paid order by md5(id::text||(now() at time zone 'UTC')::date::text) limit 3)r)) into result;return result;
end$$;
create function public.discovery_connections(p_kind text default 'connected',p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare rows jsonb;total bigint;begin
 perform public.require_active_account();if p_kind is null or p_kind not in ('connected','saved','blocked') or p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid connection filter';end if;
 with entries as(select profile_id,created_at from public.member_connections where user_id=auth.uid() and p_kind='connected' union all select profile_id,created_at from public.favourites where user_id=auth.uid() and p_kind='saved' union all select blocked_id,created_at from public.blocks where blocker_id=auth.uid() and p_kind='blocked'),matching as(select * from entries where p_kind='blocked' or public.discovery_visible(profile_id))
 select (select count(*) from matching),(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from(select m.profile_id,m.created_at,case when p_kind='blocked' then null else public.discovery_profile_item(m.profile_id,false) end profile from matching m order by created_at desc,profile_id limit 12 offset p_page*12)r) into total,rows;
 return jsonb_build_object('rows',rows,'total',total);
end$$;
create or replace function public.record_profile_view(p_profile uuid) returns void language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null or auth.uid()=p_profile or not public.discovery_visible(p_profile) then return;end if;perform public.require_active_account();insert into public.profile_views(profile_id,viewer_id,viewed_on) values(p_profile,auth.uid(),(now() at time zone 'UTC')::date) on conflict do nothing;
end$$;
create function public.record_promotion_event(p_campaign uuid,p_profile uuid,p_kind text,p_platform text default '') returns boolean language plpgsql security definer set search_path=public as $$declare item public.promotion_campaigns;begin
 perform public.require_active_account();select * into item from public.promotion_campaigns where id=p_campaign;
 if not found or item.user_id=auth.uid() or item.user_id is distinct from p_profile or public.promotion_status(item)<>'active' or item.starts_at is null or item.starts_at>now() or item.ends_at<=now() or not public.discovery_visible(item.user_id) then return false;end if;
 if p_kind is null or p_kind not in ('profile_open','social_open') or p_platform is null then raise exception 'Invalid event';end if;
 if p_kind='social_open' and not exists(select 1 from public.social_links l where l.profile_id=item.user_id and l.platform=p_platform and l.is_public and l.platform=any((select enabled_platforms from public.site_settings where id)::text[])) then return false;end if;
 insert into public.promotion_events(campaign_id,viewer_id,kind,platform) values(item.id,auth.uid(),p_kind,case when p_kind='profile_open' then '' else p_platform end) on conflict do nothing;return true;
end$$;
alter function public.admin_list(text,text,text,int) rename to admin_list_before_promotions;
revoke all on function public.admin_list_before_promotions(text,text,text,int) from public,anon,authenticated,service_role;
create function public.admin_list(p_resource text,p_search text default '',p_status text default '',p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare rows jsonb;total bigint;result jsonb;begin
 if p_resource<>'promotion_campaigns' then
  result:=public.admin_list_before_promotions(p_resource,p_search,p_status,p_page);
  if p_resource='dc_orders' then select coalesce(jsonb_agg(r||jsonb_build_object('is_promotion',exists(select 1 from public.promotion_campaigns where id=(r->>'id')::uuid))),'[]') into rows from jsonb_array_elements(result->'rows')r;return jsonb_set(result,'{rows}',rows);end if;return result;
 end if;
 perform public.require_active_account();if not public.reward_finance_access() then raise exception 'Permission denied';end if;
 select count(*) into total from public.promotion_campaigns c where title ilike '%'||left(coalesce(p_search,''),120)||'%' and (coalesce(p_status,'')='' or public.promotion_status(c)=p_status);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select c.id,c.user_id,(select username from public.profiles where id=c.user_id) creator_username,c.title,c.kind,c.cost_dc,c.duration_hours,public.promotion_status(c) status,c.submission,c.starts_at,c.ends_at,c.created_at,c.review_note,c.refunded_at from public.promotion_campaigns c where title ilike '%'||left(coalesce(p_search,''),120)||'%' and (coalesce(p_status,'')='' or public.promotion_status(c)=p_status) order by created_at desc,id desc limit 25 offset greatest(0,least(coalesce(p_page,0),100000))*25)r;
 return jsonb_build_object('rows',rows,'total',total);
end$$;
revoke all on function public.promotion_status(public.promotion_campaigns),public.discovery_relationship(uuid,text,boolean),public.buy_promotion(uuid,uuid,text,numeric,int),public.dc_spend(uuid,uuid,text),public.admin_dc_review_order(uuid,boolean,text),public.admin_review_promotion(uuid,text,text),public.admin_save_promotion_package(uuid,numeric,int,boolean,text,text),public.my_promotion_campaigns(text,int),public.discovery_profile_item(uuid,boolean),public.discovery_profile(text,boolean),public.discovery_connections(text,int),public.record_promotion_event(uuid,uuid,text,text),public.admin_list(text,text,text,int) from public,anon,authenticated,service_role;
grant execute on function public.discovery_profile(text,boolean) to anon,authenticated;
grant execute on function public.discovery_relationship(uuid,text,boolean),public.buy_promotion(uuid,uuid,text,numeric,int),public.dc_spend(uuid,uuid,text),public.admin_dc_review_order(uuid,boolean,text),public.admin_review_promotion(uuid,text,text),public.admin_save_promotion_package(uuid,numeric,int,boolean,text,text),public.my_promotion_campaigns(text,int),public.discovery_connections(text,int),public.record_promotion_event(uuid,uuid,text,text),public.admin_list(text,text,text,int) to authenticated;
commit;
