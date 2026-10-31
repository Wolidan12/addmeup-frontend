-- GENERATED; review with MIGRATION_RECONCILIATION.md. NOT EXECUTED.
-- Register ONE new forward migration named reconcile_016_023_after_024, not fake historical versions.
-- Operator must provide recovery evidence via transaction-local session settings in the SAME trusted session.
-- Settings are an execution attestation, not independent proof of backup availability.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
select pg_advisory_xact_lock(24016023);
lock table auth.users,public.profiles,public.points_balance,public.points_ledger in share row exclusive mode;
do $$begin
 if current_setting('danqel.recovery_verified',true) is distinct from 'yes' or length(coalesce(current_setting('danqel.backup_reference',true),''))<3 or length(coalesce(current_setting('danqel.restore_owner',true),''))<3 then raise exception 'STOP: recent backup and restore owner evidence required';end if;
 if nullif(current_setting('danqel.backup_verified_at',true),'')::timestamptz is null or nullif(current_setting('danqel.backup_verified_at',true),'')::timestamptz<now()-interval '24 hours' or nullif(current_setting('danqel.backup_verified_at',true),'')::timestamptz>now() then raise exception 'STOP: backup evidence is stale or invalid';end if;
 if current_setting('danqel.authorize_launch_dc',true) is distinct from '10000' then raise exception 'STOP: explicit 10000-DC launch authorization required';end if;
 if(select count(*) from auth.users)<>2 or(select count(*) from public.profiles)<>2 or(select count(*) from public.points_ledger)<>6 or(select count(*) from public.points_balance)<>1 or(select coalesce(sum(balance),0) from public.points_balance)<>90 or exists(select 1 from public.bank_point_orders) or exists(select 1 from public.payment_transactions) then raise exception 'STOP: production baseline changed; re-audit before rollout';end if;
 if exists(select 1 from unnest(array['public.dc_settings','public.dc_transactions','public.dc_products','public.dc_orders','public.launch_campaign','public.launch_awards','public.mission_limits','public.creator_ranks','public.missions','public.mission_submissions','public.mission_awards','public.creator_xp_events','public.member_connections','public.promotion_campaigns','public.promotion_events','public.push_config','public.notification_preferences','public.push_subscriptions','public.push_deliveries','public.push_attempts','public.notification_templates','public.app_releases','public.notification_announcements','public.support_tickets','public.support_replies','public.credit_coupons','public.coupon_redemptions']) t where to_regclass(t) is not null) then raise exception 'STOP: pending objects already exist; reconcile partial history manually';end if;
 if exists(select 1 from information_schema.role_table_grants where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')) then raise exception 'STOP: 024 hardening has drifted';end if;
end$$;
create temporary table reconciliation_auth on commit drop as select id,to_jsonb(u) data from auth.users u;
create temporary table reconciliation_profiles on commit drop as select id,to_jsonb(p) data from public.profiles p;
create temporary table reconciliation_ledger on commit drop as select id,to_jsonb(l) data from public.points_ledger l;
-- SOURCE 016_dc_economy.sql SHA256 2996757d99646e24ad46926af760b5ec2fa71a8278e34a363ac5c1c1479cb98a
-- Official currency: 100 kobo = 1 DC. Existing earned balances are carried forward, not reset.

alter table public.points_balance alter column balance type numeric(20,2);
alter table public.points_balance alter column balance set not null;
alter table public.points_ledger alter column points type numeric(20,2);
alter table public.bank_point_orders alter column points type numeric(20,2);
-- Recompile the earned-only XP trigger for numeric DC; deposits/spends never become XP.
create or replace function public.refresh_creator_xp() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.points>0 and (new.reason='daily_checkin' or new.reason like 'task:%') then update public.profiles set creator_xp=creator_xp+floor(new.points)::bigint where id=new.user_id;end if;return new;
end$$;
-- Existing pooled sessions may have cached integer record-field plans. Recompile trusted
-- dependants without changing their definitions, owners, permissions or stored data.
do $$declare signature regprocedure;begin
 foreach signature in array array['public.award_order_referral(uuid)'::regprocedure,'public.claim_daily_checkin()'::regprocedure,'public.claim_task(text)'::regprocedure,'public.activate_point_boost(uuid,uuid)'::regprocedure,'public.admin_mutate(text,text,jsonb,text,uuid)'::regprocedure,'public.admin_review_bank_order(uuid,boolean,text,text)'::regprocedure,'public.member_overview()'::regprocedure] loop
  execute pg_get_functiondef(signature);
 end loop;
end$$;
create table public.dc_settings(id boolean primary key default true check(id),deposits_enabled boolean not null default true,spending_enabled boolean not null default true);
insert into public.dc_settings(id) values(true);
alter table public.dc_settings enable row level security;
create policy "DC settings read" on public.dc_settings for select using(true);
revoke all on public.dc_settings from public,anon,authenticated;
grant select on public.dc_settings to anon,authenticated;
create table public.dc_transactions(
 id uuid primary key default gen_random_uuid(),sequence bigint generated always as identity unique,
 user_id uuid not null,transaction_reference text unique not null,transaction_type text not null,
 credit_amount numeric(20,2) not null check(credit_amount<>0),previous_balance numeric(20,2) not null,new_balance numeric(20,2) not null,
 status text not null check(status in ('pending','successful')),description text not null,activity_reference text,ledger_id uuid unique,
 snapshot_origin text not null default 'recorded' check(snapshot_origin in ('recorded','reconstructed','opening_balance')),
 database_transaction bigint not null default txid_current(),created_at timestamptz not null default clock_timestamp(),
 check(new_balance=previous_balance+credit_amount)
);
create index dc_transactions_owner on public.dc_transactions(user_id,sequence desc);
alter table public.dc_transactions enable row level security;
create policy "own DC transactions read" on public.dc_transactions for select to authenticated using(user_id=auth.uid());
revoke all on public.dc_transactions from public,anon,authenticated;
grant select on public.dc_transactions to authenticated;
-- Original history did not store balance snapshots. Preserve it and mark reconstructed snapshots explicitly.
insert into public.dc_transactions(id,user_id,transaction_reference,transaction_type,credit_amount,previous_balance,new_balance,status,description,activity_reference,ledger_id,snapshot_origin,created_at)
select id,user_id,'DC-'||id,'legacy',points,carried+running-points,carried+running,'successful',reason,ref_key,id,'reconstructed',created_at from (
 select l.*,sum(points) over(partition by l.user_id order by created_at,id) running,
 coalesce((select balance from public.points_balance where user_id=l.user_id),0)-sum(points) over(partition by l.user_id) carried from public.points_ledger l where user_id is not null and points<>0
) s;
insert into public.dc_transactions(user_id,transaction_reference,transaction_type,credit_amount,previous_balance,new_balance,status,description,snapshot_origin)
select user_id,'DC-OPENING-'||user_id,'opening_balance',balance,0,balance,'successful','Existing balance carried forward; no new credits issued','opening_balance' from public.points_balance b where balance<>0 and not exists(select 1 from public.points_ledger where user_id=b.user_id);
create function public.dc_capture_balance() returns trigger language plpgsql security definer set search_path=public as $$declare previous numeric;delta numeric; identifier uuid:=gen_random_uuid();begin
 previous:=case when tg_op='INSERT' then 0 else old.balance end;delta:=new.balance-previous;
 if delta<>0 then insert into public.dc_transactions(id,user_id,transaction_reference,transaction_type,credit_amount,previous_balance,new_balance,status,description)
 values(identifier,new.user_id,'DC-'||identifier,'unclassified',delta,previous,new.balance,'pending','Balance movement awaiting ledger reconciliation');end if;return new;
end$$;
create trigger dc_capture_balance after insert or update of balance on public.points_balance for each row execute function public.dc_capture_balance();
create function public.dc_link_ledger() returns trigger language plpgsql security definer set search_path=public as $$declare movement uuid;kind text;begin
 select id into movement from public.dc_transactions where user_id=new.user_id and database_transaction=txid_current() and status='pending' and credit_amount=new.points order by sequence limit 1 for update;
 if movement is null then raise exception 'Ledger entries require a matching atomic balance movement';end if;
 kind:=case when new.ref_key like 'bank-order:%' or new.ref_key like 'provider:%' then 'deposit' when new.ref_key like 'dc-spend:%' then 'spend' when new.ref_key like 'dc-refund:%' then 'refund' when new.reason like 'admin:%' then 'admin_adjustment' when new.points>0 then 'reward' else 'spend' end;
 update public.dc_transactions set status='successful',transaction_type=kind,description=new.reason,activity_reference=new.ref_key,ledger_id=new.id where id=movement;return new;
end$$;
create trigger dc_link_ledger after insert on public.points_ledger for each row execute function public.dc_link_ledger();
create function public.dc_require_reconciled() returns trigger language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from public.dc_transactions where id=new.id and status<>'successful') then raise exception 'Every balance change must have an atomic matching ledger entry';end if;return null;
end$$;
create constraint trigger dc_require_reconciled after insert on public.dc_transactions deferrable initially deferred for each row execute function public.dc_require_reconciled();
create function public.dc_immutable_transaction() returns trigger language plpgsql set search_path=public as $$begin
 if tg_op='UPDATE' and pg_trigger_depth()>1 and old.status='pending' and new.status='successful' and (to_jsonb(new)-'status'-'transaction_type'-'description'-'activity_reference'-'ledger_id')=(to_jsonb(old)-'status'-'transaction_type'-'description'-'activity_reference'-'ledger_id') then return new;end if;
 raise exception 'DC transaction history is append-only';
