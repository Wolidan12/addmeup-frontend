-- Narrow standalone installation, explicitly authorized with recovery prerequisite waived.
-- NOT a replay of 016–023. Baseline 001–015 + 024 only. No existing financial data changes.
begin;
set local lock_timeout='5s';
lock table auth.users,public.profiles,public.points_balance,public.points_ledger,public.bank_point_orders,public.notifications,public.audit_logs in share mode;
create temp table manual_deposit_preservation on commit drop as select jsonb_build_object('users',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from auth.users t),'profiles',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.profiles t),'wallets',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text,'null')) from public.points_balance t),'ledger',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.points_ledger t),'orders',(select md5(coalesce(jsonb_agg(to_jsonb(t)-'verified_amount_kobo'-'verified_currency'-'verified_recipient' order by id)::text,'null')) from public.bank_point_orders t),'notifications',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.notifications t),'audit',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.audit_logs t)) as value;
create table public.dc_settings(id boolean primary key default true check(id),deposits_enabled boolean not null default true,spending_enabled boolean not null default false);
insert into public.dc_settings values(true,true,false);
alter table public.dc_settings enable row level security;
revoke all on public.dc_settings from public,anon,authenticated,service_role;
create policy "manual deposit settings read" on public.dc_settings for select to authenticated using(auth.uid() is not null);
grant select on public.dc_settings to authenticated;
alter table public.bank_point_orders alter column package_id drop not null;
alter table public.bank_point_orders add column verified_amount_kobo bigint,add column verified_currency text,add column verified_recipient text;
create function public.manual_bank_access(p_finance boolean default false) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_active_account();
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and (banned_until is null or banned_until<now())) then raise exception 'Verify your account before creating a deposit';end if;
 if p_finance and coalesce(public.admin_role(),'') not in ('super_admin','finance_admin') then raise exception 'Permission denied' using errcode='42501';end if;
end$$;
create function public.create_manual_deposit(p_amount numeric,p_request uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare prior public.bank_point_orders; bank public.bank_transfer_details;
begin
 perform public.manual_bank_access();
 if p_request is null or p_amount is null or p_amount<1 or p_amount>1000000 or p_amount<>trunc(p_amount) then raise exception 'Enter a whole naira amount from 1 to 1000000';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select * into prior from public.bank_point_orders where id=p_request;
 if found then
  if prior.user_id is distinct from auth.uid() or prior.amount_kobo<>p_amount*100 then raise exception 'Order ID unavailable';end if;return prior.id;
 end if;
 if not coalesce((select deposits_enabled from public.dc_settings where id),false) then raise exception 'DC deposits are currently paused';end if;
 if (select count(*) from public.bank_point_orders where user_id=auth.uid() and status in ('awaiting_transfer','submitted'))>=5 then raise exception 'Finish or cancel your existing payment requests first';end if;
 select * into bank from public.bank_transfer_details where id for share;
 if bank.account_number is distinct from '6977298247' or bank.account_name is distinct from 'LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST' or upper(bank.bank_name) is distinct from 'MONIEPOINT' then raise exception 'Bank transfers are not configured';end if;
 insert into public.bank_point_orders(id,user_id,package_title,points,amount_kobo,account_number,account_name,bank_name) values(p_request,auth.uid(),'Manual DC deposit',p_amount::integer,(p_amount*100)::integer,bank.account_number,bank.account_name,bank.bank_name);
 return p_request;
end$$;
create or replace function public.create_bank_point_order(p_package uuid,p_request uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare pkg public.point_packages;begin
 select * into pkg from public.point_packages where id=p_package and is_active;
 if not found or pkg.price_kobo<>pkg.points*100 then raise exception 'Package changed';end if;
 return public.create_manual_deposit(pkg.points,p_request);
end$$;
create or replace function public.submit_bank_point_order(p_order uuid,p_payer text,p_reference text,p_receipt text) returns void language plpgsql security definer set search_path=public as $$
declare item public.bank_point_orders;begin
 perform public.manual_bank_access();
 select * into item from public.bank_point_orders where id=p_order and user_id=auth.uid() for update;
 if not found then raise exception 'Order not found';end if;
 if item.status='submitted' and item.receipt_path=p_receipt and item.transfer_reference=lower(trim(p_reference)) then return;end if;
 if item.status<>'awaiting_transfer' then raise exception 'Order cannot be submitted';end if;
 if p_payer is null or length(trim(p_payer)) not between 2 and 100 or p_reference is null or length(trim(p_reference)) not between 4 and 120 then raise exception 'Provide payer name and transfer reference';end if;
 if p_receipt is null or p_receipt !~ ('^'||auth.uid()||'/'||p_order||'/[a-f0-9-]+[.](jpg|png|webp)$') then raise exception 'Invalid receipt path';end if;
 if not exists(select 1 from storage.objects where bucket_id='bank-receipts' and name=p_receipt) then raise exception 'Upload payment evidence first';end if;
 update public.bank_point_orders set payer_name=trim(p_payer),transfer_reference=lower(trim(p_reference)),receipt_path=p_receipt,status='submitted',submitted_at=now() where id=p_order;
end$$;
drop policy "receipt upload" on storage.objects;
create policy "receipt upload" on storage.objects for insert to authenticated with check(bucket_id='bank-receipts' and exists(select 1 from public.bank_point_orders o where o.user_id=auth.uid() and o.status='awaiting_transfer' and name ~ ('^'||auth.uid()||'/'||o.id||'/[a-f0-9-]+[.](jpg|png|webp)$')));
create function public.admin_confirm_manual_deposit(p_order uuid,p_approve boolean,p_bank_reference text,p_received_kobo bigint,p_currency text,p_recipient text,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare item public.bank_point_orders; ref text=lower(trim(p_bank_reference));
begin
 perform public.manual_bank_access(true);
 if p_approve is null or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Review reason required';end if;
 select * into item from public.bank_point_orders where id=p_order for update;
 if not found or item.user_id is null then raise exception 'Order unavailable';end if;
 if item.user_id=auth.uid() then raise exception 'You cannot review your own payment';end if;
 if p_approve then
  if ref is null or length(ref) not between 4 and 120 or p_received_kobo is distinct from item.amount_kobo::bigint or p_currency is distinct from 'NGN' or p_recipient is distinct from item.account_number or item.account_number<>'6977298247' or item.points::bigint*100<>item.amount_kobo::bigint then raise exception 'Bank statement amount, currency or recipient does not match';end if;
 end if;
 if item.status=(case when p_approve then 'approved' else 'rejected' end) then
  if p_approve and item.bank_reference is distinct from ref then raise exception 'Bank reference does not match prior approval';end if;return;
 end if;
 if item.status<>'submitted' or item.receipt_path is null or not exists(select 1 from storage.objects where bucket_id='bank-receipts' and name=item.receipt_path) then raise exception 'Only submitted payments with uploaded evidence may be reviewed';end if;
 if p_approve then
  -- Unique bank_reference and ledger ref_key guarantee exactly-once credit; all writes are atomic.
  update public.bank_point_orders set bank_reference=ref,verified_amount_kobo=p_received_kobo,verified_currency=p_currency,verified_recipient=p_recipient where id=p_order;
  insert into public.points_balance(user_id,balance) values(item.user_id,item.points) on conflict(user_id) do update set balance=public.points_balance.balance+excluded.balance;
  insert into public.points_ledger(user_id,points,reason,ref_key) values(item.user_id,item.points,'Manual bank deposit: confirmed received funds','bank-order:'||item.id);
 end if;
 update public.bank_point_orders set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),review_note=trim(p_reason),reviewed_at=now() where id=p_order;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),case when p_approve then 'manual_deposit_approved' else 'manual_deposit_rejected' end,p_order::text,jsonb_build_object('bank_reference',case when p_approve then ref end,'amount_kobo',item.amount_kobo,'dc',item.points,'reason',trim(p_reason)));
 insert into public.notifications(user_id,title,body) values(item.user_id,case when p_approve then 'Deposit approved' else 'Deposit rejected' end,case when p_approve then item.points||' DC added after confirmation of received funds.' else trim(p_reason) end);
