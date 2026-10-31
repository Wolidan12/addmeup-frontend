-- Additive private inbox + opt-in Web Push. No secrets or automatic deployment.
begin;
alter table public.notifications add column category text not null default 'account' check(category in ('daily','missions','rewards','connections','boosts','promotions','deposits','account','features','app_updates','events','security')),add column url text not null default '/notifications' check(url in ('/notifications','/missions','/wallet','/discover','/connections','/boosts','/settings','/release-notes')),add column event_key text,add column actor_id uuid;
create unique index notification_event_once on public.notifications(user_id,event_key) where event_key is not null;
create index notification_inbox_filter on public.notifications(user_id,is_read,category,created_at desc);
create table public.push_config(id boolean primary key default true check(id),public_key text);
insert into public.push_config(id) values(true);
alter table public.push_config enable row level security;
create policy "push public key" on public.push_config for select to authenticated using(true);
revoke all on public.push_config from public,anon,authenticated;grant select on public.push_config to authenticated;
create table public.notification_preferences(user_id uuid primary key references auth.users(id) on delete cascade,push_enabled boolean not null default false,daily_enabled boolean not null default false,reminder_time time not null default '09:00',timezone text not null default 'Africa/Lagos',quiet_start time,quiet_end time,categories jsonb not null default '{}',next_reminder_at timestamptz not null default now(),updated_at timestamptz not null default now(),check((quiet_start is null)=(quiet_end is null)));
create table public.push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,endpoint text unique not null,p256dh text not null,auth_key text not null,device_name text not null,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.push_deliveries(id uuid primary key default gen_random_uuid(),notification_id uuid not null references public.notifications(id) on delete cascade,subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,user_id uuid not null,status text not null default 'pending' check(status in ('pending','leased','accepted','failed','skipped','expired')),attempts int not null default 0,available_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours',lease_token uuid,leased_until timestamptz,last_http_status int,last_attempt_at timestamptz,created_at timestamptz not null default now(),unique(notification_id,subscription_id));
create index push_pending on public.push_deliveries(status,available_at);
create table public.push_attempts(id uuid primary key default gen_random_uuid(),delivery_id uuid not null references public.push_deliveries(id),attempt int not null,outcome text not null,http_status int,created_at timestamptz not null default clock_timestamp(),unique(delivery_id,attempt));
create trigger immutable_push_attempts before update or delete on public.push_attempts for each row execute function public.reward_history_immutable();
create trigger immutable_push_attempts_truncate before truncate on public.push_attempts for each statement execute function public.reward_history_immutable();
create table public.notification_templates(key text primary key check(key~'^[a-z_]{3,50}$'),title text not null check(length(title) between 3 and 100),body text not null check(length(body) between 8 and 1000),category text not null check(category in ('daily','missions','rewards','features','events','account','security')),url text not null check(url in ('/notifications','/missions','/wallet','/discover','/boosts','/settings')),updated_at timestamptz not null default now(),check(key<>'daily_reminder' or category='daily'));
insert into public.notification_templates values('daily_reminder','Your daily Danqel moment','Visit Danqel, complete your daily missions, check your Growth Wallet, explore new profiles and discover active campaigns.','daily','/missions',now());
create table public.app_releases(commit text primary key check(commit~'^[a-f0-9]{40}$'),version text not null check(length(version) between 1 and 60),notes text not null check(length(notes) between 8 and 3000),built_at timestamptz not null,confirmed_at timestamptz not null default clock_timestamp(),confirmed_by uuid not null);
create table public.notification_announcements(id uuid primary key,created_by uuid not null,title text not null check(length(title) between 3 and 100),body text not null check(length(body) between 8 and 1000),category text not null check(category in ('missions','rewards','features','events','account','security','app_updates')),url text not null check(url in ('/notifications','/missions','/wallet','/discover','/boosts','/settings','/release-notes')),audience text not null check(audience in ('all','verified','active_campaigns','selected')),selected_users uuid[] not null default '{}',scheduled_at timestamptz not null,status text not null default 'scheduled' check(status in ('scheduled','sending','sent','cancelled')),cursor_id uuid,recipient_count bigint not null default 0,release_commit text unique references public.app_releases(commit),created_at timestamptz not null default now(),check(category<>'app_updates' or release_commit is not null));
do $$declare t text;begin foreach t in array array['notification_preferences','push_subscriptions','push_deliveries','push_attempts','notification_templates','notification_announcements','app_releases'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);end loop;end$$;
create policy "own notification preferences" on public.notification_preferences for select to authenticated using(user_id=auth.uid());
create policy "own devices" on public.push_subscriptions for select to authenticated using(user_id=auth.uid());
grant select on public.notification_preferences to authenticated;
-- Endpoints and encryption keys are never exposed by a raw client SELECT.
grant select(id,user_id,device_name,active,created_at,updated_at) on public.push_subscriptions to authenticated;
create policy "published release notes" on public.app_releases for select using(true);
grant select on public.app_releases to anon,authenticated;

create function public.notification_next_time(p_timezone text,p_time time,p_after timestamptz) returns timestamptz language plpgsql stable set search_path=public as $$declare local_time timestamp;candidate timestamptz;begin
 local_time:=p_after at time zone p_timezone;candidate:=(local_time::date+p_time) at time zone p_timezone;
 if candidate<=p_after then candidate:=((local_time::date+1)+p_time) at time zone p_timezone;end if;return candidate;
end$$;
create function public.notification_preferences_get() returns jsonb language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();insert into public.notification_preferences(user_id) values(auth.uid()) on conflict do nothing;
 return(select to_jsonb(p) from public.notification_preferences p where user_id=auth.uid());
end$$;
create function public.notification_preferences_save(p_push boolean,p_daily boolean,p_time time,p_timezone text,p_quiet_start time,p_quiet_end time,p_categories jsonb) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();
 if p_push is null or p_daily is null or p_time is null or p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) or (p_quiet_start is null)<>(p_quiet_end is null) or jsonb_typeof(p_categories) is distinct from 'object' then raise exception 'Invalid notification preferences';end if;
 if exists(select 1 from jsonb_each(p_categories) e where e.key not in ('daily','missions','rewards','connections','boosts','promotions','deposits','account','features','app_updates','events','security') or jsonb_typeof(e.value)<>'boolean') then raise exception 'Invalid notification category';end if;
 insert into public.notification_preferences(user_id,push_enabled,daily_enabled,reminder_time,timezone,quiet_start,quiet_end,categories,next_reminder_at) values(auth.uid(),p_push,p_daily,p_time,p_timezone,p_quiet_start,p_quiet_end,p_categories,public.notification_next_time(p_timezone,p_time,now()))
 on conflict(user_id) do update set push_enabled=p_push,daily_enabled=p_daily,reminder_time=p_time,timezone=p_timezone,quiet_start=p_quiet_start,quiet_end=p_quiet_end,categories=p_categories,next_reminder_at=public.notification_next_time(p_timezone,p_time,now()),updated_at=now();
