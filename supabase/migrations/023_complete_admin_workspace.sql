-- Complete administration of existing systems. No Auth users/passwords or balance resets.
begin;
create or replace function public.admin_role() returns text language sql stable security definer set search_path=public as $$
 select case when r.role='admin' then 'super_admin' else r.role end from public.user_roles r where r.user_id=auth.uid() and public.reward_account_verified(r.user_id)
$$;
alter function public.admin_can(text) rename to admin_can_before_workspace;
revoke all on function public.admin_can_before_workspace(text) from public,anon,authenticated,service_role;
create function public.admin_can(p_scope text) returns boolean language sql stable security definer set search_path=public as $$select coalesce(public.admin_role()='super_admin' or public.admin_can_before_workspace(p_scope) or(public.admin_role()='moderator' and p_scope in ('member_connections','creator_progress')) or(public.admin_role()='support_agent' and p_scope in ('support_tickets','member_connections')) or(public.admin_role()='finance_admin' and p_scope in ('support_tickets','analytics','coupons')),false)$$;
create function public.admin_access() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('allowed',coalesce(public.admin_role() in ('super_admin','finance_admin','moderator','support_agent'),false),'role',public.admin_role(),'verified',public.reward_account_verified(auth.uid()),'restricted',exists(select 1 from public.account_restrictions where user_id=auth.uid()))$$;

create table public.support_tickets(id uuid primary key,user_id uuid references auth.users(id) on delete set null,subject text not null check(length(trim(subject)) between 3 and 120),category text not null check(category in ('account','payment','deposit_dispute','safety','other')),status text not null default 'open' check(status in ('open','investigating','awaiting_member','resolved')),body text not null check(length(trim(body)) between 8 and 4000),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.support_replies(id uuid primary key,ticket_id uuid not null references public.support_tickets(id),actor_id uuid not null,body text not null check(length(trim(body)) between 8 and 4000),created_at timestamptz not null default now());
create index support_queue on public.support_tickets(status,updated_at desc);
create table public.credit_coupons(id uuid primary key,code text unique not null check(code~'^[A-Z0-9_-]{12,40}$'),credits numeric(20,2) not null check(credits>0 and credits<=10000),max_redemptions int not null check(max_redemptions between 1 and 10000),redeemed int not null default 0 check(redeemed>=0 and redeemed<=max_redemptions),is_active boolean not null,expires_at timestamptz not null,created_by uuid not null,created_at timestamptz not null default now());
create table public.coupon_redemptions(id uuid primary key default gen_random_uuid(),coupon_id uuid not null references public.credit_coupons(id),user_id uuid not null,credits numeric(20,2) not null,created_at timestamptz not null default now(),unique(coupon_id,user_id));
do $$declare t text;begin foreach t in array array['support_tickets','support_replies','credit_coupons','coupon_redemptions'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);end loop;end$$;
create policy "own support tickets" on public.support_tickets for select to authenticated using(user_id=auth.uid());
create policy "own support replies" on public.support_replies for select to authenticated using(exists(select 1 from public.support_tickets t where t.id=ticket_id and t.user_id=auth.uid()));
create policy "own coupon redemptions" on public.coupon_redemptions for select to authenticated using(user_id=auth.uid());
grant select on public.support_tickets,public.support_replies,public.coupon_redemptions to authenticated;
create trigger immutable_support_replies before update or delete on public.support_replies for each row execute function public.reward_history_immutable();
create trigger immutable_support_replies_truncate before truncate on public.support_replies for each statement execute function public.reward_history_immutable();
create trigger immutable_coupon_redemptions before update or delete on public.coupon_redemptions for each row execute function public.reward_history_immutable();
create trigger immutable_coupon_redemptions_truncate before truncate on public.coupon_redemptions for each statement execute function public.reward_history_immutable();
create function public.create_support_ticket(p_id uuid,p_subject text,p_category text,p_body text) returns uuid language plpgsql security definer set search_path=public as $$declare prior public.support_tickets;begin
 perform public.require_active_account();if p_id is null then raise exception 'Request reference required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,23001));
 select * into prior from public.support_tickets where id=p_id;
 if found then if prior.user_id=auth.uid() and prior.subject=trim(p_subject) and prior.body=trim(p_body) and prior.category=p_category then return prior.id;end if;raise exception 'Ticket reference unavailable';end if;
 if(select count(*) from public.support_tickets where user_id=auth.uid() and created_at>now()-interval '24 hours')>=5 then raise exception 'Daily support request limit reached';end if;
 insert into public.support_tickets(id,user_id,subject,category,body) values(p_id,auth.uid(),trim(p_subject),p_category,trim(p_body));return p_id;
end$$;
create function public.support_reply(p_ticket uuid,p_request uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$declare prior public.support_replies;begin
 perform public.require_active_account();perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,23001));perform 1 from public.support_tickets where id=p_ticket and user_id=auth.uid() for update;if not found then raise exception 'Ticket unavailable';end if;
 select * into prior from public.support_replies where id=p_request;if found then if prior.actor_id=auth.uid() and prior.ticket_id=p_ticket and prior.body=trim(p_body) then return;end if;raise exception 'Reply reference unavailable';end if;
 if(select count(*) from public.support_replies where actor_id=auth.uid() and created_at>now()-interval '24 hours')>=20 then raise exception 'Daily reply limit reached';end if;
 insert into public.support_replies(id,ticket_id,actor_id,body) values(p_request,p_ticket,auth.uid(),trim(p_body));update public.support_tickets set status='open',updated_at=now() where id=p_ticket;
