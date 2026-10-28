-- OWNER-ONLY recovery 007–011. Back up first; run the ENTIRE file in the EXISTING project.
-- No Auth users/roles are created, no data reset. Existing stages are verified and skipped.
-- Exact known function fingerprints + column/policy checks fail closed on partial/custom installs.
-- All stages share ONE transaction: an error rolls back every change in this run.
-- Changes include reward hardening, provider verifier, bank/managed listings, member programmes,
-- and atomic bulk managed profiles. Prices/plans are NOT invented. Edge Functions need separate deployment.
begin;
select pg_advisory_xact_lock(hashtextextended('danqel-recovery-007-011',0));
do $recovery$
declare applied int[]:=array[]::int[];
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'Use the trusted owner SQL Editor'; end if;
 if to_regprocedure('public.admin_role()') is null or to_regprocedure('public.admin_list(text,text,text,integer)') is null then raise exception '006 admin operations must already be installed'; end if;

 -- Stage 7: 007_reward_claim_hardening.sql
 if ((exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.claim_daily_checkin()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='a165137e1ae3ed794c471172fd9ab8d7' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 or exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.claim_daily_checkin()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='d41702727176f9d67b7247087a87cc0f' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.claim_task(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='7914d17a7a4fe292806f0f5a86028f6e' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 or exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.claim_task(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='9ae5a1b570fcaf3a0a39e8c7477cf264' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.apply_referral(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='0e896cc7a5ef57d37440ce91a3a84fb8' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 or exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.apply_referral(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='87847b901267dbe4116b54ed5f48df78' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))) then
 raise notice 'Stage 7 verified; skipped';
 elsif (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.claim_daily_checkin()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='fdc0316c546d96534e6bce059890152b' and has_function_privilege('anon',p.oid,'execute')=true and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.claim_task(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='46c9935b7e70dfe9b56e24d5bbc69ab4' and has_function_privilege('anon',p.oid,'execute')=true and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.apply_referral(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='dad787a5c331f7607b281be0e2bea3c3' and has_function_privilege('anon',p.oid,'execute')=true and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='actor_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='actor_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='action' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='target' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='meta' and udt_name='jsonb')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='blocker_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='blocked_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='body' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='is_read' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='provider' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='reference' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='amount_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='verified_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='balance' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='current_streak' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='last_checkin' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='referral_code' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='referred_by' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='ref_key' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='viewer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='viewed_on' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='username' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='display_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='bio' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='country' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='interests' and udt_name='_text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_sponsored' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='price_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='item_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='transaction_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='referrer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='referred_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='rewarded' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reporter_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_config' and column_name='key' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_config' and column_name='value' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='slug' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='daily_limit' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='platform' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='plan' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='starts_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='expires_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='task_slug' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='claimed_on' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='count' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='role' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='created_at' and udt_name='timestamptz')) then
 execute $stage7$
-- Locking + unique ledger refs protect concurrent rewards; no fabricated evidence.

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

$stage7$;
 applied:=array_append(applied,7);
 raise notice 'Stage 7 applied';
 else raise exception 'Stage 7: unfamiliar or partial schema; no changes committed. Request owner review rather than removing guards.';
 end if;

 -- Stage 8: 008_payment_verification.sql
 if ((exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.settle_verified_payment(text, bigint, text, text, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='108dd30cf10bfe7f751f03caa7b0ffd5' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=false and has_function_privilege('service_role',p.oid,'execute')=true))) then
 raise notice 'Stage 8 verified; skipped';
 elsif (to_regprocedure('public.settle_verified_payment(text, bigint, text, text, text)') is null
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='actor_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='actor_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='action' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='target' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='meta' and udt_name='jsonb')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='blocker_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='blocked_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='body' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='is_read' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='provider' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='reference' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='amount_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='verified_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='balance' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='current_streak' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='last_checkin' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='referral_code' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='referred_by' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='ref_key' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='viewer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='viewed_on' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='username' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='display_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='bio' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='country' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='interests' and udt_name='_text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_sponsored' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='price_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='item_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='transaction_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='referrer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='referred_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='rewarded' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reporter_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_config' and column_name='key' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_config' and column_name='value' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='slug' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='daily_limit' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='platform' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='plan' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='starts_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='expires_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='task_slug' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='claimed_on' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='count' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='role' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='created_at' and udt_name='timestamptz')) then
 execute $stage8$
-- Trusted provider results ONLY; this function is NOT callable by browser roles.

create or replace function public.settle_verified_payment(p_reference text,p_amount bigint,p_currency text,p_email text,p_provider_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare payment public.payment_transactions; customer text;
begin
 select * into payment from public.payment_transactions where reference=p_reference for update;
 if not found then raise exception 'Unknown payment reference'; end if;
 select email into customer from auth.users where id=payment.user_id;
 if payment.provider is distinct from 'paystack' or p_currency is distinct from 'NGN' or p_amount is distinct from payment.amount_kobo::bigint or customer is null or p_email is null or lower(customer) is distinct from lower(p_email) or nullif(p_provider_id,'') is null then raise exception 'Provider details do not match payment'; end if;
 if payment.status='verified' then return true; end if;
 if payment.status<>'pending' then raise exception 'Payment is not pending'; end if;
 update public.payment_transactions set status='verified',verified_at=now() where id=payment.id;
 insert into public.audit_logs(action,target,meta) values('provider_payment_verified',payment.id::text,jsonb_build_object('provider','paystack','provider_id',p_provider_id,'amount_kobo',p_amount));
 return true;
end$$;
revoke all on function public.settle_verified_payment(text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.settle_verified_payment(text,bigint,text,text,text) to service_role;

$stage8$;
 applied:=array_append(applied,8);
 raise notice 'Stage 8 applied';
 else raise exception 'Stage 8: unfamiliar or partial schema; no changes committed. Request owner review rather than removing guards.';
 end if;

 -- Stage 9: 009_manual_payments_and_listings.sql
 if ((exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_list(text, text, text, integer)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='c5ec424bebb91466b3a3efcb7d8cf2c7' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 or exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_list(text, text, text, integer)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='9aafe5662f7db2ba6b2ccd2323bf44e9' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_overview()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='ddd4f6471e228f228187c5d3d6af74bb' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.create_bank_point_order(uuid, uuid)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='d0deda1c636df09d6045c723d6e8d150' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.submit_bank_point_order(uuid, text, text, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='30319c9bd0af00b940108e330063ce60' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.cancel_bank_point_order(uuid)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='77969c648fcf99b385b6f350ebd26842' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_review_bank_order(uuid, boolean, text, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='291feaa72a449cf93c7f3f4179f7573f' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 or exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_review_bank_order(uuid, boolean, text, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='48b4fab9df0556d1040737996af99f59' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_save_point_package(uuid, text, integer, integer, boolean, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='55f3ebbfb04e7e083957ab3672380f32' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_save_managed_profile(uuid, jsonb, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='c696041d0b838aea29ad4f8c61423e02' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_can(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='7378ed5c089ec6ea87229262f898a9e0' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 or exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_can(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='ed183602e48c30a8708d4520cbd13df9' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='package_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='package_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='amount_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='account_number' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='account_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='bank_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='payer_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='transfer_reference' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='receipt_path' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='bank_reference' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='reviewed_by' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='review_note' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='reviewed_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='submitted_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='id' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='account_number' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='account_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='bank_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='username' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='display_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='bio' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='country' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='interests' and udt_name='_text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='avatar_url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='social_links' and udt_name='jsonb')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='created_by' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='price_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from pg_policies where schemaname='public' and tablename='point_packages' and policyname='active packages read')
 and exists(select 1 from pg_policies where schemaname='public' and tablename='bank_transfer_details' and policyname='bank instructions read')
 and exists(select 1 from pg_policies where schemaname='public' and tablename='bank_point_orders' and policyname='own bank orders read')
 and exists(select 1 from pg_policies where schemaname='public' and tablename='managed_profiles' and policyname='managed profiles read')
 and exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='managed photo read')
 and exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='managed photo upload')
 and exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='managed photo remove')
 and exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='receipt upload')
 and exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='receipt read')
 and exists(select 1 from pg_class where oid=to_regclass('public.point_packages') and relrowsecurity)
 and exists(select 1 from pg_class where oid=to_regclass('public.bank_transfer_details') and relrowsecurity)
 and exists(select 1 from pg_class where oid=to_regclass('public.bank_point_orders') and relrowsecurity)
 and exists(select 1 from pg_class where oid=to_regclass('public.managed_profiles') and relrowsecurity)) then
 raise notice 'Stage 9 verified; skipped';
 elsif (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_list(text, text, text, integer)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='49b70b697f2d645b4a7ecba924766612' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_overview()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='b21df4303e116893c10e8d4cb27a90a2' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 and to_regprocedure('public.create_bank_point_order(uuid, uuid)') is null
 and to_regprocedure('public.submit_bank_point_order(uuid, text, text, text)') is null
 and to_regprocedure('public.cancel_bank_point_order(uuid)') is null
 and to_regprocedure('public.admin_review_bank_order(uuid, boolean, text, text)') is null
 and to_regprocedure('public.admin_save_point_package(uuid, text, integer, integer, boolean, text)') is null
 and to_regprocedure('public.admin_save_managed_profile(uuid, jsonb, text)') is null
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_can(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='d8c72dd8bdd6776286e9a930cc0a2399' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='actor_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='actor_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='action' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='target' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='meta' and udt_name='jsonb')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='blocker_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='blocked_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='body' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='is_read' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='provider' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='reference' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='amount_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='verified_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='balance' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='current_streak' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='last_checkin' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='referral_code' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='referred_by' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='ref_key' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='viewer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='viewed_on' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='username' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='display_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='bio' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='country' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='interests' and udt_name='_text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_sponsored' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='price_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='item_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='transaction_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='referrer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='referred_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='rewarded' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reporter_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_config' and column_name='key' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_config' and column_name='value' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='slug' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='daily_limit' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='platform' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='plan' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='starts_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='expires_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='task_slug' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='claimed_on' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='count' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='role' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='created_at' and udt_name='timestamptz')
 and to_regclass('public.point_packages') is null
 and to_regclass('public.bank_transfer_details') is null
 and to_regclass('public.bank_point_orders') is null
 and to_regclass('public.managed_profiles') is null) then
 execute $stage9$
-- Additive: manual bank-transfer purchases, independent managed listings, and upload limits.

create table public.point_packages(
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 80),
 points int not null check(points between 1 and 1000000), price_kobo int not null check(price_kobo between 100 and 100000000),
 is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.bank_transfer_details(
 id boolean primary key default true check(id), account_number text not null, account_name text not null, bank_name text not null
);
insert into public.bank_transfer_details values(true,'6977298247','LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST','MONIEPOINT');
create table public.bank_point_orders(
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 package_id uuid not null references public.point_packages(id), package_title text not null,
 points int not null check(points>0), amount_kobo int not null check(amount_kobo>0),
 account_number text not null, account_name text not null, bank_name text not null,
 status text not null default 'awaiting_transfer' check(status in ('awaiting_transfer','submitted','approved','rejected','cancelled')),
 payer_name text, transfer_reference text, receipt_path text,
 bank_reference text unique, reviewed_by uuid, review_note text, reviewed_at timestamptz,
 created_at timestamptz not null default now(), submitted_at timestamptz
);
create unique index bank_order_transfer_ref on public.bank_point_orders(lower(transfer_reference)) where transfer_reference is not null;
create index bank_orders_queue on public.bank_point_orders(status,created_at desc);
create index bank_orders_owner on public.bank_point_orders(user_id,created_at desc);
create table public.managed_profiles(
 id uuid primary key default gen_random_uuid(), username text unique not null check(username ~ '^[a-z0-9_]{3,24}$'),
 display_name text not null check(length(trim(display_name)) between 1 and 60), bio text check(length(bio)<=280),
 country text, interests text[] not null default '{}', avatar_url text, social_links jsonb not null default '[]',
 is_public boolean not null default true, created_by uuid not null, created_at timestamptz not null default now()
);
alter table public.point_packages enable row level security;
alter table public.bank_transfer_details enable row level security;
alter table public.bank_point_orders enable row level security;
alter table public.managed_profiles enable row level security;
create policy "active packages read" on public.point_packages for select using(is_active);
create policy "bank instructions read" on public.bank_transfer_details for select to authenticated using(true);
create policy "own bank orders read" on public.bank_point_orders for select to authenticated using(user_id=auth.uid());
create policy "managed profiles read" on public.managed_profiles for select using(is_public);
grant select on public.point_packages,public.managed_profiles to anon,authenticated;
grant select on public.bank_transfer_details,public.bank_point_orders to authenticated;
revoke insert,update,delete on public.point_packages,public.bank_transfer_details,public.bank_point_orders,public.managed_profiles from anon,authenticated;

create or replace function public.create_bank_point_order(p_package uuid,p_request uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare pkg public.point_packages; bank public.bank_transfer_details; existing public.bank_point_orders;
begin
 perform public.require_active_account();
 if p_request is null then raise exception 'Request ID required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select * into existing from public.bank_point_orders where id=p_request;
 if found then
  if existing.user_id is distinct from auth.uid() or existing.package_id<>p_package then raise exception 'Order ID unavailable'; end if;
  return existing.id;
 end if;
 if (select count(*) from public.bank_point_orders where user_id=auth.uid() and status in ('awaiting_transfer','submitted'))>=5 then raise exception 'Finish or cancel your existing payment requests first'; end if;
 select * into pkg from public.point_packages where id=p_package and is_active for share;
 if not found then raise exception 'Package is no longer available'; end if;
 select * into bank from public.bank_transfer_details where id;
 if not found then raise exception 'Bank transfers are not configured'; end if;
 insert into public.bank_point_orders(id,user_id,package_id,package_title,points,amount_kobo,account_number,account_name,bank_name)
 values(p_request,auth.uid(),pkg.id,pkg.title,pkg.points,pkg.price_kobo,bank.account_number,bank.account_name,bank.bank_name);
 return p_request;
end$$;
create or replace function public.submit_bank_point_order(p_order uuid,p_payer text,p_reference text,p_receipt text) returns void
language plpgsql security definer set search_path=public as $$
declare item public.bank_point_orders;
begin
 perform public.require_active_account();
 select * into item from public.bank_point_orders where id=p_order and user_id=auth.uid() for update;
 if not found then raise exception 'Order not found'; end if;
 if item.status='submitted' and item.receipt_path=p_receipt and item.transfer_reference=lower(trim(p_reference)) then return; end if;
 if item.status<>'awaiting_transfer' then raise exception 'Order cannot be submitted'; end if;
 if p_payer is null or length(trim(p_payer)) not between 2 and 100 or p_reference is null or length(trim(p_reference)) not between 4 and 120 then raise exception 'Provide payer name and transfer reference'; end if;
 if p_receipt is null or p_receipt !~ ('^'||auth.uid()||'/'||p_order||'/[a-f0-9-]+\.(jpg|png|webp)$') then raise exception 'Invalid receipt path'; end if;
 if not exists(select 1 from storage.objects where bucket_id='bank-receipts' and name=p_receipt) then raise exception 'Upload payment evidence first'; end if;
 update public.bank_point_orders set payer_name=trim(p_payer),transfer_reference=lower(trim(p_reference)),receipt_path=p_receipt,status='submitted',submitted_at=now() where id=p_order;
end$$;
create or replace function public.cancel_bank_point_order(p_order uuid) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();
 update public.bank_point_orders set status='cancelled' where id=p_order and user_id=auth.uid() and status='awaiting_transfer';
 if not found then raise exception 'Only your unsubmitted orders may be cancelled'; end if;
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
 end if;
 update public.bank_point_orders set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),review_note=trim(p_reason),reviewed_at=now() where id=p_order;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),case when p_approve then 'bank_order_approved' else 'bank_order_rejected' end,p_order::text,jsonb_build_object('reason',p_reason,'bank_reference',case when p_approve then lower(trim(p_bank_reference)) end,'points',item.points,'amount_kobo',item.amount_kobo));
 insert into public.notifications(user_id,title,body) values(item.user_id,case when p_approve then 'Payment approved' else 'Payment not approved' end,case when p_approve then item.points||' points have been added to your balance.' else 'Your transfer needs attention: '||trim(p_reason) end);
end$$;
create or replace function public.admin_save_point_package(p_id uuid,p_title text,p_points int,p_price_kobo int,p_active boolean,p_reason text) returns uuid
language plpgsql security definer set search_path=public as $$begin
 if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
 if p_id is null or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'ID and reason required'; end if;
 insert into public.point_packages(id,title,points,price_kobo,is_active) values(p_id,trim(p_title),p_points,p_price_kobo,p_active)
 on conflict(id) do update set title=excluded.title,points=excluded.points,price_kobo=excluded.price_kobo,is_active=excluded.is_active;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'point_package_saved',p_id::text,jsonb_build_object('reason',p_reason,'points',p_points,'price_kobo',p_price_kobo,'active',p_active));
 return p_id;
end$$;
create or replace function public.admin_save_managed_profile(p_id uuid,p_data jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path=public as $$
declare link jsonb; links jsonb; host_pattern text;
begin
 if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
 if p_id is null or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'ID and reason required'; end if;
 links:=coalesce(p_data->'social_links','[]');
 if jsonb_typeof(links)<>'array' or jsonb_array_length(links)>6 then raise exception 'Invalid social links'; end if;
 if (select count(distinct x->>'platform') from jsonb_array_elements(links) x)<>jsonb_array_length(links) then raise exception 'Duplicate platforms'; end if;
 for link in select * from jsonb_array_elements(links) loop
  host_pattern:=case link->>'platform' when 'whatsapp' then '^https://wa\.me/[0-9]{7,20}$' when 'instagram' then '^https://(www\.)?instagram\.com/' when 'snapchat' then '^https://(www\.)?snapchat\.com/' when 'tiktok' then '^https://(www\.)?tiktok\.com/' when 'facebook' then '^https://(www\.)?facebook\.com/' when 'x' then '^https://(www\.)?(x|twitter)\.com/' end;
  if host_pattern is null or link->>'url' is null or link->>'url' !~ host_pattern or length(link->>'url')>500 then raise exception 'Social URL must use the official HTTPS platform domain'; end if;
 end loop;
 if nullif(p_data->>'avatar_url','') is not null and p_data->>'avatar_url' !~ '^https://' then raise exception 'Photo URL must use HTTPS'; end if;
 insert into public.managed_profiles(id,username,display_name,bio,country,interests,avatar_url,social_links,is_public,created_by)
 values(p_id,p_data->>'username',trim(p_data->>'display_name'),p_data->>'bio',left(p_data->>'country',80),array(select jsonb_array_elements_text(coalesce(p_data->'interests','[]'))),nullif(p_data->>'avatar_url',''),links,(p_data->>'is_public')::boolean,auth.uid())
 on conflict(id) do update set username=excluded.username,display_name=excluded.display_name,bio=excluded.bio,country=excluded.country,interests=excluded.interests,avatar_url=excluded.avatar_url,social_links=excluded.social_links,is_public=excluded.is_public;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'managed_profile_saved',p_id::text,jsonb_build_object('reason',p_reason));
 return p_id;
end$$;
-- Buckets enforce MIME and size; receipt content remains private. No SVG uploads.
update storage.buckets set file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='avatars';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('bank-receipts','bank-receipts',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('managed-avatars','managed-avatars',true,5242880,array['image/jpeg','image/png','image/webp']);
drop policy "avatar own manage" on storage.objects;
create policy "avatar own manage" on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "managed photo read" on storage.objects for select using(bucket_id='managed-avatars');
create policy "managed photo upload" on storage.objects for insert to authenticated with check(bucket_id='managed-avatars' and public.admin_role()='super_admin' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "managed photo remove" on storage.objects for delete to authenticated using(bucket_id='managed-avatars' and public.admin_role()='super_admin' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "receipt upload" on storage.objects for insert to authenticated with check(bucket_id='bank-receipts' and exists(select 1 from public.bank_point_orders o where o.user_id=auth.uid() and o.status='awaiting_transfer' and name ~ ('^'||auth.uid()||'/'||o.id||'/[a-f0-9-]+\.(jpg|png|webp)$')));
create policy "receipt read" on storage.objects for select to authenticated using(bucket_id='bank-receipts' and ((storage.foldername(name))[1]=auth.uid()::text or public.admin_role() in ('super_admin','finance_admin')));
-- No receipt update/delete policies: submitted evidence cannot be swapped after review.
revoke all on function public.create_bank_point_order(uuid,uuid),public.submit_bank_point_order(uuid,text,text,text),public.cancel_bank_point_order(uuid),public.admin_review_bank_order(uuid,boolean,text,text),public.admin_save_point_package(uuid,text,int,int,boolean,text),public.admin_save_managed_profile(uuid,jsonb,text) from public,anon;
grant execute on function public.create_bank_point_order(uuid,uuid),public.submit_bank_point_order(uuid,text,text,text),public.cancel_bank_point_order(uuid),public.admin_review_bank_order(uuid,boolean,text,text),public.admin_save_point_package(uuid,text,int,int,boolean,text),public.admin_save_managed_profile(uuid,jsonb,text) to authenticated;

create or replace function public.admin_can(p_scope text) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(public.admin_role()='super_admin' or
 (public.admin_role()='moderator' and p_scope in ('overview','profiles','social_links','reports','reward_tasks')) or
 (public.admin_role()='finance_admin' and p_scope in ('overview','payment_transactions','subscriptions','promotions','points_ledger','points_balance','referrals','bank_point_orders')) or
 (public.admin_role()='support_agent' and p_scope in ('overview','profiles','reports','notifications')),false)
$$;

create or replace function public.admin_list(p_resource text,p_search text default '',p_status text default '',p_page int default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare tbl text; search_col text; status_col text; order_col text; clause text; result jsonb; total bigint;
begin
 if not public.admin_can(p_resource) then raise exception 'Permission denied' using errcode='42501'; end if;
 case p_resource
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

create or replace function public.admin_overview() returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; trend jsonb;
begin
 if not public.admin_can('overview') then raise exception 'Permission denied' using errcode='42501'; end if;
 select jsonb_agg(jsonb_build_object('day',d::date,'users',(select count(*) from public.profiles where created_at>=d and created_at<d+interval '1 day'))) into trend
 from generate_series(current_date-13,current_date,interval '1 day') d;
 result:=jsonb_build_object('profiles',(select count(*) from public.profiles),'social_links',(select count(*) from public.social_links),'open_reports',(select count(*) from public.reports where status='open'),'trend',trend,'refreshed_at',now());
 if public.admin_can('payment_transactions') then result:=result||jsonb_build_object('revenue_kobo',(select coalesce(sum(amount_kobo::bigint),0) from public.payment_transactions where status='verified'),'bank_revenue_kobo',(select coalesce(sum(amount_kobo::bigint),0) from public.bank_point_orders where status='approved'),'pending_bank_orders',(select count(*) from public.bank_point_orders where status='submitted'),'pending_payments',(select count(*) from public.payment_transactions where status='pending')); end if;
 return result;
end$$;


$stage9$;
 applied:=array_append(applied,9);
 raise notice 'Stage 9 applied';
 else raise exception 'Stage 9: unfamiliar or partial schema; no changes committed. Request owner review rather than removing guards.';
 end if;

 -- Stage 10: 010_member_programmes.sql
 if ((exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.require_active_account()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='71ac00b53724aadd20bbc4d663a3ab19' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_list(text, text, text, integer)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='9aafe5662f7db2ba6b2ccd2323bf44e9' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_mutate(text, text, jsonb, text, uuid)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='c2a1a5b6ab9ccfc790cfd2192b904dc6' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.apply_referral(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='87847b901267dbe4116b54ed5f48df78' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.claim_daily_checkin()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='d41702727176f9d67b7247087a87cc0f' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.ensure_member_balance()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='57d9b8e74acee053324002baa5a24bf6' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=false))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.consume_boost_bonus(integer)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='6b90d2a508b543b0a0a2340908099376' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=false))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.award_order_referral(uuid)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='8d6d6f57eea948055c5454c0a74a7349' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=false))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.activate_point_boost(uuid, uuid)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='58ebd5774fbbf7ce8a949779bcd2a2dc' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.member_overview()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='de2bb6e14fbe50d0cf991717b9b18709' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.member_referrals(integer)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='797bc126a30dcb8040f11300a76ee455' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_save_boost_plan(uuid, jsonb, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='38360f6083357f112a2331375d7848ec' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_save_site_settings(jsonb, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='04e930284d5f242864cf8c7234169e59' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.public_directory(text, text, text, text, integer)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='7bbefb8c1f75490909c32b9d996cff8a' and has_function_privilege('anon',p.oid,'execute')=true and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.claim_task(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='9ae5a1b570fcaf3a0a39e8c7477cf264' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_review_bank_order(uuid, boolean, text, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='48b4fab9df0556d1040737996af99f59' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_save_bank_details(jsonb, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='e00fd6581b3dccd8918e6d88f0f65df5' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_edit_profile(uuid, jsonb, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='68ed54ab271451cd286c4a901e071b10' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_edit_reward_task(uuid, jsonb, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='80c582c27f34dedb4458fb19bc317a57' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.guard_account_write()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='ea77c1179ac19c6aeed96a448daf84c3' and has_function_privilege('anon',p.oid,'execute')=true and has_function_privilege('authenticated',p.oid,'execute')=true))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_can(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='ed183602e48c30a8708d4520cbd13df9' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='cost_points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='multiplier' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='duration_hours' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='bonus_cap' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='order_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='referrer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='referred_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='percent' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='id' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='brand_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='hero_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='hero_description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='support_email' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='maintenance_mode' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='enabled_platforms' and udt_name='_text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='plan_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='plan_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='cost_points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='multiplier' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='bonus_cap' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='bonus_used' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='starts_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='expires_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from pg_policies where schemaname='public' and tablename='site_settings' and policyname='site settings read')
 and exists(select 1 from pg_policies where schemaname='public' and tablename='boost_plans' and policyname='active boosters read')
 and exists(select 1 from pg_policies where schemaname='public' and tablename='user_boosts' and policyname='own booster history')
 and exists(select 1 from pg_policies where schemaname='public' and tablename='referral_purchase_rewards' and policyname='own referral purchase rewards')
 and exists(select 1 from pg_class where oid=to_regclass('public.site_settings') and relrowsecurity)
 and exists(select 1 from pg_class where oid=to_regclass('public.boost_plans') and relrowsecurity)
 and exists(select 1 from pg_class where oid=to_regclass('public.user_boosts') and relrowsecurity)
 and exists(select 1 from pg_class where oid=to_regclass('public.referral_purchase_rewards') and relrowsecurity)) then
 raise notice 'Stage 10 verified; skipped';
 elsif (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.require_active_account()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='c9467cd2d60b8c3c538e9814dc4f1136' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_list(text, text, text, integer)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='c5ec424bebb91466b3a3efcb7d8cf2c7' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_mutate(text, text, jsonb, text, uuid)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='4a6cd3b5ff6dd74c58af69b297ed7d49' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.apply_referral(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='0e896cc7a5ef57d37440ce91a3a84fb8' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.claim_daily_checkin()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='a165137e1ae3ed794c471172fd9ab8d7' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 and to_regprocedure('public.ensure_member_balance()') is null
 and to_regprocedure('public.consume_boost_bonus(integer)') is null
 and to_regprocedure('public.award_order_referral(uuid)') is null
 and to_regprocedure('public.activate_point_boost(uuid, uuid)') is null
 and to_regprocedure('public.member_overview()') is null
 and to_regprocedure('public.member_referrals(integer)') is null
 and to_regprocedure('public.admin_save_boost_plan(uuid, jsonb, text)') is null
 and to_regprocedure('public.admin_save_site_settings(jsonb, text)') is null
 and to_regprocedure('public.public_directory(text, text, text, text, integer)') is null
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.claim_task(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='7914d17a7a4fe292806f0f5a86028f6e' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_review_bank_order(uuid, boolean, text, text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='291feaa72a449cf93c7f3f4179f7573f' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 and to_regprocedure('public.admin_save_bank_details(jsonb, text)') is null
 and to_regprocedure('public.admin_edit_profile(uuid, jsonb, text)') is null
 and to_regprocedure('public.admin_edit_reward_task(uuid, jsonb, text)') is null
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.guard_account_write()') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='8a82941803a53bfa06e20e58c97aac7f' and has_function_privilege('anon',p.oid,'execute')=true and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_can(text)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='7378ed5c089ec6ea87229262f898a9e0' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true)
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='actor_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='actor_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='action' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='target' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='meta' and udt_name='jsonb')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='package_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='package_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='amount_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='account_number' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='account_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='bank_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='payer_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='transfer_reference' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='receipt_path' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='bank_reference' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='reviewed_by' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='review_note' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='reviewed_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='submitted_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='id' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='account_number' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='account_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='bank_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='blocker_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='blocked_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='username' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='display_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='bio' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='country' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='interests' and udt_name='_text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='avatar_url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='social_links' and udt_name='jsonb')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='created_by' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='body' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='is_read' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='provider' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='reference' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='amount_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='verified_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='price_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='balance' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='current_streak' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='last_checkin' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='referral_code' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='referred_by' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='ref_key' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='viewer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='viewed_on' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='username' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='display_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='bio' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='country' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='interests' and udt_name='_text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_sponsored' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='price_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='item_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='transaction_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='referrer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='referred_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='rewarded' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reporter_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_config' and column_name='key' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_config' and column_name='value' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='slug' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='daily_limit' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='platform' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='plan' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='starts_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='expires_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='task_slug' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='claimed_on' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='count' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='role' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='created_at' and udt_name='timestamptz')
 and to_regclass('public.site_settings') is null
 and to_regclass('public.boost_plans') is null
 and to_regclass('public.user_boosts') is null
 and to_regclass('public.referral_purchase_rewards') is null) then
 execute $stage10$
-- Member workspace, configurable site content, referrals and bounded point boosters.

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


$stage10$;
 applied:=array_append(applied,10);
 raise notice 'Stage 10 applied';
 else raise exception 'Stage 10: unfamiliar or partial schema; no changes committed. Request owner review rather than removing guards.';
 end if;

 -- Stage 11: 011_bulk_managed_profiles.sql
 if ((exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.validate_managed_profile(jsonb)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='8975635650e864e1fa5fe20dab2ab884' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=false))
 and (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.admin_bulk_create_managed_profiles(uuid, jsonb, text, boolean)') and md5(replace(p.prosrc,E'\r\n',E'\n')||p.prosecdef::text||coalesce(p.proconfig::text,''))='5903d914358696e53c20abaf236728a5' and has_function_privilege('anon',p.oid,'execute')=false and has_function_privilege('authenticated',p.oid,'execute')=true))
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profile_batches' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profile_batches' and column_name='actor_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profile_batches' and column_name='payload_hash' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profile_batches' and column_name='result' and udt_name='jsonb')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profile_batches' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from pg_class where oid=to_regclass('public.managed_profile_batches') and relrowsecurity)) then
 raise notice 'Stage 11 verified; skipped';
 elsif (to_regprocedure('public.validate_managed_profile(jsonb)') is null
 and to_regprocedure('public.admin_bulk_create_managed_profiles(uuid, jsonb, text, boolean)') is null
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='actor_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='account_restrictions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='actor_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='action' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='target' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='meta' and udt_name='jsonb')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='package_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='package_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='amount_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='account_number' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='account_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='bank_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='payer_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='transfer_reference' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='receipt_path' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='bank_reference' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='reviewed_by' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='review_note' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='reviewed_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_point_orders' and column_name='submitted_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='id' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='account_number' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='account_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='bank_transfer_details' and column_name='bank_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='blocker_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='blocked_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='blocks' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='cost_points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='multiplier' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='duration_hours' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='bonus_cap' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='boost_plans' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='favourites' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='username' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='display_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='bio' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='country' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='interests' and udt_name='_text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='avatar_url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='social_links' and udt_name='jsonb')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='created_by' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='managed_profiles' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='body' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='is_read' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='provider' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='reference' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='amount_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name='verified_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='price_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='point_packages' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='balance' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='current_streak' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='last_checkin' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='referral_code' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_balance' and column_name='referred_by' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='ref_key' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='points_ledger' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='viewer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_views' and column_name='viewed_on' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='username' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='display_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='bio' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='country' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='interests' and udt_name='_text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_sponsored' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='price_kobo' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='promotions' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='item_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='transaction_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='purchases' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='order_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='referrer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='referred_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='percent' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referral_purchase_rewards' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='referrer_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='referred_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='referrals' and column_name='rewarded' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reporter_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reason' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_config' and column_name='key' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_config' and column_name='value' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='slug' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='daily_limit' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reward_tasks' and column_name='is_active' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='id' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='brand_name' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='hero_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='hero_description' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='support_email' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='maintenance_mode' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='enabled_platforms' and udt_name='_text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='profile_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='platform' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='url' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_links' and column_name='is_public' and udt_name='bool')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='plan' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='status' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='starts_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='expires_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='task_slug' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='claimed_on' and udt_name='date')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_claims' and column_name='count' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='plan_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='plan_title' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='cost_points' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='multiplier' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='bonus_cap' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='bonus_used' and udt_name='int4')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='starts_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='expires_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_boosts' and column_name='created_at' and udt_name='timestamptz')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='user_id' and udt_name='uuid')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='role' and udt_name='text')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_roles' and column_name='created_at' and udt_name='timestamptz')
 and to_regclass('public.managed_profile_batches') is null) then
 execute $stage11$
-- Additive: bounded, atomic, create-only managed listings. Never creates Auth users.

create table public.managed_profile_batches(
 id uuid primary key, actor_id uuid not null, payload_hash text not null,
 result jsonb not null, created_at timestamptz not null default now()
);
alter table public.managed_profile_batches enable row level security;
revoke all on public.managed_profile_batches from public,anon,authenticated;

create or replace function public.validate_managed_profile(p_data jsonb) returns void
language plpgsql set search_path=public as $$
declare link jsonb; item jsonb; pattern text; avatar text;
begin
 if jsonb_typeof(p_data) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('username','display_name','bio','country','interests','avatar_url','social_links','is_public')) then raise exception 'Invalid listing fields'; end if;
 if jsonb_typeof(p_data->'username') is distinct from 'string' or p_data->>'username' !~ '^[a-z0-9_]{3,24}$' then raise exception 'Invalid listing username'; end if;
 if jsonb_typeof(p_data->'display_name') is distinct from 'string' or length(trim(p_data->>'display_name')) not between 1 and 60 then raise exception 'Invalid display name'; end if;
 if jsonb_typeof(p_data->'is_public') is distinct from 'boolean' then raise exception 'Choose listing visibility'; end if;
 if p_data ? 'bio' and (jsonb_typeof(p_data->'bio') is distinct from 'string' or length(p_data->>'bio')>280) then raise exception 'Invalid bio'; end if;
 if p_data ? 'country' and (jsonb_typeof(p_data->'country') is distinct from 'string' or length(p_data->>'country')>80) then raise exception 'Invalid country'; end if;
 if jsonb_typeof(p_data->'interests') is distinct from 'array' or jsonb_array_length(p_data->'interests')>10 then raise exception 'Use at most ten interests'; end if;
 for item in select * from jsonb_array_elements(p_data->'interests') loop
 if jsonb_typeof(item)<>'string' or length(trim(item#>>'{}')) not between 1 and 40 then raise exception 'Invalid interest'; end if;
 end loop;
 avatar:=p_data->>'avatar_url';
 if avatar is not null and avatar<>'' and (length(avatar)>2048 or avatar !~ '^https://[A-Za-z0-9.-]+/[^[:space:]<>]*$') then raise exception 'Photo URL must use HTTPS'; end if;
 if jsonb_typeof(p_data->'social_links') is distinct from 'array' or jsonb_array_length(p_data->'social_links')>6 then raise exception 'Invalid social links'; end if;
 if (select count(distinct x->>'platform') from jsonb_array_elements(p_data->'social_links') x)<>jsonb_array_length(p_data->'social_links') then raise exception 'Duplicate platforms'; end if;
 for link in select * from jsonb_array_elements(p_data->'social_links') loop
 if jsonb_typeof(link) is distinct from 'object' or exists(select 1 from jsonb_object_keys(link) k where k not in ('platform','url','is_public')) or jsonb_typeof(link->'url') is distinct from 'string' or jsonb_typeof(link->'is_public') is distinct from 'boolean' then raise exception 'Invalid social link fields'; end if;
 pattern:=case link->>'platform'
 when 'whatsapp' then '^https://wa\.me/[0-9]{7,20}$'
 when 'instagram' then '^https://(www\.)?instagram\.com/[^[:space:]<>]+$'
 when 'snapchat' then '^https://(www\.)?snapchat\.com/[^[:space:]<>]+$'
 when 'tiktok' then '^https://(www\.)?tiktok\.com/[^[:space:]<>]+$'
 when 'facebook' then '^https://(www\.)?facebook\.com/[^[:space:]<>]+$'
 when 'x' then '^https://(www\.)?(x|twitter)\.com/[^[:space:]<>]+$' end;
 if pattern is null or link->>'url' !~ pattern or length(link->>'url')>500 then raise exception 'Social URL must use the official HTTPS platform domain'; end if;
 end loop;
end$$;
revoke all on function public.validate_managed_profile(jsonb) from public,anon,authenticated;

create or replace function public.admin_bulk_create_managed_profiles(p_batch uuid,p_rows jsonb,p_reason text,p_confirm boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare previous public.managed_profile_batches; fingerprint text; row_data jsonb; new_id uuid;
 ids jsonb:='[]'; result jsonb; row_number int:=0;
begin
 if auth.uid() is null or public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied' using errcode='42501'; end if;
 if p_confirm is distinct from true or p_batch is null or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Confirm permission and provide a reason'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 25 or octet_length(p_rows::text)>524288 then raise exception 'A batch must contain 1 to 25 listings'; end if;
 perform pg_advisory_xact_lock(hashtextextended('managed-batch:'||p_batch::text,0));
 fingerprint:=md5(p_rows::text||trim(p_reason));
 select * into previous from public.managed_profile_batches where id=p_batch;
 if found then
  if previous.actor_id<>auth.uid() or previous.payload_hash<>fingerprint then raise exception 'Batch reference already used with different details'; end if;
  return previous.result;
 end if;
 if (select count(distinct x->>'username') from jsonb_array_elements(p_rows) x)<>jsonb_array_length(p_rows) then raise exception 'Duplicate usernames in batch'; end if;
 -- Validate the whole batch first. Every insert/audit rolls back on any failure.
 for row_data in select * from jsonb_array_elements(p_rows) loop
  row_number:=row_number+1;
  begin
   perform public.validate_managed_profile(row_data);
   if exists(select 1 from public.managed_profiles where username=row_data->>'username') or exists(select 1 from public.profiles where username=row_data->>'username') then raise exception 'Username is already used'; end if;
  exception when others then raise exception 'Listing % is invalid: %',row_number,sqlerrm; end;
 end loop;
 for row_data in select * from jsonb_array_elements(p_rows) loop
  new_id:=gen_random_uuid();
  perform public.admin_save_managed_profile(new_id,row_data,p_reason);
  ids:=ids||jsonb_build_array(new_id);
 end loop;
 result:=jsonb_build_object('count',jsonb_array_length(p_rows),'ids',ids,'batch_id',p_batch);
 insert into public.managed_profile_batches(id,actor_id,payload_hash,result) values(p_batch,auth.uid(),fingerprint,result);
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'managed_profiles_bulk_created',p_batch::text,jsonb_build_object('reason',trim(p_reason),'count',jsonb_array_length(p_rows),'ids',ids));
 return result;
end$$;
revoke all on function public.admin_bulk_create_managed_profiles(uuid,jsonb,text,boolean) from public,anon;
grant execute on function public.admin_bulk_create_managed_profiles(uuid,jsonb,text,boolean) to authenticated;

$stage11$;
 applied:=array_append(applied,11);
 raise notice 'Stage 11 applied';
 else raise exception 'Stage 11: unfamiliar or partial schema; no changes committed. Request owner review rather than removing guards.';
 end if;
if cardinality(applied)>0 then insert into public.audit_logs(action,target,meta) values('owner_remaining_upgrade','schema',jsonb_build_object('stages',applied,'source','trusted_sql_editor')); end if;
end $recovery$;
commit;
select to_regprocedure('public.member_overview()') is not null as member_ready,
 to_regprocedure('public.admin_save_managed_profile(uuid,jsonb,text)') is not null as managed_profiles_ready,
 to_regprocedure('public.admin_bulk_create_managed_profiles(uuid,jsonb,text,boolean)') is not null as bulk_profiles_ready;