end$$;
create function public.push_subscribe(p_endpoint text,p_p256dh text,p_auth text,p_device text) returns uuid language plpgsql security definer set search_path=public as $$declare identifier uuid;begin
 perform public.require_active_account();if not public.reward_account_verified(auth.uid()) then raise exception 'Verify your account before enabling push';end if;
 if not exists(select 1 from public.push_config where id and public_key is not null) then raise exception 'Device notifications are not configured';end if;
 if p_endpoint is null or length(p_endpoint)>2048 or p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-zA-Z0-9.-]+\.notify\.windows\.com)/[^[:space:]]+$' or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}=?$' or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}={0,2}$' or p_device is null or length(trim(p_device)) not between 1 and 80 then raise exception 'Invalid push subscription';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,22004));
 perform pg_advisory_xact_lock(hashtextextended(p_endpoint,22));
 if exists(select 1 from public.push_subscriptions where endpoint=p_endpoint and user_id<>auth.uid()) then raise exception 'Unsubscribe the previous account on this device first';end if;
 if(select count(*) from public.push_subscriptions where user_id=auth.uid() and active)>=10 and not exists(select 1 from public.push_subscriptions where endpoint=p_endpoint and user_id=auth.uid()) then raise exception 'Device subscription limit reached';end if;
 insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_key,device_name) values(auth.uid(),p_endpoint,p_p256dh,p_auth,trim(p_device)) on conflict(endpoint) do update set p256dh=p_p256dh,auth_key=p_auth,device_name=trim(p_device),active=true,updated_at=now() returning id into identifier;return identifier;