end$$;
create function public.admin_support_action(p_ticket uuid,p_request uuid,p_status text,p_reply text,p_reason text) returns void language plpgsql security definer set search_path=public as $$declare item public.support_tickets;prior public.support_replies;begin
 perform public.require_active_account();if not public.admin_can('support_tickets') then raise exception 'Permission denied';end if;
 if p_status is null or p_status not in ('open','investigating','awaiting_member','resolved') or p_reason is null or length(trim(p_reason)) not between 8 and 1000 or p_request is null then raise exception 'Status, reference and reason required';end if;
 select * into item from public.support_tickets where id=p_ticket for update;
 if not found or(public.admin_role()='finance_admin' and item.category not in ('payment','deposit_dispute')) then raise exception 'Ticket unavailable';end if;
 select * into prior from public.support_replies where id=p_request;if found then if prior.actor_id=auth.uid() and prior.ticket_id=p_ticket and prior.body=trim(p_reply) and exists(select 1 from public.audit_logs where actor_id=auth.uid() and target=p_ticket::text and meta->>'request_id'=p_request::text and meta->>'status'=p_status and meta->>'reason'=trim(p_reason)) then return;end if;raise exception 'Reply reference unavailable';end if;
 insert into public.support_replies(id,ticket_id,actor_id,body) values(p_request,p_ticket,auth.uid(),trim(p_reply));update public.support_tickets set status=p_status,updated_at=now() where id=p_ticket;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'support_ticket_updated',p_ticket::text,jsonb_build_object('reason',trim(p_reason),'before_status',item.status,'status',p_status,'request_id',p_request));
 if item.user_id is not null then insert into public.notifications(user_id,title,body,category,url,event_key) values(item.user_id,'Support request updated','Your support request has a new response. Open Support in the app.','account','/notifications','support-reply:'||p_request);end if;
end$$;
create function public.admin_save_coupon(p_id uuid,p_code text,p_credits numeric,p_limit int,p_active boolean,p_expires timestamptz,p_reason text) returns void language plpgsql security definer set search_path=public as $$declare prior public.credit_coupons;begin
 perform public.require_active_account();if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied';end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 or p_id is null or p_expires is null or p_expires<=now() or p_credits is null or p_credits<>round(p_credits,2) then raise exception 'Valid coupon configuration and reason required';end if;
 select * into prior from public.credit_coupons where id=p_id for update;
 if found and prior.redeemed>0 and(prior.code<>upper(trim(p_code)) or prior.credits<>p_credits) then raise exception 'Redeemed coupons retain their code and value';end if;
 insert into public.credit_coupons(id,code,credits,max_redemptions,is_active,expires_at,created_by) values(p_id,upper(trim(p_code)),p_credits,p_limit,p_active,p_expires,auth.uid()) on conflict(id) do update set code=excluded.code,credits=excluded.credits,max_redemptions=excluded.max_redemptions,is_active=excluded.is_active,expires_at=excluded.expires_at;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'credit_coupon_saved',p_id::text,jsonb_build_object('reason',trim(p_reason),'before',to_jsonb(prior),'credits',p_credits,'limit',p_limit));
