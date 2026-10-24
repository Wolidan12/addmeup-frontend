-- Additive: manual bank-transfer purchases, independent managed listings, and upload limits.
begin;
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

commit;
