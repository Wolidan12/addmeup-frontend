-- 004 (ADDITIVE ONLY - preserves all existing data/accounts): admin roles, moderation, payments, promotions, notifications, audit, storage
create table public.user_roles(user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('user','moderator','admin')), created_at timestamptz default now());
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('admin','moderator'))$$;
create table public.notifications(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, title text not null, body text, is_read boolean default false, created_at timestamptz default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, target text, meta jsonb default '{}', created_at timestamptz default now());
create table public.promotions(id uuid primary key default gen_random_uuid(), title text not null, description text, price_kobo int check(price_kobo>=0), is_active boolean default true, created_at timestamptz default now());
create table public.payment_transactions(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, provider text check(provider in ('paystack','stripe')), reference text unique not null, amount_kobo int not null check(amount_kobo>0), status text default 'pending' check(status in ('pending','verified','failed','refunded')), created_at timestamptz default now(), verified_at timestamptz);
create table public.subscriptions(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, plan text not null, status text default 'active' check(status in ('active','cancelled','expired')), starts_at timestamptz default now(), expires_at timestamptz);
create table public.purchases(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, item_title text not null, transaction_id uuid references public.payment_transactions(id), created_at timestamptz default now());
alter table public.user_roles enable row level security; alter table public.notifications enable row level security; alter table public.audit_logs enable row level security; alter table public.promotions enable row level security; alter table public.payment_transactions enable row level security; alter table public.subscriptions enable row level security; alter table public.purchases enable row level security;
create policy "roles own read" on public.user_roles for select using(auth.uid()=user_id or public.is_admin());
create policy "notif own" on public.notifications for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "audit admin read" on public.audit_logs for select using(public.is_admin());
create policy "promo public read" on public.promotions for select using(is_active or public.is_admin());
create policy "promo admin write" on public.promotions for all using(public.is_admin()) with check(public.is_admin());
create policy "pay own read" on public.payment_transactions for select using(auth.uid()=user_id or public.is_admin());
create policy "pay own create pending" on public.payment_transactions for insert with check(auth.uid()=user_id and status='pending');
-- NO update policy on payment_transactions for users: only service-role Edge Functions (after provider verification) may mark verified.
create policy "sub own read" on public.subscriptions for select using(auth.uid()=user_id or public.is_admin());
create policy "purchases own read" on public.purchases for select using(auth.uid()=user_id or public.is_admin());
create policy "reports admin" on public.reports for select using(public.is_admin());
create policy "reports admin update" on public.reports for update using(public.is_admin()) with check(public.is_admin());
grant select on public.user_roles, public.notifications, public.promotions, public.payment_transactions, public.subscriptions, public.purchases to authenticated; grant select on public.audit_logs to authenticated;
grant insert on public.payment_transactions to authenticated; grant insert,update on public.notifications to authenticated;
grant execute on function public.is_admin() to authenticated;
create or replace function public.admin_resolve_report(p_report uuid, p_status text) returns void language plpgsql security definer set search_path=public as $$begin if not public.is_admin() then raise exception 'Admin only'; end if; update public.reports set status=p_status where id=p_report; insert into public.audit_logs(actor_id,action,target) values(auth.uid(),'resolve_report',p_report::text); end$$;
create or replace function public.admin_set_sponsored(p_profile uuid, p_on boolean) returns void language plpgsql security definer set search_path=public as $$begin if not public.is_admin() then raise exception 'Admin only'; end if; update public.profiles set is_sponsored=p_on where id=p_profile; insert into public.audit_logs(actor_id,action,target) values(auth.uid(),'set_sponsored',p_profile::text); end$$;
grant execute on function public.admin_resolve_report(uuid,text), public.admin_set_sponsored(uuid,boolean) to authenticated;
-- Make yourself admin AFTER running this (replace email): insert into public.user_roles(user_id,role) select id,'admin' from auth.users where email='YOUR_EMAIL';
-- Storage: avatars bucket
insert into storage.buckets(id,name,public) values('avatars','avatars',true) on conflict(id) do nothing;
create policy "avatar public read" on storage.objects for select using(bucket_id='avatars');
create policy "avatar own upload" on storage.objects for insert with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar own manage" on storage.objects for update using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar own delete" on storage.objects for delete using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
