-- Manual-only deposits. Preserve all historical provider, bank and ledger records.
begin;
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
commit;