end$$;
create function public.redeem_credit_coupon(p_code text) returns numeric language plpgsql security definer set search_path=public as $$declare coupon public.credit_coupons;prior public.coupon_redemptions;begin
 perform public.require_active_account();if not public.reward_account_verified(auth.uid()) then raise exception 'Verify your account before redeeming';end if;
 select * into coupon from public.credit_coupons where code=upper(trim(p_code)) for update;if not found then raise exception 'Coupon unavailable';end if;
 select * into prior from public.coupon_redemptions where coupon_id=coupon.id and user_id=auth.uid();if found then return prior.credits;end if;
 if not coupon.is_active or coupon.expires_at<=now() or coupon.redeemed>=coupon.max_redemptions or coupon.created_by=auth.uid() then raise exception 'Coupon unavailable';end if;
 insert into public.points_balance(user_id,balance) values(auth.uid(),coupon.credits) on conflict(user_id) do update set balance=public.points_balance.balance+coupon.credits;
 insert into public.points_ledger(user_id,points,reason,ref_key) values(auth.uid(),coupon.credits,'Authorized DC gift coupon','coupon:'||coupon.id||':'||auth.uid());
 insert into public.coupon_redemptions(coupon_id,user_id,credits) values(coupon.id,auth.uid(),coupon.credits);update public.credit_coupons set redeemed=redeemed+1 where id=coupon.id;
 return coupon.credits;
end$$;

create function public.admin_user_detail(p_user uuid,p_section text default 'profile',p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare rows jsonb;total bigint;clause text;tbl text;sort_col text;key_col text;begin
 perform public.require_active_account();if public.admin_role() is null or public.admin_role()='user' then raise exception 'Permission denied';end if;
 if p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid page';end if;
 if p_section='profile' then
  return(select jsonb_build_object('profile',to_jsonb(p),'account',jsonb_build_object('id',u.id,'email',u.email,'email_confirmed',nullif(to_jsonb(u)->>'email_confirmed_at','') is not null,'last_sign_in_at',to_jsonb(u)->>'last_sign_in_at','banned_until',to_jsonb(u)->>'banned_until','role',(select role from public.user_roles where user_id=u.id),'restriction',(select to_jsonb(r) from public.account_restrictions r where user_id=u.id)),'eligibility',jsonb_build_object('verified',public.reward_account_verified(u.id),'profile_complete',public.launch_profile_complete(u.id),'launch_award',(select to_jsonb(a) from public.launch_awards a where user_id=u.id))) from public.profiles p join auth.users u on u.id=p.id where p.id=p_user);
 elsif p_section='social' then if not public.admin_can('social_links') then raise exception 'Permission denied';end if;tbl:='social_links';key_col:='profile_id';sort_col:='id';
 elsif p_section='wallet' then
  if not public.admin_can('points_ledger') then raise exception 'Permission denied';end if;
  return jsonb_build_object('balance',coalesce((select balance from public.points_balance where user_id=p_user),0),'rows',coalesce((select jsonb_agg(to_jsonb(r)) from(select * from public.dc_transactions where user_id=p_user order by sequence desc limit 25 offset p_page*25)r),'[]'),'total',(select count(*) from public.dc_transactions where user_id=p_user));
 elsif p_section='deposits' then if not public.admin_can('points_ledger') then raise exception 'Permission denied';end if;tbl:='bank_point_orders';key_col:='user_id';sort_col:='created_at';
 elsif p_section='connections' then if not public.admin_can('member_connections') then raise exception 'Permission denied';end if;tbl:='member_connections';key_col:='user_id';sort_col:='created_at';
 elsif p_section='referrals' then if not public.admin_can('profiles') and not public.admin_can('referrals') then raise exception 'Permission denied';end if;tbl:='referrals';key_col:='referrer_id';sort_col:='created_at';
 elsif p_section='missions' then if public.admin_role()<>'super_admin' then raise exception 'Permission denied';end if;tbl:='mission_submissions';key_col:='user_id';sort_col:='submitted_at';
 elsif p_section='support' then if not public.admin_can('support_tickets') then raise exception 'Permission denied';end if;tbl:='support_tickets';key_col:='user_id';sort_col:='created_at';
 else raise exception 'Unsupported profile section';end if;
 clause:=case when p_section='connections' then ' where (user_id=$1 or profile_id=$1)' when p_section='referrals' then ' where (referrer_id=$1 or referred_id=$1)' else format(' where %I=$1',key_col) end;if p_section='support' and public.admin_role()='finance_admin' then clause:=clause||' and category in (''payment'',''deposit_dispute'')';end if;
 execute format('select count(*) from public.%I',tbl)||clause into total using p_user;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]'') from(select * from public.%I',tbl)||clause||format(' order by %I desc limit 25 offset $2)r',sort_col) into rows using p_user,p_page*25;return jsonb_build_object('rows',rows,'total',total);