end$$;
create function public.push_unsubscribe(p_id uuid default null) returns void language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 update public.push_subscriptions set active=false,updated_at=now() where user_id=auth.uid() and(p_id is null or id=p_id);
 update public.push_deliveries set status='skipped',lease_token=null where user_id=auth.uid() and status in ('pending','leased') and (p_id is null or subscription_id=p_id);
end$$;
create function public.notification_inbox(p_read text default '',p_category text default '',p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare rows jsonb;total bigint;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_read is null or p_read not in ('','read','unread') or p_category is null or p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid inbox filter';end if;
 with matching as(select id,title,body,category,url,is_read,created_at from public.notifications where user_id=auth.uid() and (p_read='' or is_read=(p_read='read')) and(p_category='' or category=p_category)) select (select count(*) from matching),(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from(select * from matching order by created_at desc,id desc limit 10 offset p_page*10)r) into total,rows;
 return jsonb_build_object('rows',rows,'total',total,'unread',(select count(*) from public.notifications where user_id=auth.uid() and not is_read));
end$$;
create function public.notifications_mark_read(p_id uuid default null) returns void language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null then raise exception 'Authentication required';end if;update public.notifications set is_read=true where user_id=auth.uid() and not is_read and(p_id is null or id=p_id);
end$$;

create function public.notification_queue() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into public.push_deliveries(notification_id,subscription_id,user_id,expires_at)
 select new.id,s.id,new.user_id,case when new.event_key like 'daily:%' then now()+interval '6 hours' else now()+interval '24 hours' end from public.push_subscriptions s join public.notification_preferences p on p.user_id=s.user_id where s.user_id=new.user_id and s.active and p.push_enabled and coalesce((p.categories->>new.category)::boolean,true) on conflict do nothing;return new;
end$$;
create trigger notification_push_outbox after insert on public.notifications for each row execute function public.notification_queue();
-- Existing trusted notification sources get categories; no history is replayed.
create function public.notification_classify() returns trigger language plpgsql set search_path=public as $$begin
 if new.category='account' then
  if new.title ilike '%payment%' or new.title ilike '%deposit%' then new.category:='deposits';new.url:='/wallet';
  elsif new.title ilike '%mission%' or new.title ilike '%reward%' or new.title ilike '%launch%' then new.category:='rewards';new.url:='/missions';end if;
 end if;return new;
end$$;
create trigger notification_classify before insert on public.notifications for each row execute function public.notification_classify();
create function public.notification_connection() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into public.notifications(user_id,title,body,category,url,event_key,actor_id) values(new.profile_id,'A new connection','A member connected with your public profile. Connections are always free.','connections','/connections','connection:'||new.user_id||':'||(now() at time zone 'UTC')::date,new.user_id) on conflict do nothing;return new;
end$$;
create trigger notify_free_connection after insert on public.member_connections for each row execute function public.notification_connection();
create function public.notification_promotion() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.status is distinct from old.status then insert into public.notifications(user_id,title,body,category,url,event_key) values(new.user_id,'Promotion update: '||new.status,'Your campaign status changed. Open Boost Center for the review, dates and any recorded DC refund.','promotions','/boosts','promotion:'||new.id||':'||new.status||':'||new.reviewed_at::text) on conflict do nothing;end if;return new;
end$$;
create trigger notify_promotion_update after update of status on public.promotion_campaigns for each row execute function public.notification_promotion();
create function public.notification_boost() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into public.notifications(user_id,title,body,category,url,event_key) values(new.user_id,'Reward multiplier activated','Your capped reward multiplier is recorded. Check its conditions and end date in the app.','boosts','/missions','reward-boost:'||new.id) on conflict do nothing;return new;
end$$;
create trigger notify_reward_boost after insert on public.user_boosts for each row execute function public.notification_boost();
-- Security events available to this application: trusted restrictions and role changes.
create function public.notification_security() returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_table_name='user_roles' and ((tg_op='INSERT' and to_jsonb(new)->>'role'='user') or(tg_op='UPDATE' and to_jsonb(new)->>'role' is not distinct from to_jsonb(old)->>'role')) then return new;end if;
 insert into public.notifications(user_id,title,body,category,url) values(new.user_id,'Important account security update','Your account access settings changed. Open the app or contact support if this was unexpected.','security','/notifications');return new;
end$$;
create trigger notify_account_restriction after insert or update on public.account_restrictions for each row execute function public.notification_security();
create trigger notify_role_change after insert or update on public.user_roles for each row execute function public.notification_security();

create function public.notification_auth_security() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.email is distinct from old.email or (to_jsonb(new)->>'encrypted_password') is distinct from (to_jsonb(old)->>'encrypted_password') then
  insert into public.notifications(user_id,title,body,category,url) values(new.id,'Account credentials changed','An account email or password change was recorded. If this was not you, secure your account and contact support.','security','/settings');
 end if;return new;
end$$;
create trigger notify_auth_credentials after update on auth.users for each row execute function public.notification_auth_security();
create function public.admin_notification_save(p_id uuid,p_title text,p_body text,p_category text,p_url text,p_audience text,p_users uuid[],p_scheduled timestamptz,p_reason text) returns uuid language plpgsql security definer set search_path=public as $$declare prior public.notification_announcements;begin
 perform public.require_active_account();if not public.mission_staff_access() then raise exception 'Permission denied';end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 or p_id is null or p_category='app_updates' or p_scheduled is null or p_scheduled<now()-interval '5 minutes' or coalesce(cardinality(p_users),0)>100 or(p_audience='selected' and coalesce(cardinality(p_users),0)=0) then raise exception 'Valid scheduled announcement and reason required';end if;
 select * into prior from public.notification_announcements where id=p_id for update;
 if found then if prior.created_by=auth.uid() and prior.title=p_title and prior.body=p_body and prior.category=p_category and prior.audience=p_audience and prior.selected_users=coalesce(p_users,'{}') and prior.scheduled_at=p_scheduled and prior.url=p_url then return prior.id;end if;raise exception 'Announcement reference already used';end if;
 insert into public.notification_announcements(id,created_by,title,body,category,url,audience,selected_users,scheduled_at) values(p_id,auth.uid(),p_title,p_body,p_category,p_url,p_audience,coalesce(p_users,'{}'),p_scheduled);
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'notification_scheduled',p_id::text,jsonb_build_object('reason',trim(p_reason),'audience',p_audience,'scheduled_at',p_scheduled));return p_id;
end$$;
create function public.admin_notification_cancel(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();if not public.mission_staff_access() then raise exception 'Permission denied';end if;
 if p_reason is null or length(trim(p_reason))<8 then raise exception 'Reason required';end if;
 update public.notification_announcements set status='cancelled' where id=p_id and status in ('scheduled','sending');
 update public.push_deliveries d set status='skipped',lease_token=null from public.notifications n where d.notification_id=n.id and n.event_key='announcement:'||p_id and d.status in ('pending','leased');
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'notification_cancelled',p_id::text,jsonb_build_object('reason',trim(p_reason)));
end$$;
create function public.admin_notification_template(p_key text,p_title text,p_body text,p_category text,p_url text,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();if not public.mission_staff_access() then raise exception 'Permission denied';end if;
 if p_reason is null or length(trim(p_reason))<8 then raise exception 'Reason required';end if;
 insert into public.notification_templates(key,title,body,category,url) values(p_key,p_title,p_body,p_category,p_url) on conflict(key) do update set title=p_title,body=p_body,category=p_category,url=p_url,updated_at=now();
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'notification_template_saved',p_key,jsonb_build_object('reason',trim(p_reason)));
end$$;
create function public.admin_notification_overview(p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();if not public.mission_staff_access() then raise exception 'Permission denied';end if;
 return jsonb_build_object('announcements',coalesce((select jsonb_agg(to_jsonb(r)) from(select * from public.notification_announcements order by created_at desc,id desc limit 20 offset greatest(0,least(p_page,100000))*20)r),'[]'),'total',(select count(*) from public.notification_announcements),'templates',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.notification_templates t),'delivery_stats',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*) n from public.push_deliveries group by status)x),'attempts',(select count(*) from public.push_attempts),'recent_attempts',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from(select a.delivery_id,a.attempt,a.outcome,a.http_status,a.created_at from public.push_attempts a order by created_at desc,id desc limit 20)r),'active_devices',(select count(*) from public.push_subscriptions where active));
