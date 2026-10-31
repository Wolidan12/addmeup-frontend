-- Official launch: first 50 successfully awarded eligible accounts; fixed 5,000 DC each.
-- Requires staged economy migrations 016/017. No account, balance or earned history is reset.
begin;
create table public.launch_campaign(id boolean primary key default true check(id),is_active boolean not null default true,opened_at timestamptz not null default now());
insert into public.launch_campaign(id) values(true);
create table public.launch_awards(
 id uuid primary key default gen_random_uuid(),user_id uuid unique not null,slot smallint unique not null check(slot between 1 and 50),
 amount_dc numeric(20,2) not null default 5000 check(amount_dc=5000),awarded_at timestamptz not null default clock_timestamp(),
 activity_reference text unique not null
);
alter table public.launch_campaign enable row level security;alter table public.launch_awards enable row level security;
revoke all on public.launch_campaign,public.launch_awards from public,anon,authenticated,service_role;
grant select on public.launch_awards to authenticated;
-- Same required fields in eligibility responses and the UI. Linking a social account is NOT required.
create function public.launch_profile_complete(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select length(trim(display_name))>=2 and display_name<>'New creator' and length(trim(username))>=3 and length(trim(bio))>0 and length(trim(country))>0 and coalesce(length(trim(avatar_url)),0)>0 and cardinality(interests)>0 from public.profiles where id=p_user),false)
$$;
create function public.reward_account_verified(p_user uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from auth.users u where id=p_user and nullif(to_jsonb(u)->>'email_confirmed_at','') is not null and coalesce(nullif(to_jsonb(u)->>'banned_until','')::timestamptz,'-infinity')<=now() and nullif(to_jsonb(u)->>'deleted_at','') is null)
 and not exists(select 1 from public.account_restrictions where user_id=p_user)
$$;
create function public.reward_finance_access() returns boolean language sql stable security definer set search_path=public as $$select public.reward_account_verified(auth.uid()) and public.admin_can('points_ledger')$$;
revoke all on function public.reward_finance_access() from public,anon,authenticated,service_role;
grant execute on function public.reward_finance_access() to authenticated;
create policy "launch own or finance history" on public.launch_awards for select to authenticated using(user_id=auth.uid() or public.reward_finance_access());
create function public.award_launch_reward(p_user uuid) returns boolean language plpgsql security definer set search_path=public as $$declare campaign public.launch_campaign;awarded_count int;ref text;begin
 -- Serializes same-account claims and eligibility changes before taking the global campaign lock.
 perform 1 from public.profiles where id=p_user for update;
 if not found or not public.reward_account_verified(p_user) or not public.launch_profile_complete(p_user) then return false;end if;
 select * into campaign from public.launch_campaign where id for update;
 if not found then return false;end if;
 if exists(select 1 from public.launch_awards where user_id=p_user) then return true;end if;
 if not campaign.is_active then return false;end if;
 select count(*) into awarded_count from public.launch_awards;
 if awarded_count>=50 then return false;end if;
 ref:='launch:first50:'||p_user;
 insert into public.launch_awards(user_id,slot,activity_reference) values(p_user,awarded_count+1,ref);
 insert into public.points_balance(user_id,balance) values(p_user,5000) on conflict(user_id) do update set balance=public.points_balance.balance+5000;
 insert into public.points_ledger(user_id,points,reason,ref_key) values(p_user,5000,'Official launch reward: 5,000 DC',ref);
 insert into public.audit_logs(action,target,meta) values('launch_reward_awarded',p_user::text,jsonb_build_object('slot',awarded_count+1,'dc',5000,'reference',ref));
 return true;
end$$;
create function public.launch_eligibility_hook() returns trigger language plpgsql security definer set search_path=public as $$begin
 perform public.award_launch_reward(new.id);return new;
end$$;
create trigger launch_profile_eligibility after insert or update of display_name,username,bio,country,avatar_url,interests on public.profiles for each row execute function public.launch_eligibility_hook();
-- Read only trusted Auth columns, never user_metadata verification flags. Works with older Auth schemas too.
create trigger launch_verified_eligibility after update on auth.users for each row when ((to_jsonb(new)->>'email_confirmed_at') is distinct from (to_jsonb(old)->>'email_confirmed_at')) execute function public.launch_eligibility_hook();
create function public.launch_status() returns jsonb language plpgsql security definer set search_path=public as $$declare n int;campaign public.launch_campaign;mine public.launch_awards;begin
 select * into campaign from public.launch_campaign where id;select count(*) into n from public.launch_awards;
 select * into mine from public.launch_awards where user_id=auth.uid();
 return jsonb_build_object('status',case when n=50 then 'completed' when campaign.is_active then 'active' else 'paused' end,'total_slots',50,'reward_dc',5000,'awarded_count',n,'remaining_slots',50-n,'total_distributed_dc',n*5000,'maximum_distribution_dc',250000,'credits_expire',false,'opened_at',campaign.opened_at,
 'eligibility',jsonb_build_object('registered',auth.uid() is not null,'verified',public.reward_account_verified(auth.uid()),'profile_complete',public.launch_profile_complete(auth.uid()),'already_awarded',mine.id is not null),'award',case when mine.id is not null then to_jsonb(mine) else null end);
end$$;
create function public.claim_launch_reward() returns jsonb language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();if auth.uid() is null then raise exception 'Authentication required';end if;
 perform public.award_launch_reward(auth.uid());return public.launch_status();
end$$;
create function public.admin_launch_availability(p_active boolean,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();
 if public.admin_role() is distinct from 'super_admin' or not public.reward_account_verified(auth.uid()) then raise exception 'Permission denied';end if;
 if p_active is null or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Reason and campaign availability required';end if;
 update public.launch_campaign set is_active=p_active where id;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'launch_availability','first50',jsonb_build_object('active',p_active,'reason',trim(p_reason)));
end$$;
create function public.reward_history_immutable() returns trigger language plpgsql set search_path=public as $$begin raise exception 'Reward and XP award history is append-only';end$$;
revoke all on function public.reward_history_immutable() from public,anon,authenticated,service_role;
create trigger launch_awards_immutable before update or delete on public.launch_awards for each row execute function public.reward_history_immutable();
create trigger launch_awards_no_truncate before truncate on public.launch_awards for each statement execute function public.reward_history_immutable();
-- Reconcile pre-existing eligible accounts in deterministic registration order at campaign opening.
-- All 50 reservations and credits are in the migration transaction; any failure rolls back together.
do $$declare person record;begin
 for person in select p.id from public.profiles p join auth.users u on u.id=p.id where public.reward_account_verified(p.id) and public.launch_profile_complete(p.id) order by coalesce(nullif(to_jsonb(u)->>'created_at','')::timestamptz,p.created_at),p.id loop
  perform public.award_launch_reward(person.id);exit when (select count(*) from public.launch_awards)>=50;
 end loop;
end$$;
revoke all on function public.launch_profile_complete(uuid),public.reward_account_verified(uuid),public.award_launch_reward(uuid),public.launch_eligibility_hook(),public.launch_status(),public.claim_launch_reward(),public.admin_launch_availability(boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.launch_status() to anon,authenticated;
grant execute on function public.claim_launch_reward(),public.admin_launch_availability(boolean,text) to authenticated;
commit;