end$$;
create trigger dc_immutable_transaction before update or delete on public.dc_transactions for each row execute function public.dc_immutable_transaction();
create trigger dc_immutable_transaction_truncate before truncate on public.dc_transactions for each statement execute function public.dc_immutable_transaction();
create function public.dc_guard_wallet_delete() returns trigger language plpgsql security definer set search_path=public as $$begin
 if old.balance<>0 then raise exception 'Settle this wallet with a journaled transaction before deletion';end if;return old;
end$$;
create trigger dc_guard_wallet_delete before delete on public.points_balance for each row execute function public.dc_guard_wallet_delete();
revoke all on function public.dc_guard_wallet_delete() from public,anon,authenticated;
-- Invalid historical packages are not silently repriced; deactivate them and require explicit staff repair.
update public.point_packages set is_active=false where price_kobo::numeric<>points::numeric*100;
alter table public.point_packages add constraint official_dc_rate check(price_kobo::numeric=points::numeric*100) not valid;
insert into public.point_packages(title,points,price_kobo) select amount||' DC',amount,amount*100 from unnest(array[100,500,1000,5000,10000]) amount where not exists(select 1 from public.point_packages where is_active and points=amount and price_kobo=amount*100);
alter function public.create_bank_point_order(uuid,uuid) rename to create_bank_point_order_before_dc;
revoke all on function public.create_bank_point_order_before_dc(uuid,uuid) from public,anon,authenticated;
create function public.create_bank_point_order(p_package uuid,p_request uuid) returns uuid language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();
 if not (select deposits_enabled from public.dc_settings where id) then raise exception 'DC deposits are currently paused';end if;
 return public.create_bank_point_order_before_dc(p_package,p_request);
