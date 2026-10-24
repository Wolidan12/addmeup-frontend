-- Locking + unique ledger refs protect concurrent rewards; no fabricated evidence.
begin;
create or replace function public.claim_daily_checkin() returns text language plpgsql security definer set search_path=public as $$declare pts int; b record; begin perform public.require_active_account(); if auth.uid() is null then raise exception 'Not signed in'; end if; if not exists(select 1 from public.reward_config where key='checkin_enabled' and value=1) then raise exception 'Daily rewards paused'; end if; select value into pts from public.reward_config where key='daily_checkin_points'; insert into public.points_balance(user_id,referral_code) values(auth.uid(),'DQ-'||substr(md5(auth.uid()::text),1,8)) on conflict(user_id) do nothing; select * into b from public.points_balance where user_id=auth.uid() for update; if b.last_checkin=current_date then raise exception 'Already checked in today'; end if; update public.points_balance set balance=balance+pts, current_streak=case when b.last_checkin=current_date-1 then b.current_streak+1 else 1 end, last_checkin=current_date where user_id=auth.uid(); insert into public.points_ledger(user_id,points,reason,ref_key) values(auth.uid(),pts,'daily_checkin','checkin:'||auth.uid()||':'||current_date); return 'Check-in complete: +'||pts||' pts'; end$$;
create or replace function public.apply_referral(p_code text) returns text language plpgsql security definer set search_path=public as $$declare r record; pts int; begin perform public.require_active_account(); select * into r from public.points_balance where referral_code=p_code; if r is null or r.user_id=auth.uid() then raise exception 'Invalid referral code'; end if; insert into public.referrals(referrer_id,referred_id,rewarded) values(r.user_id,auth.uid(),true); select value into pts from public.reward_config where key='referral_points'; insert into public.points_ledger(user_id,points,reason,ref_key) values(r.user_id,pts,'referral','referral:'||auth.uid()); insert into public.points_balance(user_id,balance) values(r.user_id,pts) on conflict(user_id) do update set balance=public.points_balance.balance+pts; return 'Referral applied.'; end$$;
create or replace function public.claim_task(p_task text) returns text language plpgsql security definer set search_path=public as $$
declare t record; c int;
begin
 perform public.require_active_account();
 select * into t from public.reward_tasks where slug=p_task and is_active for share;
 if not found then raise exception 'Task unavailable'; end if;
 if t.daily_limit is null or t.daily_limit<1 then raise exception 'Invalid task configuration'; end if;
 if p_task='complete-profile' then
  if not exists(select 1 from public.profiles where id=auth.uid() and length(trim(bio))>0 and length(trim(country))>0 and cardinality(interests)>0 and display_name<>'New creator') then raise exception 'Complete your profile first'; end if;
 elsif p_task='add-social-link' then
  if not exists(select 1 from public.social_links where profile_id=auth.uid() and is_public and url ~ '^https://[^[:space:]]+$') then raise exception 'Add a public HTTPS social link first'; end if;
 else
  -- Browsing is not trustworthy proof. Custom tasks need evidence approval in stage 2.
  raise exception 'This task requires a server-verified evidence workflow';
 end if;
 insert into public.task_claims(user_id,task_slug,count) values(auth.uid(),p_task,1)
 on conflict(user_id,task_slug,claimed_on) do update set count=public.task_claims.count+1 returning count into c;
 if c>t.daily_limit then raise exception 'Daily limit reached'; end if;
 insert into public.points_balance(user_id,balance) values(auth.uid(),t.points)
 on conflict(user_id) do update set balance=public.points_balance.balance+t.points;
 insert into public.points_ledger(user_id,points,reason,ref_key) values(auth.uid(),t.points,'task:'||p_task,'task:'||auth.uid()||':'||p_task||':'||current_date||':'||c);
 return 'Task claimed: +'||t.points||' pts';
end$$;
revoke all on function public.claim_daily_checkin(),public.claim_task(text),public.apply_referral(text) from public,anon;
grant execute on function public.claim_daily_checkin(),public.claim_task(text),public.apply_referral(text) to authenticated;
commit;
