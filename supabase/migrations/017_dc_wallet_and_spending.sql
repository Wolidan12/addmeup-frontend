begin;
create table public.dc_products(id uuid primary key default gen_random_uuid(),slug text unique not null,title text not null check(length(trim(title)) between 1 and 80),description text not null default '',cost_dc numeric(20,2) check(cost_dc>0 and cost_dc<=1000000),is_active boolean not null default false,check(not is_active or cost_dc is not null));
insert into public.dc_products(slug,title,description) values
('profile_spotlight','Profile Spotlight','Request a Spotlight placement. Staff must confirm eligibility and fulfilment.'),('profile_visibility_boost','Profile Visibility Boost','Request a visibility placement; no follower or reach guarantees.'),('featured_profile','Featured Profile placement','A staff-reviewed featured placement.'),('social_media_promotion','Social Media Promotions','Submit a promotion for eligibility and content review.'),('premium_profile_badge','Premium Profile Badge','A premium cosmetic badge, never an identity-verification badge.'),('creator_campaign','Eligible creator campaign','Premium campaign participation subject to staff eligibility review.');
create table public.dc_orders(id uuid primary key,user_id uuid not null,product_id uuid not null references public.dc_products(id),product_title text not null,cost_dc numeric(20,2) not null check(cost_dc>0),status text not null default 'pending_fulfillment' check(status in ('pending_fulfillment','completed','refunded')),request_details text not null check(length(trim(request_details)) between 8 and 1000),fulfillment_note text,created_at timestamptz not null default now(),reviewed_at timestamptz);
create index dc_orders_owner on public.dc_orders(user_id,created_at desc);
alter table public.dc_products enable row level security;alter table public.dc_orders enable row level security;
create policy "DC products read" on public.dc_products for select using(true);
create policy "own DC orders read" on public.dc_orders for select to authenticated using(user_id=auth.uid() or public.admin_can('points_ledger'));
revoke all on public.dc_products,public.dc_orders from public,anon,authenticated;
grant select on public.dc_products to anon,authenticated;grant select on public.dc_orders to authenticated;
create function public.dc_spend(p_product uuid,p_request uuid,p_details text) returns uuid language plpgsql security definer set search_path=public as $$declare product public.dc_products;prior public.dc_orders;begin
 perform public.require_active_account();
 if p_request is null or p_details is null or length(trim(p_details)) not between 8 and 1000 then raise exception 'Provide request details and a request ID';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,16));
 select * into prior from public.dc_orders where id=p_request;
 if found then if prior.user_id is distinct from auth.uid() or prior.product_id<>p_product or prior.request_details<>trim(p_details) then raise exception 'Request reference is already used';end if;return prior.id;end if;
 if not (select spending_enabled from public.dc_settings where id) then raise exception 'DC spending is currently paused';end if;
 select * into product from public.dc_products where id=p_product and is_active for share;
 if not found then raise exception 'This premium feature is unavailable';end if;
 perform public.ensure_member_balance();
 update public.points_balance set balance=balance-product.cost_dc where user_id=auth.uid() and balance>=product.cost_dc;
 if not found then raise exception 'Not enough points';end if;
 insert into public.dc_orders(id,user_id,product_id,product_title,cost_dc,request_details) values(p_request,auth.uid(),product.id,product.title,product.cost_dc,trim(p_details));
 insert into public.points_ledger(user_id,points,reason,ref_key) values(auth.uid(),-product.cost_dc,'Premium request: '||product.title,'dc-spend:'||p_request);
 return p_request;
end$$;
create function public.admin_dc_review_order(p_order uuid,p_complete boolean,p_reason text) returns void language plpgsql security definer set search_path=public as $$declare item public.dc_orders;begin
 if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied';end if;
 if p_complete is null or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Provide a fulfilment or refund reason';end if;
 select * into item from public.dc_orders where id=p_order for update;
 if not found then raise exception 'Request not found';end if;
 if item.status=(case when p_complete then 'completed' else 'refunded' end) then return;end if;
 if item.status<>'pending_fulfillment' then raise exception 'This request has already been reviewed';end if;
 if not exists(select 1 from auth.users where id=item.user_id) then raise exception 'Account was deleted; resolve retention and reconciliation before review';end if;
 if not p_complete then
  insert into public.points_balance(user_id,balance) values(item.user_id,item.cost_dc) on conflict(user_id) do update set balance=public.points_balance.balance+item.cost_dc;
  insert into public.points_ledger(user_id,points,reason,ref_key) values(item.user_id,item.cost_dc,'Refund: '||item.product_title,'dc-refund:'||item.id);
 end if;
 update public.dc_orders set status=case when p_complete then 'completed' else 'refunded' end,fulfillment_note=trim(p_reason),reviewed_at=now() where id=item.id;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),case when p_complete then 'dc_request_fulfilled' else 'dc_request_refunded' end,item.id::text,jsonb_build_object('reason',trim(p_reason),'cost_dc',item.cost_dc));