end$$;

-- Scheduler RPCs below are service-role ONLY. Browser clients cannot tick, lease or acknowledge.
create function public.notification_tick() returns int language plpgsql security definer set search_path=public as $$
declare p public.notification_preferences;a public.notification_announcements;t public.notification_templates;person record;last_id uuid;n int;processed int:=0;begin
 if not pg_try_advisory_xact_lock(22001) then return 0;end if;
 insert into public.notifications(user_id,title,body,category,url,event_key)
 select c.user_id,'Promotion window ended','Your paid placement has expired. View the booked dates and campaign history in Boost Center.','boosts','/boosts','promotion-expired:'||c.id from public.promotion_campaigns c where c.status in ('active','paused') and c.ends_at<=now() and c.ends_at>now()-interval '24 hours' and not exists(select 1 from public.notifications n where n.user_id=c.user_id and n.event_key='promotion-expired:'||c.id) order by c.ends_at limit 200 on conflict do nothing;
 insert into public.notifications(user_id,title,body,category,url,event_key)
 select b.user_id,'Reward multiplier window ended','Your capped reward multiplier has ended. Your independently earned credits and XP remain in your account.','boosts','/missions','reward-boost-expired:'||b.id from public.user_boosts b where b.expires_at<=now() and b.expires_at>now()-interval '24 hours' and not exists(select 1 from public.notifications n where n.user_id=b.user_id and n.event_key='reward-boost-expired:'||b.id) order by b.expires_at limit 200 on conflict do nothing;
 select * into t from public.notification_templates where key='daily_reminder';
 for p in select * from public.notification_preferences where daily_enabled and next_reminder_at<=now() order by next_reminder_at limit 200 for update skip locked loop
  if now()-p.next_reminder_at<=interval '6 hours' and coalesce((p.categories->>t.category)::boolean,true) and not exists(select 1 from public.account_restrictions where user_id=p.user_id) then
   insert into public.notifications(user_id,title,body,category,url,event_key) values(p.user_id,t.title,t.body,t.category,t.url,'daily:'||(now() at time zone p.timezone)::date) on conflict do nothing;
  end if;
  update public.notification_preferences set next_reminder_at=public.notification_next_time(p.timezone,p.reminder_time,now()) where user_id=p.user_id;processed:=processed+1;
 end loop;
 for a in select * from public.notification_announcements where status in ('scheduled','sending') and scheduled_at<=now() order by scheduled_at,id limit 5 for update skip locked loop
  n:=0;last_id:=a.cursor_id;
  for person in select prof.id from public.profiles prof where (a.cursor_id is null or prof.id>a.cursor_id) and not exists(select 1 from public.account_restrictions where user_id=prof.id)
   and(a.audience='all' or(a.audience='verified' and public.reward_account_verified(prof.id)) or(a.audience='selected' and prof.id=any(a.selected_users)) or(a.audience='active_campaigns' and exists(select 1 from public.promotion_campaigns c where c.user_id=prof.id and public.promotion_status(c)='active')))
   order by prof.id limit 200 loop
   insert into public.notifications(user_id,title,body,category,url,event_key) values(person.id,a.title,a.body,a.category,a.url,'announcement:'||a.id) on conflict do nothing;
   last_id:=person.id;n:=n+1;
  end loop;
  update public.notification_announcements set status=case when n<200 then 'sent' else 'sending' end,cursor_id=last_id,recipient_count=recipient_count+n where id=a.id;processed:=processed+n;
 end loop;return processed;