end$$;
create function public.admin_manual_deposits(p_search text default '',p_status text default '',p_page int default 0,p_from date default null,p_to date default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;begin
 perform public.manual_bank_access(true);
 if p_page is null or p_page<0 or p_page>1000000 or length(coalesce(p_search,''))>200 or (p_from is not null and p_to is not null and p_from>p_to) then raise exception 'Invalid report filters';end if;
 with filtered as (
 select o.*,p.username,u.email,false as refunds_supported from public.bank_point_orders o left join public.profiles p on p.id=o.user_id left join auth.users u on u.id=o.user_id
 where (coalesce(p_status,'')='' or o.status=p_status) and (coalesce(p_search,'')='' or coalesce(p.username,'') ilike '%'||p_search||'%' or coalesce(u.email,'') ilike '%'||p_search||'%' or coalesce(o.transfer_reference,'') ilike '%'||p_search||'%' or coalesce(o.payer_name,'') ilike '%'||p_search||'%')
 and (p_from is null or o.created_at>=p_from::timestamp at time zone 'UTC') and (p_to is null or o.created_at<(p_to+1)::timestamp at time zone 'UTC')
 ), paged as (select * from filtered order by created_at desc,id limit 25 offset p_page*25)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged) order by created_at desc,id) from paged),'[]'::jsonb),'total',(select count(*) from filtered),'gross_kobo',(select coalesce(sum(amount_kobo) filter(where status='approved'),0) from filtered),'refunded_kobo',0,'net_kobo',(select coalesce(sum(amount_kobo) filter(where status='approved'),0) from filtered)) into result;
 return result;
end$$;
-- Remove the old approval bypass; receipt upload and cancellation keep their existing protected functions.
revoke all on function public.admin_review_bank_order(uuid,boolean,text,text) from public,anon,authenticated,service_role;
revoke all on function public.manual_bank_access(boolean),public.create_manual_deposit(numeric,uuid),public.admin_confirm_manual_deposit(uuid,boolean,text,bigint,text,text,text),public.admin_manual_deposits(text,text,int,date,date),public.create_bank_point_order(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_manual_deposit(numeric,uuid),public.admin_confirm_manual_deposit(uuid,boolean,text,bigint,text,text,text),public.admin_manual_deposits(text,text,int,date,date),public.create_bank_point_order(uuid,uuid) to authenticated;
do $$begin if (select value from manual_deposit_preservation) is distinct from (select jsonb_build_object('users',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from auth.users t),'profiles',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.profiles t),'wallets',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text,'null')) from public.points_balance t),'ledger',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.points_ledger t),'orders',(select md5(coalesce(jsonb_agg(to_jsonb(t)-'verified_amount_kobo'-'verified_currency'-'verified_recipient' order by id)::text,'null')) from public.bank_point_orders t),'notifications',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.notifications t),'audit',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.audit_logs t))) then raise exception 'Installation changed existing records; aborting';end if;end$$;
notify pgrst, 'reload schema';
commit;