end$$;
create function public.admin_dc_configure(p_product uuid,p_cost numeric,p_active boolean,p_deposits boolean,p_spending boolean,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied';end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Reason required';end if;
 if p_product is not null then
  if p_active is null or (p_cost is not null and (p_cost<>round(p_cost,2) or p_cost<=0 or p_cost>1000000)) then raise exception 'Use a positive price with at most two decimal places';end if;
  update public.dc_products set cost_dc=p_cost,is_active=p_active where id=p_product;
  if not found then raise exception 'Feature not found';end if;
 else
  if p_deposits is null or p_spending is null then raise exception 'Provide deposit and spending states';end if;
  update public.dc_settings set deposits_enabled=p_deposits,spending_enabled=p_spending where id;
 end if;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'dc_configuration_saved',coalesce(p_product::text,'economy'),jsonb_build_object('cost_dc',p_cost,'active',p_active,'deposits',p_deposits,'spending',p_spending,'reason',trim(p_reason),'naira_per_dc',1,'withdrawals_enabled',false));
end$$;
-- Capture a known request-time balance for attempts. Pending/failed requests never move credits.
alter table public.bank_point_orders add column balance_at_request numeric(20,2);
alter table public.payment_transactions add column balance_at_request numeric(20,2);
create function public.dc_request_snapshot() returns trigger language plpgsql security definer set search_path=public as $$begin
 if not (select deposits_enabled from public.dc_settings where id) then raise exception 'DC deposits are currently paused';end if;
 select balance into new.balance_at_request from public.points_balance where user_id=new.user_id for share;
 new.balance_at_request:=coalesce(new.balance_at_request,0);return new;