end$$;
create function public.push_claim(p_limit int default 20) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.push_deliveries;p public.notification_preferences;n public.notifications;s public.push_subscriptions;local_now timestamp;next_at timestamptz;token uuid;result jsonb:='[]';claimed int:=0;begin
 perform pg_advisory_xact_lock(22002);
 for d in select * from public.push_deliveries where (status='pending' and available_at<=now()) or(status='leased' and leased_until<=now()) order by available_at,id limit 200 for update skip locked loop
  if d.status='leased' then insert into public.push_attempts(delivery_id,attempt,outcome) values(d.id,d.attempts,'lease_expired') on conflict do nothing;end if;
  if d.expires_at<=now() or d.attempts>=4 then update public.push_deliveries set status=case when d.expires_at<=now() then 'expired' else 'failed' end,lease_token=null where id=d.id;continue;end if;
  select * into p from public.notification_preferences where user_id=d.user_id;
  select * into n from public.notifications where id=d.notification_id;
  select * into s from public.push_subscriptions where id=d.subscription_id;
  if p.user_id is null or not p.push_enabled or not s.active or not coalesce((p.categories->>n.category)::boolean,true) or exists(select 1 from public.account_restrictions where user_id=d.user_id) or exists(select 1 from public.blocks where (blocker_id=d.user_id and blocked_id=n.actor_id) or(blocked_id=d.user_id and blocker_id=n.actor_id)) then update public.push_deliveries set status='skipped',lease_token=null where id=d.id;continue;end if;
  local_now:=now() at time zone p.timezone;
  if p.quiet_start is not null and p.quiet_start<>p.quiet_end and ((p.quiet_start<p.quiet_end and local_now::time>=p.quiet_start and local_now::time<p.quiet_end) or(p.quiet_start>p.quiet_end and(local_now::time>=p.quiet_start or local_now::time<p.quiet_end))) then
   next_at:=(local_now::date+p.quiet_end) at time zone p.timezone;if next_at<=now() then next_at:=((local_now::date+1)+p.quiet_end) at time zone p.timezone;end if;
   update public.push_deliveries set status='pending',available_at=next_at,lease_token=null where id=d.id;continue;
  end if;
  -- Five distinct notification messages per local day across every device; retries don't consume extra message quota.
  if not exists(select 1 from public.push_deliveries x where x.notification_id=n.id and x.status in ('accepted','leased')) and (select count(distinct notification_id) from public.push_deliveries x where x.user_id=d.user_id and x.status in ('accepted','leased') and(x.last_attempt_at at time zone p.timezone)::date=local_now::date)>=5 then
   update public.push_deliveries set status='pending',available_at=((local_now::date+1)+time '00:01') at time zone p.timezone,lease_token=null where id=d.id;continue;
  end if;
  token:=gen_random_uuid();update public.push_deliveries set status='leased',attempts=attempts+1,last_attempt_at=now(),lease_token=token,leased_until=now()+interval '5 minutes' where id=d.id;
  result:=result||jsonb_build_array(jsonb_build_object('id',d.id,'token',token,'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth_key),'payload',jsonb_build_object('id',n.id,'title',case when n.category in ('deposits','security','account') then 'Danqel account update' else n.title end,'body',case when n.category in ('deposits','security','account') then 'You have a private account update. Open your Danqel inbox for details.' else left(n.body,180) end,'url',n.url)));
  claimed:=claimed+1;if claimed>=greatest(1,least(coalesce(p_limit,20),20)) then exit;end if;
 end loop;return result;
end$$;
create function public.push_finish(p_id uuid,p_token uuid,p_outcome text,p_http_status int default null,p_retry_after int default 0) returns boolean language plpgsql security definer set search_path=public as $$declare d public.push_deliveries;begin
 select * into d from public.push_deliveries where id=p_id for update;
 if not found or d.status<>'leased' or d.lease_token is distinct from p_token then return false;end if;
 if p_outcome not in ('accepted','retry','gone','failed') or p_outcome is null then raise exception 'Invalid push result';end if;
 insert into public.push_attempts(delivery_id,attempt,outcome,http_status) values(d.id,d.attempts,p_outcome,p_http_status);
 update public.push_deliveries set status=case when p_outcome='accepted' then 'accepted' when p_outcome='retry' and d.attempts<4 then 'pending' else 'failed' end,last_http_status=p_http_status,lease_token=null,available_at=now()+make_interval(secs=>greatest(60,least(21600,coalesce(p_retry_after,0)),(power(2,d.attempts)*60)::int)) where id=d.id;
 if p_outcome='gone' then update public.push_subscriptions set active=false,updated_at=now() where id=d.subscription_id;update public.push_deliveries set status='skipped',lease_token=null where subscription_id=d.subscription_id and status in ('pending','leased');end if;
 return true;
end$$;
create function public.confirm_production_release(p_actor uuid,p_commit text,p_version text,p_notes text,p_built timestamptz,p_reason text) returns uuid language plpgsql security definer set search_path=public as $$declare identifier uuid;prior public.app_releases;begin
 if not public.reward_account_verified(p_actor) or not exists(select 1 from public.user_roles where user_id=p_actor and role in ('admin','super_admin')) or exists(select 1 from public.account_restrictions where user_id=p_actor) then raise exception 'Permission denied';end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Release reason required';end if;
 if p_built is null or p_built>now()+interval '5 minutes' then raise exception 'Invalid production build';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_commit,22003));
 select * into prior from public.app_releases where commit=p_commit;
 if found then if prior.version<>p_version or prior.notes<>p_notes then raise exception 'Release already announced with different notes';end if;return(select id from public.notification_announcements where release_commit=p_commit);end if;
 insert into public.app_releases(commit,version,notes,built_at,confirmed_by) values(p_commit,p_version,p_notes,p_built,p_actor);
 identifier:=gen_random_uuid();insert into public.notification_announcements(id,created_by,title,body,category,url,audience,scheduled_at,release_commit) values(identifier,p_actor,left('Danqel update · '||p_version,100),left(p_notes,1000),'app_updates','/release-notes','all',now(),p_commit);
 insert into public.audit_logs(actor_id,action,target,meta) values(p_actor,'production_release_announced',p_commit,jsonb_build_object('version',p_version,'built_at',p_built,'reason',trim(p_reason)));return identifier;