end$$;

alter function public.admin_list(text,text,text,int) rename to admin_list_before_workspace;
revoke all on function public.admin_list_before_workspace(text,text,text,int) from public,anon,authenticated,service_role;
create function public.admin_list(p_resource text,p_search text default '',p_status text default '',p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;rows jsonb;total bigint;table_name text;search_expr text;clause text;begin
 perform public.require_active_account();if public.admin_role() is null or public.admin_role()='user' then raise exception 'Permission denied';end if;
 if p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid page';end if;
 if p_resource in ('profiles','creator_progress') then
  if (p_resource='profiles' and not public.admin_can('profiles') and public.admin_role()<>'finance_admin') or (p_resource='creator_progress' and not public.admin_can('creator_progress')) then raise exception 'Permission denied';end if;
  with matching as(select p.*,(p.id=auth.uid()) is_self,(select role from public.user_roles where user_id=p.id) staff_role,u.email,nullif(to_jsonb(u)->>'email_confirmed_at','') is not null email_confirmed,to_jsonb(u)->>'last_sign_in_at' last_sign_in_at,exists(select 1 from public.account_restrictions x where x.user_id=p.id) suspended,(select title from public.creator_ranks where min_xp<=p.creator_xp order by min_xp desc limit 1) creator_rank from public.profiles p join auth.users u on u.id=p.id where concat_ws(' ',p.username,p.display_name,u.email,p.id::text) ilike '%'||left(coalesce(p_search,''),200)||'%' and(coalesce(p_status,'')='' or(p_status='verified' and nullif(to_jsonb(u)->>'email_confirmed_at','') is not null) or(p_status='unverified' and nullif(to_jsonb(u)->>'email_confirmed_at','') is null) or(p_status='suspended' and exists(select 1 from public.account_restrictions x where x.user_id=p.id))))
  select(select count(*) from matching),(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from(select * from matching order by created_at desc,id desc limit 25 offset p_page*25)r) into total,rows;return jsonb_build_object('total',total,'rows',rows);
 elsif p_resource in ('member_connections','support_tickets','coupons','social_platforms') then
  if not public.admin_can(p_resource) then raise exception 'Permission denied';end if;
  if p_resource='member_connections' then
   with matching as(select c.*,p.username connected_username,u.username member_username from public.member_connections c join public.profiles p on p.id=c.profile_id join public.profiles u on u.id=c.user_id where concat_ws(' ',p.username,u.username,c.user_id::text) ilike '%'||left(coalesce(p_search,''),200)||'%')
   select(select count(*) from matching),(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from(select * from matching order by created_at desc,user_id,profile_id limit 25 offset p_page*25)r) into total,rows;return jsonb_build_object('total',total,'rows',rows);
  end if;
  table_name:=case p_resource when 'coupons' then 'credit_coupons' else p_resource end;
  search_expr:=case p_resource when 'coupons' then 'code' when 'social_platforms' then 'label' else 'concat_ws('' '',subject,user_id::text,id::text)' end;
  clause:=' where '||search_expr||' ilike $1';if p_resource='support_tickets' then clause:=clause||' and($2='''' or status=$2)';if public.admin_role()='finance_admin' then clause:=clause||' and category in (''payment'',''deposit_dispute'')';end if;end if;
  execute format('select count(*) from public.%I',table_name)||clause into total using '%'||left(coalesce(p_search,''),200)||'%',coalesce(p_status,'');
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]'') from(select * from public.%I',table_name)||clause||' order by '||case when p_resource='social_platforms' then 'key' else 'created_at desc,id desc' end||' limit 25 offset $3)r' into rows using '%'||left(coalesce(p_search,''),200)||'%',coalesce(p_status,''),p_page*25;return jsonb_build_object('rows',rows,'total',total);
 elsif p_resource='analytics' then if not public.admin_can('analytics') then raise exception 'Permission denied';end if;return jsonb_build_object('rows','[]'::jsonb,'total',0);
 end if;
 return public.admin_list_before_workspace(p_resource,p_search,p_status,p_page);
end$$;

create function public.admin_metrics(p_days int default 30) returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;finance boolean;begin
 perform public.require_active_account();if not public.admin_can('overview') then raise exception 'Permission denied';end if;
 if p_days is null or p_days not in (14,30,90) then raise exception 'Invalid reporting window';end if;
 finance:=public.admin_can('points_ledger');
 result:=jsonb_build_object('total_users',(select count(*) from auth.users),'verified_users',(select count(*) from auth.users u where nullif(to_jsonb(u)->>'email_confirmed_at','') is not null),'active_users_30d',(select count(*) from auth.users u where nullif(to_jsonb(u)->>'last_sign_in_at','')::timestamptz>=now()-interval '30 days' and public.reward_account_verified(u.id)),'registrations_7d',(select count(*) from public.profiles where created_at>=now()-interval '7 days'),'pending_reports',(select count(*) from public.reports where status='open'),'active_promotions',(select count(*) from public.promotion_campaigns c where public.promotion_status(c)='active'),'launch_slots_remaining',50-(select count(*) from public.launch_awards),'launch_awarded',(select count(*) from public.launch_awards),'launch_distributed_dc',(select coalesce(sum(amount_dc),0) from public.launch_awards),'pending_support',(select count(*) from public.support_tickets where status<>'resolved' and(public.admin_role()<>'finance_admin' or category in ('payment','deposit_dispute'))),'registration_series',(select jsonb_agg(jsonb_build_object('day',d.day::date,'users',(select count(*) from public.profiles where (created_at at time zone 'UTC')::date=d.day::date))) from generate_series((now() at time zone 'UTC')::date-(p_days-1),(now() at time zone 'UTC')::date,interval '1 day')d(day)));
 if finance then result:=result||jsonb_build_object('dc_issued',(select coalesce(sum(credit_amount),0) from public.dc_transactions where credit_amount>0 and transaction_type not in ('refund','opening_balance')),'dc_spent',(select -coalesce(sum(credit_amount),0) from public.dc_transactions where credit_amount<0 and transaction_type='spend'),'dc_purchased',(select coalesce(sum(points),0) from public.points_ledger where points>0 and(ref_key like 'bank-order:%' or ref_key like 'provider:%')),'deposit_gross_kobo',(select coalesce(sum(amount_kobo),0) from public.bank_point_orders where status in ('approved','refunded'))+(select coalesce(sum(amount_kobo),0) from public.payment_transactions where status in ('verified','refunded') and purpose='growth_credits'),'deposit_refunds_kobo',(select coalesce(sum(amount_kobo),0) from public.bank_point_orders where status='refunded')+(select coalesce(sum(amount_kobo),0) from public.payment_transactions where status='refunded' and purpose='growth_credits'),'successful_payments',(select count(*) from public.bank_point_orders where status='approved')+(select count(*) from public.payment_transactions where status='verified'),'pending_payments',(select count(*) from public.bank_point_orders where status in ('awaiting_transfer','submitted'))+(select count(*) from public.payment_transactions where status='pending'),'failed_payments',(select count(*) from public.bank_point_orders where status='rejected')+(select count(*) from public.payment_transactions where status='failed'));end if;
 if public.admin_role()='super_admin' then result:=result||jsonb_build_object('recent_admin_activity',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from(select id,actor_id,action,target,created_at,meta->>'reason' reason from public.audit_logs order by created_at desc,id desc limit 12)r));end if;
 return result;
end$$;
alter function public.admin_overview() rename to admin_overview_before_workspace;
revoke all on function public.admin_overview_before_workspace() from public,anon,authenticated,service_role;
create function public.admin_overview() returns jsonb language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();if not public.admin_can('overview') then raise exception 'Permission denied';end if;
 return public.admin_overview_before_workspace()||jsonb_build_object('workspace_metrics',public.admin_metrics(30));
end$$;

-- Add scheduling to the existing reviewed mission workflow, without allowing clients to weaken verification.
alter function public.admin_save_mission(uuid,jsonb,text) rename to admin_save_mission_before_workspace;
revoke all on function public.admin_save_mission_before_workspace(uuid,jsonb,text) from public,anon,authenticated,service_role;
create function public.admin_save_mission(p_id uuid,p_data jsonb,p_reason text) returns uuid language plpgsql security definer set search_path=public as $$declare identifier uuid;starts timestamptz;begin
 identifier:=public.admin_save_mission_before_workspace(p_id,p_data,p_reason);
 if p_data ? 'starts_at' then starts:=nullif(p_data->>'starts_at','')::timestamptz;if starts is null then raise exception 'Mission start date required';end if;update public.missions set starts_at=starts where id=identifier;end if;
 if exists(select 1 from public.missions where id=identifier and deadline<starts_at) then raise exception 'Deadline must be after start';end if;return identifier;
end$$;
create function public.admin_support_thread(p_ticket uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare t public.support_tickets;begin
 perform public.require_active_account();if not public.admin_can('support_tickets') then raise exception 'Permission denied';end if;
 select * into t from public.support_tickets where id=p_ticket;if not found or(public.admin_role()='finance_admin' and t.category not in ('payment','deposit_dispute')) then raise exception 'Ticket unavailable';end if;
 return jsonb_build_object('ticket',to_jsonb(t),'replies',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from(select * from public.support_replies where ticket_id=p_ticket order by created_at desc,id desc limit 100)r));
end$$;
-- Serialize role/restriction changes and re-check the acting account after acquiring the lock.
alter function public.admin_mutate(text,text,jsonb,text,uuid) rename to admin_mutate_before_workspace;
revoke all on function public.admin_mutate_before_workspace(text,text,jsonb,text,uuid) from public,anon,authenticated,service_role;
create function public.admin_mutate(p_action text,p_target text,p_value jsonb default '{}'::jsonb,p_reason text default '',p_request uuid default gen_random_uuid()) returns void language plpgsql security definer set search_path=public as $$begin
 if p_action in ('set_role','restrict','reactivate') then
  perform pg_advisory_xact_lock(23002);perform public.require_active_account();
  if p_action='restrict' and p_target::uuid=auth.uid() then raise exception 'Cannot restrict your own administrative account';end if;
  if p_action='restrict' and public.admin_role()<>'super_admin' and exists(select 1 from public.user_roles where user_id=p_target::uuid and role not in ('user')) then raise exception 'Only Super Admin can restrict staff';end if;
 end if;
 perform public.admin_mutate_before_workspace(p_action,p_target,p_value,p_reason,p_request);
end$$;
-- Keep raw client writes denied; every sensitive change uses existing/new audited RPCs.
do $$declare signature regprocedure;begin foreach signature in array array['public.admin_mutate(text,text,jsonb,text,uuid)'::regprocedure,'public.admin_can(text)'::regprocedure,'public.admin_access()'::regprocedure,'public.create_support_ticket(uuid,text,text,text)'::regprocedure,'public.support_reply(uuid,uuid,text)'::regprocedure,'public.admin_support_action(uuid,uuid,text,text,text)'::regprocedure,'public.admin_save_coupon(uuid,text,numeric,int,boolean,timestamptz,text)'::regprocedure,'public.redeem_credit_coupon(text)'::regprocedure,'public.admin_user_detail(uuid,text,int)'::regprocedure,'public.admin_list(text,text,text,int)'::regprocedure,'public.admin_metrics(int)'::regprocedure,'public.admin_overview()'::regprocedure,'public.admin_save_mission(uuid,jsonb,text)'::regprocedure,'public.admin_support_thread(uuid)'::regprocedure] loop execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);execute format('grant execute on function %s to authenticated',signature);end loop;end$$;
commit;
