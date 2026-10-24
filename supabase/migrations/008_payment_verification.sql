-- Trusted provider results ONLY; this function is NOT callable by browser roles.
begin;
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
commit;