end$$;
-- The bank statement amount, not a caller's points payload, defines the DC credit.
alter function public.admin_review_bank_order(uuid,boolean,text,text) rename to admin_review_bank_order_before_dc;
revoke all on function public.admin_review_bank_order_before_dc(uuid,boolean,text,text) from public,anon,authenticated;
create function public.admin_review_bank_order(p_order uuid,p_approve boolean,p_bank_reference text,p_reason text) returns void language plpgsql security definer set search_path=public as $$declare item public.bank_point_orders;begin
 if coalesce(public.admin_role(),'') not in ('super_admin','finance_admin') then raise exception 'Permission denied' using errcode='42501';end if;
 select * into item from public.bank_point_orders where id=p_order for update;
 if p_approve and item.status='submitted' then update public.bank_point_orders set points=amount_kobo::numeric/100 where id=p_order;end if;
 perform public.admin_review_bank_order_before_dc(p_order,p_approve,p_bank_reference,p_reason);
end$$;
-- All newly recorded provider payments are DC deposits unless explicitly labelled another product.
alter table public.payment_transactions add column purpose text,add column provider_transaction_id text;
create unique index unique_dc_provider_transaction on public.payment_transactions(provider,provider_transaction_id) where provider_transaction_id is not null;
update public.payment_transactions set purpose='legacy_unspecified';
alter table public.payment_transactions alter column purpose set default 'growth_credits';
create or replace function public.settle_verified_payment(p_reference text,p_amount bigint,p_currency text,p_email text,p_provider_id text) returns boolean language plpgsql security definer set search_path=public as $$declare payment public.payment_transactions;customer text;credits numeric;begin
 select * into payment from public.payment_transactions where reference=p_reference for update;
 if not found then raise exception 'Unknown payment reference';end if;
 select email into customer from auth.users where id=payment.user_id;
 if payment.provider is distinct from 'paystack' or p_currency is distinct from 'NGN' or p_amount is distinct from payment.amount_kobo::bigint or p_amount<=0 or customer is null or p_email is null or lower(customer) is distinct from lower(p_email) or nullif(trim(p_provider_id),'') is null or length(p_provider_id)>120 then raise exception 'Provider details do not match payment';end if;
 if payment.status='verified' then if payment.provider_transaction_id is distinct from p_provider_id then raise exception 'Provider transaction does not match';end if;return true;end if;
 if payment.status<>'pending' then raise exception 'Payment is not pending';end if;
 if payment.purpose='growth_credits' then
  credits:=p_amount::numeric/100;
  insert into public.points_balance(user_id,balance) values(payment.user_id,credits) on conflict(user_id) do update set balance=public.points_balance.balance+credits;
  insert into public.points_ledger(user_id,points,reason,ref_key) values(payment.user_id,credits,'Verified naira deposit','provider:'||payment.reference);
 end if;
 update public.payment_transactions set status='verified',verified_at=now(),provider_transaction_id=p_provider_id where id=payment.id;
 insert into public.audit_logs(action,target,meta) values('provider_payment_verified',payment.id::text,jsonb_build_object('provider','paystack','provider_id',p_provider_id,'amount_kobo',p_amount,'dc_credited',credits));return true;
