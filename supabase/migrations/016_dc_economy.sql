-- Official currency: 100 kobo = 1 DC. Existing earned balances are carried forward, not reset.
begin;
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
commit;