end$$;
create trigger dc_bank_request_snapshot before insert on public.bank_point_orders for each row execute function public.dc_request_snapshot();
create trigger dc_provider_request_snapshot before insert on public.payment_transactions for each row execute function public.dc_request_snapshot();
create function public.dc_wallet(p_kind text default 'transactions',p_status text default '',p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare records jsonb;total bigint;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_kind not in ('transactions','deposits') or p_status not in ('','pending','successful','failed','cancelled') or p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid wallet filter';end if;
 with entries as (
  select t.id::text id,t.transaction_reference,t.transaction_type,t.credit_amount,t.previous_balance,t.new_balance,t.status,t.description,t.activity_reference,t.snapshot_origin,t.created_at from public.dc_transactions t where t.user_id=auth.uid() and (p_kind='transactions' or t.transaction_type='deposit')
  union all
  select b.id::text,'BANK-'||b.id,'deposit_attempt',0,b.balance_at_request,b.balance_at_request,case when b.status in ('awaiting_transfer','submitted') then 'pending' when b.status='rejected' then 'failed' else 'cancelled' end,'Bank deposit request: '||b.amount_kobo::numeric/100||' DC','bank-order:'||b.id,'request',b.created_at from public.bank_point_orders b where b.user_id=auth.uid() and b.status<>'approved'
  union all
  select p.id::text,p.reference,'deposit_attempt',0,p.balance_at_request,p.balance_at_request,case when p.status='pending' then 'pending' else 'failed' end,'Provider deposit request: '||p.amount_kobo::numeric/100||' DC','provider:'||p.reference,'request',p.created_at from public.payment_transactions p where p.user_id=auth.uid() and p.purpose='growth_credits' and p.status<>'verified'
 ), filtered as(select * from entries where p_status='' or status=p_status), paged as(select * from filtered order by created_at desc,id desc limit 20 offset p_page*20)
 select (select count(*) from filtered),(select coalesce(jsonb_agg(to_jsonb(paged)),'[]') from paged) into total,records;
 return jsonb_build_object('balance',coalesce((select balance from public.points_balance where user_id=auth.uid()),0),'rows',records,'total',total,'pending',(select count(*) from public.bank_point_orders where user_id=auth.uid() and status in ('awaiting_transfer','submitted'))+(select count(*) from public.payment_transactions where user_id=auth.uid() and purpose='growth_credits' and status='pending'),'successful',(select count(*) from public.dc_transactions where user_id=auth.uid() and status='successful'),'failed',(select count(*) from public.bank_point_orders where user_id=auth.uid() and status='rejected')+(select count(*) from public.payment_transactions where user_id=auth.uid() and purpose='growth_credits' and status='failed'));
end$$;
alter function public.activate_point_boost(uuid,uuid) rename to activate_point_boost_before_dc;
revoke all on function public.activate_point_boost_before_dc(uuid,uuid) from public,anon,authenticated;
create function public.activate_point_boost(p_plan uuid,p_request uuid) returns uuid language plpgsql security definer set search_path=public as $$begin
 if not (select spending_enabled from public.dc_settings where id) then raise exception 'DC spending is currently paused';end if;
 return public.activate_point_boost_before_dc(p_plan,p_request);
end$$;
revoke all on function public.activate_point_boost(uuid,uuid) from public,anon;
grant execute on function public.activate_point_boost(uuid,uuid) to authenticated;
-- Failure is a provider-confirmed request state, never a wallet movement.
create function public.record_verified_payment_failure(p_reference text,p_amount bigint,p_currency text,p_email text,p_provider_id text) returns boolean language plpgsql security definer set search_path=public as $$declare payment public.payment_transactions;customer text;begin
 select * into payment from public.payment_transactions where reference=p_reference for update;
 if not found then raise exception 'Unknown payment reference';end if;
 select email into customer from auth.users where id=payment.user_id;
 if payment.provider is distinct from 'paystack' or p_currency is distinct from 'NGN' or p_amount is distinct from payment.amount_kobo::bigint or p_amount<=0 or customer is null or p_email is null or lower(customer) is distinct from lower(p_email) or nullif(trim(p_provider_id),'') is null or length(p_provider_id)>120 then raise exception 'Provider details do not match payment';end if;
 if payment.status='failed' and payment.provider_transaction_id=p_provider_id then return true;end if;
 if payment.status<>'pending' then raise exception 'Payment is not pending';end if;
 update public.payment_transactions set status='failed',provider_transaction_id=p_provider_id where id=payment.id;
 insert into public.audit_logs(action,target,meta) values('provider_payment_failed',payment.id::text,jsonb_build_object('provider','paystack','provider_id',p_provider_id));return true;
end$$;
revoke all on function public.record_verified_payment_failure(text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.record_verified_payment_failure(text,bigint,text,text,text) to service_role;
-- A zero-value check-in is a paused reward, not a fictitious financial transaction.
alter function public.claim_daily_checkin() rename to claim_daily_checkin_before_dc;
revoke all on function public.claim_daily_checkin_before_dc() from public,anon,authenticated;
create function public.claim_daily_checkin() returns text language plpgsql security definer set search_path=public as $$begin
 if coalesce((select value from public.reward_config where key='daily_checkin_points'),0)<=0 then raise exception 'Daily rewards paused';end if;
 return replace(public.claim_daily_checkin_before_dc(),' pts',' DC');
end$$;
revoke all on function public.claim_daily_checkin() from public,anon;
grant execute on function public.claim_daily_checkin() to authenticated;
alter function public.admin_list(text,text,text,int) rename to admin_list_before_dc;
revoke all on function public.admin_list_before_dc(text,text,text,int) from public,anon,authenticated;
create function public.admin_list(p_resource text,p_search text default '',p_status text default '',p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare records jsonb;total bigint;term text;begin
 if p_resource not in ('dc_transactions','dc_orders') then return public.admin_list_before_dc(p_resource,p_search,p_status,p_page);end if;
 if not public.admin_can('points_ledger') then raise exception 'Permission denied';end if;
 term:=case when p_resource='dc_transactions' then 'transaction_reference' else 'product_title' end;
 execute format('select count(*) from public.%I where %I ilike $1 and ($2='''' or status=$2)',p_resource,term) into total using '%'||left(coalesce(p_search,''),120)||'%',coalesce(p_status,'');
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select * from public.%I where %I ilike $1 and ($2='''' or status=$2) order by created_at desc,id desc limit 25 offset $3) r',p_resource,term) into records using '%'||left(coalesce(p_search,''),120)||'%',coalesce(p_status,''),greatest(0,least(coalesce(p_page,0),100000))*25;
 return jsonb_build_object('total',total,'rows',records);
end$$;
revoke all on function public.dc_spend(uuid,uuid,text),public.admin_dc_review_order(uuid,boolean,text),public.admin_dc_configure(uuid,numeric,boolean,boolean,boolean,text),public.dc_wallet(text,text,int),public.admin_list(text,text,text,int) from public,anon;
grant execute on function public.dc_spend(uuid,uuid,text),public.admin_dc_review_order(uuid,boolean,text),public.admin_dc_configure(uuid,numeric,boolean,boolean,boolean,text),public.dc_wallet(text,text,int),public.admin_list(text,text,text,int) to authenticated;
revoke all on function public.dc_request_snapshot() from public,anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.dc_settings,public.dc_transactions,public.dc_products,public.dc_orders,public.points_balance,public.points_ledger,public.payment_transactions,public.bank_point_orders,public.point_packages from public,anon,authenticated;
grant insert(user_id,provider,reference,amount_kobo) on public.payment_transactions to authenticated;
revoke all on all sequences in schema public from anon,authenticated;
commit;
