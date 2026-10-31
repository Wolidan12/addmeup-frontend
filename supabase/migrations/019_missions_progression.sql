begin;
create table public.mission_limits(id boolean primary key default true check(id),daily_dc numeric(20,2) not null check(daily_dc between 0 and 1000000),weekly_dc numeric(20,2) not null check(weekly_dc between 0 and 10000000));
insert into public.mission_limits values(true,1000,3000);
create table public.creator_ranks(min_xp bigint primary key check(min_xp>=0),title text unique not null);
insert into public.creator_ranks values(0,'Starter'),(100,'Rising Creator'),(500,'Influencer'),(1500,'Trendsetter'),(5000,'Elite Creator');
create table public.missions(
 id uuid primary key default gen_random_uuid(),slug text unique not null,title text not null check(length(trim(title)) between 2 and 100),description text not null check(length(trim(description)) between 8 and 1000),instructions text not null check(length(trim(instructions)) between 8 and 2000),
 cadence text not null check(cadence in ('daily','weekly','special')),kind text not null check(kind in ('daily_login','profile','social','referral','manual')),
 reward_dc numeric(20,2) not null check(reward_dc between 0.01 and 10000),reward_xp int not null check(reward_xp between 0 and 100000),
 requires_approval boolean not null,starts_at timestamptz not null default now(),deadline timestamptz,is_active boolean not null default true,
 check(deadline is null or deadline>starts_at),check(requires_approval=(kind in ('social','referral','manual')))
);
insert into public.missions(slug,title,description,instructions,cadence,kind,reward_dc,reward_xp,requires_approval) values
('daily-login','Daily login','Sign in to your verified account today.','A trusted Supabase sign-in today is required; opening or clicking a page does not prove a new login. One award per UTC day.','daily','daily_login',20,10,false),
('complete-profile','Complete your profile','Give your creator profile a useful introduction.','Add your display name, username, profile photo, bio, country and at least one interest. One profile reward per account.','special','profile',100,50,false),
('verified-social','Verify a supported social account','Prove ownership of a supported social account.','Select your own linked account. Include independent ownership evidence and your submission reference in a public verification challenge. Staff must verify the canonical account identity; a link or screenshot alone is not proof. One social reward per account.','special','social',150,75,true),
('daily-original','Daily creator mission','Publish a useful original creator post.','Submit a public original-post URL and explain its value. No paid/fake engagement, clicks or follower exchanges. Staff independently review originality and the canonical post reference.','daily','manual',100,50,true),
('weekly-project','Weekly creator challenge','Build and share a useful original creator project.','Submit your project URL and a short explanation of the work. Staff review original work, not engagement counts. The same artifact cannot fund two awards.','weekly','manual',500,250,true),
('active-referral','Successful active referral','Refer a genuine, verified and active creator.','Select an account already linked through your referral code. They must verify and complete their profile. Submit evidence of meaningful original creator activity for independent staff review. Registration or purchase alone is not sufficient.','special','referral',300,150,true);
create table public.mission_submissions(
 id uuid primary key,proof_reference uuid unique not null,user_id uuid not null,mission_id uuid not null references public.missions(id),mission_title text not null,period_key text not null,status text not null check(status in ('submitted','awarded','rejected')),
 evidence text not null default '' check(length(evidence)<=2000),social_link_id uuid,social_platform_snapshot text,social_url_snapshot text,related_user_id uuid,
 reward_dc numeric(20,2) not null,reward_xp int not null,submitted_at timestamptz not null default clock_timestamp(),reviewed_at timestamptz,review_note text,verified_reference text,
 revision int not null default 1,unique(user_id,mission_id,period_key)
);
create table public.mission_awards(
 id uuid primary key default gen_random_uuid(),submission_id uuid unique not null,user_id uuid not null,mission_id uuid not null,kind text not null,
 amount_dc numeric(20,2) not null check(amount_dc>0),xp int not null check(xp>=0),evidence_key text unique,awarded_at timestamptz not null default clock_timestamp(),activity_reference text unique not null
);
create index mission_awards_user_time on public.mission_awards(user_id,awarded_at desc);
create index mission_submissions_user_time on public.mission_submissions(user_id,submitted_at desc);
create table public.creator_xp_events(id uuid primary key default gen_random_uuid(),user_id uuid not null,xp bigint not null check(xp>0),previous_xp bigint not null,new_xp bigint not null,source_reference text unique not null,created_at timestamptz not null default clock_timestamp(),check(new_xp=previous_xp+xp));
-- Preserve existing, non-spendable XP without issuing credits or retroactive new mission awards.
insert into public.creator_xp_events(user_id,xp,previous_xp,new_xp,source_reference) select id,creator_xp,0,creator_xp,'opening-xp:'||id from public.profiles where creator_xp>0;
do $$declare tab text;begin
 foreach tab in array array['mission_limits','creator_ranks','missions','mission_submissions','mission_awards','creator_xp_events'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',tab);
 end loop;
end$$;
create function public.mission_staff_access() returns boolean language sql stable security definer set search_path=public as $$select coalesce(public.reward_account_verified(auth.uid()) and public.admin_role()='super_admin',false)$$;
revoke all on function public.mission_staff_access() from public,anon,authenticated,service_role;
grant execute on function public.mission_staff_access() to authenticated;
create policy "missions catalogue read" on public.missions for select using(true);
create policy "mission limits read" on public.mission_limits for select using(true);
create policy "creator ranks read" on public.creator_ranks for select using(true);
create policy "own submission or staff review" on public.mission_submissions for select to authenticated using(user_id=auth.uid() or public.mission_staff_access());
create policy "own mission or finance history" on public.mission_awards for select to authenticated using(user_id=auth.uid() or public.reward_finance_access());
create policy "own XP history" on public.creator_xp_events for select to authenticated using(user_id=auth.uid());
grant select on public.missions,public.mission_limits,public.creator_ranks to anon,authenticated;
grant select on public.mission_submissions,public.mission_awards,public.creator_xp_events to authenticated;
do $$declare tab text;begin
 foreach tab in array array['mission_awards','creator_xp_events'] loop
  execute format('create trigger immutable_history before update or delete on public.%I for each row execute function public.reward_history_immutable()',tab);
  execute format('create trigger immutable_history_truncate before truncate on public.%I for each statement execute function public.reward_history_immutable()',tab);
 end loop;
end$$;
create function public.award_mission_submission(p_submission uuid,p_evidence_key text default null) returns void language plpgsql security definer set search_path=public as $$
declare s public.mission_submissions;m public.missions;lim public.mission_limits;daily numeric;weekly numeric;bonus int:=0;amount numeric;xp_before bigint;platform_now text;url_now text;begin
 select * into s from public.mission_submissions where id=p_submission for update;
 if s.status='awarded' then return;end if;
 if s.status<>'submitted' then raise exception 'Submission is not awaiting review';end if;
 select * into m from public.missions where id=s.mission_id;
 -- Caller has locked this user's profile, serializing all limits, evidence and award retries.
 if not public.reward_account_verified(s.user_id) then raise exception 'Verify your account before earning rewards';end if;
 if m.kind='profile' and not public.launch_profile_complete(s.user_id) then raise exception 'Complete required profile fields first';end if;
 if m.kind in ('profile','social') and exists(select 1 from public.mission_awards where user_id=s.user_id and kind=m.kind) then raise exception 'This account has already earned this one-time reward';end if;
 if m.kind='social' then
  select l.platform,l.url into platform_now,url_now from public.social_links l join public.social_platforms p on p.key=l.platform where l.id=s.social_link_id and l.profile_id=s.user_id for share of l;
  if not found or platform_now is distinct from s.social_platform_snapshot or url_now is distinct from s.social_url_snapshot then raise exception 'The linked account changed; reject and resubmit ownership proof';end if;
 elsif m.kind='referral' then
  if s.related_user_id=s.user_id or not public.reward_account_verified(s.related_user_id) or not public.launch_profile_complete(s.related_user_id) or not exists(select 1 from public.referrals where referrer_id=s.user_id and referred_id=s.related_user_id) then raise exception 'Referral must be genuine, linked, verified and complete';end if;
 end if;
 if m.requires_approval and nullif(p_evidence_key,'') is null then raise exception 'Independently verified canonical evidence reference required';end if;
 select * into lim from public.mission_limits where id for share;
 if not found then raise exception 'Earning policy unavailable';end if;
 select coalesce(sum(amount_dc) filter(where awarded_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),0),coalesce(sum(amount_dc),0) into daily,weekly from public.mission_awards where user_id=s.user_id and awarded_at>=date_trunc('week',now() at time zone 'UTC') at time zone 'UTC';
 perform public.ensure_member_balance();perform 1 from public.points_balance where user_id=s.user_id for update;
 -- Keep existing capped paid booster benefits for eligible automatic daily/profile rewards only.
 if m.kind in ('daily_login','profile') and auth.uid()=s.user_id then bonus:=public.consume_boost_bonus(floor(s.reward_dc)::int);end if;
 amount:=s.reward_dc+bonus;
 if daily+amount>lim.daily_dc or weekly+amount>lim.weekly_dc then raise exception 'Daily or weekly earning limit reached';end if;
 insert into public.mission_awards(submission_id,user_id,mission_id,kind,amount_dc,xp,evidence_key,activity_reference) values(s.id,s.user_id,s.mission_id,m.kind,amount,s.reward_xp,p_evidence_key,'mission:'||s.id);
 insert into public.points_balance(user_id,balance) values(s.user_id,amount) on conflict(user_id) do update set balance=public.points_balance.balance+amount;
 insert into public.points_ledger(user_id,points,reason,ref_key) values(s.user_id,amount,'Mission: '||m.title,'mission:'||s.id);
 if s.reward_xp>0 then
  select creator_xp into xp_before from public.profiles where id=s.user_id;
  insert into public.creator_xp_events(user_id,xp,previous_xp,new_xp,source_reference) values(s.user_id,s.reward_xp,xp_before,xp_before+s.reward_xp,'mission:'||s.id);
  update public.profiles set creator_xp=creator_xp+s.reward_xp where id=s.user_id;
 end if;
 if m.kind='daily_login' then update public.points_balance set current_streak=case when last_checkin=(now() at time zone 'UTC')::date-1 then current_streak+1 else 1 end,last_checkin=(now() at time zone 'UTC')::date where user_id=s.user_id;end if;
 update public.mission_submissions set status='awarded',reviewed_at=clock_timestamp() where id=s.id;
 insert into public.audit_logs(action,target,meta) values('mission_awarded',s.id::text,jsonb_build_object('user_id',s.user_id,'dc',amount,'xp',s.reward_xp,'bonus_dc',bonus));
end$$;
create function public.submit_mission(p_mission uuid,p_request uuid,p_evidence text default '',p_social uuid default null,p_related uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare m public.missions;s public.mission_submissions;period text;identifier uuid;platform_snapshot text;url_snapshot text;begin
 perform public.require_active_account();
 if auth.uid() is null or p_request is null or p_evidence is null or length(p_evidence)>2000 then raise exception 'Valid mission request required';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if not public.reward_account_verified(auth.uid()) then raise exception 'Verify your account before earning rewards';end if;
 select * into m from public.missions where id=p_mission for share;
 if not found then raise exception 'Mission unavailable';end if;
 select * into s from public.mission_submissions where id=p_request or proof_reference=p_request;
 if found then
  if s.user_id<>auth.uid() or s.mission_id<>p_mission or s.evidence<>trim(p_evidence) or s.social_link_id is distinct from p_social or s.related_user_id is distinct from p_related then raise exception 'Request reference already used';end if;
  return s.id;
 end if;
 if not m.is_active or m.starts_at>now() or (m.deadline is not null and m.deadline<now()) then raise exception 'Mission unavailable or deadline passed';end if;
 if m.kind='daily_login' and not exists(select 1 from auth.users u where id=auth.uid() and nullif(to_jsonb(u)->>'last_sign_in_at','')::timestamptz>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') then raise exception 'Sign in today before claiming the daily login reward';end if;
 if m.requires_approval and length(trim(p_evidence))<12 then raise exception 'Submit meaningful independent evidence';end if;
 if m.kind='profile' and not public.launch_profile_complete(auth.uid()) then raise exception 'Complete required profile fields first';end if;
 if m.kind='social' and not exists(select 1 from public.social_links l join public.social_platforms p on p.key=l.platform where l.id=p_social and l.profile_id=auth.uid()) then raise exception 'Select your own supported social account';end if;
 if m.kind='social' then select platform,url into platform_snapshot,url_snapshot from public.social_links where id=p_social and profile_id=auth.uid() for share;end if;
 if m.kind='referral' and (p_related is null or p_related=auth.uid() or not public.reward_account_verified(p_related) or not public.launch_profile_complete(p_related) or not exists(select 1 from public.referrals where referrer_id=auth.uid() and referred_id=p_related)) then raise exception 'Referral must be genuine, linked, verified and complete';end if;
 period:=case when m.kind='referral' then 'referral:'||p_related when m.kind in ('profile','social') or m.cadence='special' then 'once' when m.cadence='daily' then to_char(now() at time zone 'UTC','YYYY-MM-DD') else to_char(date_trunc('week',now() at time zone 'UTC'),'YYYY-MM-DD') end;
 select * into s from public.mission_submissions where user_id=auth.uid() and mission_id=m.id and period_key=period for update;
 if found and s.status<>'rejected' then return s.id;end if;
 if found then
  identifier:=s.id;update public.mission_submissions set status='submitted',proof_reference=p_request,social_platform_snapshot=platform_snapshot,social_url_snapshot=url_snapshot,mission_title=m.title,reward_dc=m.reward_dc,reward_xp=m.reward_xp,evidence=trim(p_evidence),social_link_id=p_social,related_user_id=p_related,submitted_at=clock_timestamp(),reviewed_at=null,review_note=null,revision=revision+1 where id=s.id;
 else
  identifier:=p_request;insert into public.mission_submissions(id,proof_reference,user_id,mission_id,mission_title,period_key,status,evidence,social_link_id,social_platform_snapshot,social_url_snapshot,related_user_id,reward_dc,reward_xp) values(identifier,p_request,auth.uid(),m.id,m.title,period,'submitted',trim(p_evidence),p_social,platform_snapshot,url_snapshot,p_related,m.reward_dc,m.reward_xp);
 end if;
 if not m.requires_approval then perform public.award_mission_submission(identifier);end if;
 return identifier;
end$$;
create function public.admin_review_mission(p_submission uuid,p_revision int,p_approve boolean,p_reason text,p_identity text default null) returns void language plpgsql security definer set search_path=public as $$
declare s public.mission_submissions;m public.missions;owner_id uuid;identity_key text;platform text;begin
 perform public.require_active_account();
 if public.admin_role() is distinct from 'super_admin' or not public.reward_account_verified(auth.uid()) then raise exception 'Permission denied';end if;
 if p_approve is null or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Independent review reason required';end if;
 select user_id into owner_id from public.mission_submissions where id=p_submission;
 if owner_id=auth.uid() then raise exception 'You cannot review your own reward evidence';end if;
 perform 1 from public.profiles where id=owner_id for update;
 select * into s from public.mission_submissions where id=p_submission for update;
 if not found then raise exception 'Submission not found';end if;
 if p_revision is null or p_revision<>s.revision then raise exception 'Submission changed; refresh before review';end if;
 if (s.status='awarded' and p_approve) or (s.status='rejected' and not p_approve) then return;end if;
 if s.status<>'submitted' then raise exception 'Submission already reviewed';end if;
 select * into m from public.missions where id=s.mission_id;
 if not m.requires_approval then raise exception 'This mission uses automatic server verification';end if;
 if p_approve then
  if p_identity is null or lower(trim(p_identity)) !~ '^[a-z0-9:/._@-]{4,240}$' then raise exception 'Canonical independently verified account or artifact ID required';end if;
  if m.kind='referral' then identity_key:='referral:'||s.related_user_id;
  elsif m.kind='social' then identity_key:='social:'||s.social_platform_snapshot||':'||lower(trim(p_identity));
  else identity_key:='artifact:'||lower(trim(p_identity));end if;
  perform public.award_mission_submission(s.id,identity_key);
 else update public.mission_submissions set status='rejected',reviewed_at=clock_timestamp() where id=s.id;end if;
 update public.mission_submissions set review_note=trim(p_reason),verified_reference=case when p_approve then lower(trim(p_identity)) else null end where id=s.id;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),case when p_approve then 'mission_evidence_approved' else 'mission_evidence_rejected' end,s.id::text,jsonb_build_object('reason',trim(p_reason),'revision',s.revision,'canonical_evidence',identity_key,'submission_snapshot',to_jsonb(s),'verified_reference',lower(trim(p_identity))));
end$$;
create function public.mission_overview(p_cadence text default '',p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare rows jsonb;xp bigint;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_cadence is null or p_cadence not in ('','daily','weekly','special') or p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid mission filter';end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select m.*, (select to_jsonb(s) from public.mission_submissions s where s.mission_id=m.id and s.user_id=auth.uid() and (m.kind in ('profile','social','referral') or m.cadence='special' or s.period_key=case when m.cadence='daily' then to_char(now() at time zone 'UTC','YYYY-MM-DD') else to_char(date_trunc('week',now() at time zone 'UTC'),'YYYY-MM-DD') end) order by s.submitted_at desc,s.id desc limit 1) latest_submission from public.missions m where m.is_active and (p_cadence='' or m.cadence=p_cadence) order by m.starts_at desc,m.id limit 12 offset p_page*12) r;
 select creator_xp into xp from public.profiles where id=auth.uid();
 return jsonb_build_object('rows',rows,'total',(select count(*) from public.missions where is_active and (p_cadence='' or cadence=p_cadence)),'verified',public.reward_account_verified(auth.uid()),'profile_complete',public.launch_profile_complete(auth.uid()),'xp',coalesce(xp,0),'rank',(select title from public.creator_ranks where min_xp<=coalesce(xp,0) order by min_xp desc limit 1),'next_rank',(select to_jsonb(r) from public.creator_ranks r where min_xp>coalesce(xp,0) order by min_xp limit 1),'limits',(select to_jsonb(l) from public.mission_limits l where id),'earned_today',coalesce((select sum(amount_dc) from public.mission_awards where user_id=auth.uid() and awarded_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),0),'earned_week',coalesce((select sum(amount_dc) from public.mission_awards where user_id=auth.uid() and awarded_at>=date_trunc('week',now() at time zone 'UTC') at time zone 'UTC'),0));
end$$;
create function public.mission_referral_candidates(p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 return jsonb_build_object('rows',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from(select f.referred_id,case when p.is_public then p.display_name else 'Linked creator' end display_name from public.referrals f join public.profiles p on p.id=f.referred_id where f.referrer_id=auth.uid() and public.reward_account_verified(f.referred_id) and public.launch_profile_complete(f.referred_id) and not exists(select 1 from public.mission_awards where evidence_key='referral:'||f.referred_id) order by f.created_at desc,f.id desc limit 20 offset greatest(0,least(coalesce(p_page,0),100000))*20)r),'total',(select count(*) from public.referrals f where f.referrer_id=auth.uid() and public.reward_account_verified(f.referred_id) and public.launch_profile_complete(f.referred_id) and not exists(select 1 from public.mission_awards where evidence_key='referral:'||f.referred_id)));
end$$;
revoke all on function public.mission_referral_candidates(int) from public,anon,authenticated,service_role;
grant execute on function public.mission_referral_candidates(int) to authenticated;
create function public.admin_save_mission(p_id uuid,p_data jsonb,p_reason text) returns uuid language plpgsql security definer set search_path=public as $$declare existing public.missions;identifier uuid:=coalesce(p_id,gen_random_uuid());reward numeric;xp int;begin
 perform public.require_active_account();
 if public.admin_role() is distinct from 'super_admin' or not public.reward_account_verified(auth.uid()) then raise exception 'Permission denied';end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 or p_data is null then raise exception 'Reason and configuration required';end if;
 reward:=(p_data->>'reward_dc')::numeric;xp:=(p_data->>'reward_xp')::int;
 if reward is null or reward<>round(reward,2) or xp is null or (p_data->>'is_active') is null then raise exception 'Supply a two-decimal DC price, XP and availability';end if;
 select * into existing from public.missions where id=identifier for update;
 if found then
  update public.missions set title=trim(p_data->>'title'),description=p_data->>'description',instructions=p_data->>'instructions',reward_dc=reward,reward_xp=xp,is_active=(p_data->>'is_active')::boolean,deadline=nullif(p_data->>'deadline','')::timestamptz where id=identifier;
 else
  insert into public.missions(id,slug,title,description,instructions,cadence,kind,reward_dc,reward_xp,requires_approval,deadline,is_active) values(identifier,'event-'||identifier,trim(p_data->>'title'),p_data->>'description',p_data->>'instructions',p_data->>'cadence','manual',reward,xp,true,nullif(p_data->>'deadline','')::timestamptz,(p_data->>'is_active')::boolean);
 end if;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'mission_configuration_saved',identifier::text,jsonb_build_object('before',to_jsonb(existing),'configuration',p_data,'reason',trim(p_reason)));return identifier;
end$$;
create function public.admin_mission_limits(p_daily numeric,p_weekly numeric,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();
 if public.admin_role() is distinct from 'super_admin' or not public.reward_account_verified(auth.uid()) then raise exception 'Permission denied';end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 or p_daily is null or p_weekly is null or p_daily<>round(p_daily,2) or p_weekly<>round(p_weekly,2) then raise exception 'Reason and two-decimal earning limits required';end if;
 update public.mission_limits set daily_dc=p_daily,weekly_dc=p_weekly where id;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'mission_limits_saved','missions',jsonb_build_object('daily_dc',p_daily,'weekly_dc',p_weekly,'reason',trim(p_reason)));
end$$;
alter function public.member_overview() rename to member_overview_before_progression;
revoke all on function public.member_overview_before_progression() from public,anon,authenticated,service_role;
create function public.member_overview() returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;xp bigint;rank text;begin
 result:=public.member_overview_before_progression();xp:=coalesce((result#>>'{profile,creator_xp}')::bigint,0);
 select title into rank from public.creator_ranks where min_xp<=xp order by min_xp desc limit 1;
 return jsonb_set(result,'{profile}',(result->'profile')||jsonb_build_object('creator_rank',rank))||jsonb_build_object('referral_percent',0,'active_referral_reward',(select reward_dc from public.missions where slug='active-referral' and is_active and starts_at<=now() and (deadline is null or deadline>=now())),'referral_earnings',coalesce((result->>'referral_earnings')::numeric,0)+coalesce((select sum(amount_dc) from public.mission_awards where user_id=auth.uid() and kind='referral'),0));
end$$;
revoke all on function public.member_overview() from public,anon,authenticated,service_role;
grant execute on function public.member_overview() to authenticated;
-- New referral rewards require genuine activity approval, never an automatic purchase commission.
-- Previously earned referral credits/history are retained without expiration.
create or replace function public.award_order_referral(p_order uuid) returns void language plpgsql security definer set search_path=public as $$begin return;end$$;
create or replace function public.member_referrals(p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 return jsonb_build_object('total',(select count(*) from public.referrals where referrer_id=auth.uid()),'rows',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from(
  select f.id,case when p.is_public then p.display_name else 'Member' end display_name,f.created_at,
  f.rewarded or exists(select 1 from public.mission_awards where user_id=auth.uid() and evidence_key='referral:'||f.referred_id) rewarded,
  coalesce((select sum(x.points) from public.referral_purchase_rewards x where x.referred_id=f.referred_id and x.referrer_id=auth.uid()),0)+coalesce((select sum(amount_dc) from public.mission_awards where user_id=auth.uid() and evidence_key='referral:'||f.referred_id),0) total_reward_points
  from public.referrals f left join public.profiles p on p.id=f.referred_id where f.referrer_id=auth.uid() order by f.created_at desc,f.id desc limit 20 offset greatest(0,least(coalesce(p_page,0),100000))*20
 )r));
end$$;
-- Retire old repeatable profile/link rewards. A social URL by itself no longer earns DC.
revoke all on function public.claim_task(text),public.claim_daily_checkin() from public,anon,authenticated,service_role;
-- Admin's existing paginated resources stay intact; add explicit new read scopes.
alter function public.admin_list(text,text,text,int) rename to admin_list_before_missions;
revoke all on function public.admin_list_before_missions(text,text,text,int) from public,anon,authenticated,service_role;
create function public.admin_list(p_resource text,p_search text default '',p_status text default '',p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare rows jsonb;total bigint;column_name text;predicate text;begin
 if p_resource not in ('missions','mission_submissions','mission_awards','launch_awards') then return public.admin_list_before_missions(p_resource,p_search,p_status,p_page);end if;
 perform public.require_active_account();
 if not public.reward_account_verified(auth.uid()) then raise exception 'Permission denied';end if;
 if public.admin_role() is distinct from 'super_admin' and not(p_resource in ('launch_awards','mission_awards') and public.admin_can('points_ledger')) then raise exception 'Permission denied';end if;
 column_name:=case when p_resource='missions' then 'title' when p_resource='mission_submissions' then 'evidence' else 'user_id' end;
 predicate:=case when p_resource='mission_submissions' then ' and ($2='''' or status=$2)' else ' and ($2 is null or true)' end;
 execute format('select count(*) from public.%I where %I::text ilike $1%s',p_resource,column_name,predicate) into total using '%'||left(coalesce(p_search,''),120)||'%',coalesce(p_status,'');
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]'') from(select * from public.%I where %I::text ilike $1%s order by %I desc,id desc limit 25 offset $3)r',p_resource,column_name,predicate,case when p_resource='missions' then 'starts_at' when p_resource='mission_submissions' then 'submitted_at' else 'awarded_at' end) into rows using '%'||left(coalesce(p_search,''),120)||'%',coalesce(p_status,''),greatest(0,least(coalesce(p_page,0),100000))*25;
 return jsonb_build_object('rows',rows,'total',total);
end$$;
revoke all on function public.award_mission_submission(uuid,text),public.submit_mission(uuid,uuid,text,uuid,uuid),public.admin_review_mission(uuid,int,boolean,text,text),public.mission_overview(text,int),public.admin_save_mission(uuid,jsonb,text),public.admin_mission_limits(numeric,numeric,text),public.admin_list(text,text,text,int) from public,anon,authenticated,service_role;
grant execute on function public.submit_mission(uuid,uuid,text,uuid,uuid),public.admin_review_mission(uuid,int,boolean,text,text),public.mission_overview(text,int),public.admin_save_mission(uuid,jsonb,text),public.admin_mission_limits(numeric,numeric,text),public.admin_list(text,text,text,int) to authenticated;
commit;