end$$;
-- Explicit least privilege, including helpers; PostgreSQL defaults grant PUBLIC EXECUTE.
do $$declare signature regprocedure;begin
 foreach signature in array array['public.notification_next_time(text,time,timestamptz)'::regprocedure,'public.notification_preferences_get()'::regprocedure,'public.notification_preferences_save(boolean,boolean,time,text,time,time,jsonb)'::regprocedure,'public.push_subscribe(text,text,text,text)'::regprocedure,'public.push_unsubscribe(uuid)'::regprocedure,'public.notification_inbox(text,text,int)'::regprocedure,'public.notifications_mark_read(uuid)'::regprocedure,'public.notification_queue()'::regprocedure,'public.notification_classify()'::regprocedure,'public.notification_connection()'::regprocedure,'public.notification_promotion()'::regprocedure,'public.notification_boost()'::regprocedure,'public.notification_security()'::regprocedure,'public.notification_auth_security()'::regprocedure,'public.admin_notification_save(uuid,text,text,text,text,text,uuid[],timestamptz,text)'::regprocedure,'public.admin_notification_cancel(uuid,text)'::regprocedure,'public.admin_notification_template(text,text,text,text,text,text)'::regprocedure,'public.admin_notification_overview(int)'::regprocedure,'public.notification_tick()'::regprocedure,'public.push_claim(int)'::regprocedure,'public.push_finish(uuid,uuid,text,int,int)'::regprocedure,'public.confirm_production_release(uuid,text,text,text,timestamptz,text)'::regprocedure] loop execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);end loop;
end$$;
grant execute on function public.notification_preferences_get(),public.notification_preferences_save(boolean,boolean,time,text,time,time,jsonb),public.push_subscribe(text,text,text,text),public.push_unsubscribe(uuid),public.notification_inbox(text,text,int),public.notifications_mark_read(uuid),public.admin_notification_save(uuid,text,text,text,text,text,uuid[],timestamptz,text),public.admin_notification_cancel(uuid,text),public.admin_notification_template(text,text,text,text,text,text),public.admin_notification_overview(int) to authenticated;
grant execute on function public.notification_tick(),public.push_claim(int),public.push_finish(uuid,uuid,text,int,int),public.confirm_production_release(uuid,text,text,text,timestamptz,text) to service_role;
commit;