end$$;
revoke all on function public.create_bank_point_order(uuid,uuid),public.admin_review_bank_order(uuid,boolean,text,text) from public,anon;
grant execute on function public.create_bank_point_order(uuid,uuid),public.admin_review_bank_order(uuid,boolean,text,text) to authenticated;
revoke all on function public.settle_verified_payment(text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.settle_verified_payment(text,bigint,text,text,text) to service_role;
revoke all on function public.dc_capture_balance(),public.dc_link_ledger(),public.dc_require_reconciled(),public.dc_immutable_transaction() from public,anon,authenticated;


-- SOURCE 017_dc_wallet_and_spending.sql SHA256 3af3379de133c6984fdbb01b6d5a81ab5079e31a2313bbfe5baa12b5f79d316f

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


-- SOURCE 018_launch_reward.sql SHA256 d020d9b3d9867f9583d7a8a9220b313dd8851b758e88f868b9fedccb14fed570
-- Official launch: first 50 successfully awarded eligible accounts; fixed 5,000 DC each.
-- Requires staged economy migrations 016/017. No account, balance or earned history is reset.

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


-- SOURCE 019_missions_progression.sql SHA256 62bcc17a8772eea46d614ce13fcde135c3b95b0a37a7ff14859529d12b217bbb

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


-- SOURCE 020_discovery_promotions.sql SHA256 1127b7045c7ce404a7f30c79647eb1529b7ceda8f79a2f906474e30694f77423
-- Extends existing discovery, DC products/orders, ledger and staff audit. No resets.

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


-- SOURCE 021_manual_deposits_only.sql SHA256 252c4459aa28c6bb6d33db9e2b3a506263252a80e4425e596f15ed27d26bf6a9
-- Manual-only deposits. Preserve all historical provider, bank and ledger records.

revoke all on function public.settle_verified_payment(text,bigint,text,text,text),public.record_verified_payment_failure(text,bigint,text,text,text) from public,anon,authenticated,service_role;
create function public.online_payments_disabled() returns trigger language plpgsql set search_path=public as $$begin raise exception 'Online payments are disabled. Use manual bank transfer';end$$;
create trigger online_payments_disabled before insert on public.payment_transactions for each row execute function public.online_payments_disabled();
revoke all on function public.online_payments_disabled() from public,anon,authenticated,service_role;

alter table public.bank_point_orders alter column package_id drop not null;
alter table public.bank_point_orders drop constraint bank_point_orders_status_check;
alter table public.bank_point_orders add constraint bank_point_orders_status_check check(status in ('awaiting_transfer','submitted','approved','rejected','cancelled','refunded'));
alter table public.bank_point_orders add column verified_amount_kobo bigint,add column verified_currency text,add column verified_recipient text,add column refund_reference text unique,add column refunded_at timestamptz,add column refunded_by uuid,add column refund_reason text;
insert into public.point_packages(title,points,price_kobo) select '2000 DC',2000,200000 where not exists(select 1 from public.point_packages where is_active and points=2000 and price_kobo=200000);

create function public.create_manual_deposit(p_amount numeric,p_request uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare prior public.bank_point_orders;bank public.bank_transfer_details;begin
 perform public.require_active_account();
 if not public.reward_account_verified(auth.uid()) then raise exception 'Verify your account before creating a deposit';end if;
 if p_request is null or p_amount is null or p_amount<=0 or p_amount>1000000 or p_amount<>round(p_amount,2) then raise exception 'Enter a naira amount from 0.01 to 1000000 with at most two decimals';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select * into prior from public.bank_point_orders where id=p_request;
 if found then
  if prior.user_id is distinct from auth.uid() or prior.package_id is not null or prior.amount_kobo<>p_amount*100 then raise exception 'Order ID unavailable';end if;
  return prior.id;
 end if;
 if not(select deposits_enabled from public.dc_settings where id) then raise exception 'DC deposits are currently paused';end if;
 if(select count(*) from public.bank_point_orders where user_id=auth.uid() and status in ('awaiting_transfer','submitted'))>=5 then raise exception 'Finish or cancel your existing payment requests first';end if;
 select * into bank from public.bank_transfer_details where id for share;
 if not found or bank.account_number !~ '^[0-9]{10}$' then raise exception 'Bank transfers are not configured';end if;
 insert into public.bank_point_orders(id,user_id,package_title,points,amount_kobo,bank_name,account_name,account_number)
 values(p_request,auth.uid(),'Manual DC deposit',p_amount,p_amount*100,bank.bank_name,bank.account_name,bank.account_number);
 return p_request;
end$$;

-- Approval requires separately entered receiving-statement facts, never receipt claims.
create function public.admin_confirm_manual_deposit(p_order uuid,p_approve boolean,p_bank_reference text,p_received_kobo bigint,p_currency text,p_recipient text,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare item public.bank_point_orders;begin
 perform public.require_active_account();
 if not public.reward_finance_access() then raise exception 'Permission denied' using errcode='42501';end if;
 if p_approve is null or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Review reason required';end if;
 select * into item from public.bank_point_orders where id=p_order for update;
 if not found then raise exception 'Order not found';end if;
 if item.user_id=auth.uid() then raise exception 'You cannot review your own payment';end if;
 if p_approve then
  if p_received_kobo is distinct from item.amount_kobo::bigint or p_currency is distinct from 'NGN' or p_recipient is distinct from item.account_number then raise exception 'Bank statement amount, currency or recipient does not match';end if;
  if item.status='approved' then
   if item.bank_reference is distinct from lower(trim(p_bank_reference)) then raise exception 'Bank statement reference does not match';end if;return;
  end if;
  if item.status<>'submitted' then raise exception 'Only submitted payments may be reviewed';end if;
  update public.bank_point_orders set points=p_received_kobo::numeric/100,verified_amount_kobo=p_received_kobo,verified_currency=p_currency,verified_recipient=p_recipient where id=item.id;
 end if;
 perform public.admin_review_bank_order_before_dc(p_order,p_approve,p_bank_reference,p_reason);
end$$;
create or replace function public.admin_review_bank_order(p_order uuid,p_approve boolean,p_bank_reference text,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 if p_approve then raise exception 'Use bank statement confirmation for manual deposits';end if;
 perform public.admin_confirm_manual_deposit(p_order,p_approve,p_bank_reference,null,null,null,p_reason);
end$$;
revoke all on function public.admin_review_bank_order_before_dc(uuid,boolean,text,text),public.create_bank_point_order_before_dc(uuid,uuid) from public,anon,authenticated,service_role;

-- This records a separately verified external full refund; it does NOT send money.
create function public.admin_record_manual_refund(p_order uuid,p_reference text,p_amount_kobo bigint,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare item public.bank_point_orders;reward public.referral_purchase_rewards;begin
 perform public.require_active_account();if not public.reward_finance_access() then raise exception 'Permission denied' using errcode='42501';end if;
 if p_reference is null or length(trim(p_reference)) not between 4 and 120 or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Confirmed refund reference and reason required';end if;
 select * into item from public.bank_point_orders where id=p_order for update;
 if not found or item.user_id is null then raise exception 'Order unavailable';end if;
 if item.user_id=auth.uid() then raise exception 'You cannot review your own payment';end if;
 if p_amount_kobo is distinct from item.amount_kobo::bigint then raise exception 'Only the exact full deposit amount may be refunded';end if;
 if item.status='refunded' then
  if item.refund_reference is distinct from lower(trim(p_reference)) then raise exception 'Refund reference does not match';end if;return;
 end if;
 if item.status<>'approved' then raise exception 'Only approved deposits may be refunded';end if;
 select * into reward from public.referral_purchase_rewards where order_id=item.id;
 perform 1 from public.points_balance where user_id in (item.user_id,reward.referrer_id) order by user_id for update;
 update public.points_balance set balance=balance-item.points where user_id=item.user_id and balance>=item.points;
 if not found then raise exception 'Insufficient unspent DC for reversal. Escalate for audited reconciliation';end if;
 insert into public.points_ledger(user_id,points,reason,ref_key) values(item.user_id,-item.points,'Manual deposit refund: confirmed external return','deposit-reversal:'||item.id);
 if reward.points>0 then
  update public.points_balance set balance=balance-reward.points where user_id=reward.referrer_id and balance>=reward.points;
  if not found then raise exception 'Insufficient unspent referral DC for reversal. Escalate for audited reconciliation';end if;
  insert into public.points_ledger(user_id,points,reason,ref_key) values(reward.referrer_id,-reward.points,'Referral reward reversed after deposit refund','referral-reversal:'||item.id);
 end if;
 update public.bank_point_orders set status='refunded',refund_reference=lower(trim(p_reference)),refunded_at=clock_timestamp(),refunded_by=auth.uid(),refund_reason=trim(p_reason) where id=item.id;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'manual_deposit_refund_recorded',item.id::text,jsonb_build_object('refund_reference',lower(trim(p_reference)),'amount_kobo',p_amount_kobo,'dc_reversed',item.points,'referral_dc_reversed',coalesce(reward.points,0),'reason',trim(p_reason),'money_sent_by_system',false));
 insert into public.notifications(user_id,title,body) values(item.user_id,'Deposit refund recorded',item.points||' DC reversed after finance confirmed an external bank refund.');
end$$;

create function public.admin_manual_deposits(p_search text default '',p_status text default '',p_page int default 0,p_from date default null,p_to date default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare rows jsonb;total bigint;gross numeric;refunds numeric;begin
 perform public.require_active_account();if not public.reward_finance_access() then raise exception 'Permission denied' using errcode='42501';end if;
 if p_status is null or p_status not in ('','awaiting_transfer','submitted','approved','rejected','cancelled','refunded') or p_page is null or p_page<0 or p_page>100000 or p_from>p_to then raise exception 'Invalid deposit filter';end if;
 with matching as(select b.*,p.username,u.email from public.bank_point_orders b left join public.profiles p on p.id=b.user_id left join auth.users u on u.id=b.user_id
 where (p_status='' or b.status=p_status) and (p_from is null or b.created_at>=p_from::timestamp at time zone 'UTC') and(p_to is null or b.created_at<(p_to+1)::timestamp at time zone 'UTC')
 and (coalesce(p_search,'')='' or concat_ws(' ',p.username,u.email,b.id::text,b.payer_name,b.transfer_reference,b.bank_reference,b.refund_reference) ilike '%'||left(p_search,200)||'%'))
 select (select count(*) from matching),(select coalesce(sum(amount_kobo),0) from matching where status in ('approved','refunded')),(select coalesce(sum(amount_kobo),0) from matching where status='refunded'),(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from(select * from matching order by created_at desc,id desc limit 25 offset p_page*25)r) into total,gross,refunds,rows;
 return jsonb_build_object('rows',rows,'total',total,'gross_kobo',gross,'refunded_kobo',refunds,'net_kobo',gross-refunds);
end$$;
revoke all on function public.create_manual_deposit(numeric,uuid),public.admin_confirm_manual_deposit(uuid,boolean,text,bigint,text,text,text),public.admin_record_manual_refund(uuid,text,bigint,text),public.admin_manual_deposits(text,text,int,date,date) from public,anon,authenticated,service_role;
grant execute on function public.create_manual_deposit(numeric,uuid),public.admin_confirm_manual_deposit(uuid,boolean,text,bigint,text,text,text),public.admin_record_manual_refund(uuid,text,bigint,text),public.admin_manual_deposits(text,text,int,date,date) to authenticated;

create or replace function public.dc_link_ledger() returns trigger language plpgsql security definer set search_path=public as $$declare movement uuid;kind text;begin
 select id into movement from public.dc_transactions where user_id=new.user_id and database_transaction=txid_current() and status='pending' and credit_amount=new.points order by sequence limit 1 for update;
 if movement is null then raise exception 'Ledger entries require a matching atomic balance movement';end if;
 kind:=case when new.ref_key like 'referral-reversal:%' then 'referral_refund' when new.ref_key like 'deposit-reversal:%' then 'deposit_refund' when new.ref_key like 'bank-order:%' or new.ref_key like 'provider:%' then 'deposit' when new.ref_key like 'dc-spend:%' then 'spend' when new.ref_key like 'dc-refund:%' then 'refund' when new.reason like 'admin:%' then 'admin_adjustment' when new.points>0 then 'reward' else 'spend' end;
 update public.dc_transactions set status='successful',transaction_type=kind,description=new.reason,activity_reference=new.ref_key,ledger_id=new.id where id=movement;return new;
end$$;

create or replace function public.dc_wallet(p_kind text default 'transactions',p_status text default '',p_page int default 0) returns jsonb language plpgsql security definer set search_path=public as $$declare records jsonb;total bigint;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_kind not in ('transactions','deposits') or p_status not in ('','pending','successful','failed','cancelled','refunded') or p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid wallet filter';end if;
 with entries as (
  select t.id::text id,t.transaction_reference,t.transaction_type,t.credit_amount,t.previous_balance,t.new_balance,case when t.transaction_type='deposit_refund' then 'refunded' else t.status end status,t.description,t.activity_reference,t.snapshot_origin,t.created_at from public.dc_transactions t where t.user_id=auth.uid() and (p_kind='transactions' or t.transaction_type in ('deposit','deposit_refund'))
  union all
  select b.id::text,'BANK-'||b.id,'deposit_attempt',0,b.balance_at_request,b.balance_at_request,case when b.status in ('awaiting_transfer','submitted') then 'pending' when b.status='rejected' then 'failed' else 'cancelled' end,'Bank deposit request: '||b.amount_kobo::numeric/100||' DC','bank-order:'||b.id,'request',b.created_at from public.bank_point_orders b where b.user_id=auth.uid() and b.status not in ('approved','refunded')
  union all
  select p.id::text,p.reference,'deposit_attempt',0,p.balance_at_request,p.balance_at_request,case when p.status='pending' then 'pending' else 'failed' end,'Provider deposit request: '||p.amount_kobo::numeric/100||' DC','provider:'||p.reference,'request',p.created_at from public.payment_transactions p where p.user_id=auth.uid() and p.purpose='growth_credits' and p.status<>'verified'
 ), filtered as(select * from entries where p_status='' or status=p_status), paged as(select * from filtered order by created_at desc,id desc limit 20 offset p_page*20)
 select (select count(*) from filtered),(select coalesce(jsonb_agg(to_jsonb(paged)),'[]') from paged) into total,records;
 return jsonb_build_object('balance',coalesce((select balance from public.points_balance where user_id=auth.uid()),0),'rows',records,'total',total,'pending',(select count(*) from public.bank_point_orders where user_id=auth.uid() and status in ('awaiting_transfer','submitted'))+(select count(*) from public.payment_transactions where user_id=auth.uid() and purpose='growth_credits' and status='pending'),'successful',(select count(*) from public.dc_transactions where user_id=auth.uid() and status='successful'),'failed',(select count(*) from public.bank_point_orders where user_id=auth.uid() and status='rejected')+(select count(*) from public.payment_transactions where user_id=auth.uid() and purpose='growth_credits' and status='failed'));
end$$;


-- SOURCE 022_web_push_notifications.sql SHA256 95adeda5723cf2485951b92564b052872d7f692664e70558439e850de4f2dd5a
-- Additive private inbox + opt-in Web Push. No secrets or automatic deployment.

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


-- SOURCE 023_complete_admin_workspace.sql SHA256 33a5fc4faf6cd94f5b9f14613c974bf14351ff83a9d2b670b2aecd38fd014692
-- Complete administration of existing systems. No Auth users/passwords or balance resets.

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


-- SOURCE 024_launch_least_privilege.sql SHA256 c1222773e6ce19fd0bd6e6a6fcae2c9098120388569f32e9ae1d19674587aa8f
-- Independent, idempotent least-privilege hardening; safe on the existing 015 catalog
-- as well as after 023. No records, Auth identities or financial amounts are changed.

revoke create on schema public from public,anon,authenticated;
revoke truncate,references,trigger on all tables in schema public from public,anon,authenticated;
alter default privileges in schema public revoke truncate,references,trigger on tables from public,anon,authenticated;
-- These resources are written by trusted audited functions, never direct browser DML.
-- Notification read-state is re-granted explicitly after the blanket table revoke.
revoke insert,update,delete on public.account_consents,public.account_restrictions,public.audit_logs,public.bank_point_orders,public.bank_transfer_details,public.boost_plans,public.managed_profile_batches,public.managed_profiles,public.payment_transactions,public.point_packages,public.points_balance,public.points_ledger,public.profile_views,public.promotions,public.purchases,public.referral_purchase_rewards,public.referrals,public.reward_config,public.reward_tasks,public.site_settings,public.social_platforms,public.subscriptions,public.task_claims,public.user_boosts,public.user_roles from public,anon,authenticated;
revoke insert,update,delete on public.notifications from public,anon,authenticated;
grant update(is_read) on public.notifications to authenticated;

do $$begin
 if(select count(*) from auth.users)<>2 or(select count(*) from public.profiles)<>2 or(select count(*) from public.points_ledger)<>8 or(select count(*) from public.launch_awards)<>2 or(select coalesce(sum(amount_dc),0) from public.launch_awards)<>10000 or(select coalesce(sum(balance),0) from public.points_balance)<>10090 then raise exception 'STOP: unexpected financial delta; rollback entire rollout';end if;
 if exists(select 1 from reconciliation_auth s left join auth.users u on u.id=s.id where u.id is null or s.data<>to_jsonb(u)) then raise exception 'STOP: historical Auth alteration';end if;
 if exists(select 1 from reconciliation_profiles s left join public.profiles p on p.id=s.id where p.id is null or s.data<>to_jsonb(p)) or exists(select 1 from reconciliation_ledger s left join public.points_ledger l on l.id=s.id where l.id is null or s.data<>to_jsonb(l)) then raise exception 'STOP: historical profile/ledger alteration';end if;
 if exists(select 1 from public.dc_transactions where status<>'successful') or(select count(*) from public.dc_transactions where snapshot_origin='reconstructed')<>6 then raise exception 'STOP: journal not reconciled';end if;
 if has_function_privilege('service_role','public.settle_verified_payment(text,bigint,text,text,text)','EXECUTE') then raise exception 'STOP: provider settlement unexpectedly enabled';end if;
 if exists(select 1 from information_schema.role_table_grants where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')) then raise exception 'STOP: hardening regression';end if;
end$$;
commit;
