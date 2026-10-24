-- 001: profiles + social links + RLS. Apply in Supabase SQL Editor (in order).
create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, username text unique not null check(username ~ '^[a-z0-9_]{3,24}$'), display_name text not null check(char_length(display_name) between 1 and 60), bio text check(char_length(bio)<=280), country text, interests text[] default '{}', avatar_url text, is_public boolean default true, is_sponsored boolean default false, created_at timestamptz default now());
create table public.social_links(id uuid primary key default gen_random_uuid(), profile_id uuid references public.profiles(id) on delete cascade, platform text check(platform in ('whatsapp','snapchat','instagram','tiktok','facebook','x')), url text not null, is_public boolean default true, unique(profile_id,platform));
alter table public.profiles enable row level security; alter table public.social_links enable row level security;
create policy "public profiles readable" on public.profiles for select using(is_public or auth.uid()=id);
create policy "own profile write" on public.profiles for all using(auth.uid()=id) with check(auth.uid()=id);
create policy "public links readable" on public.social_links for select using(is_public or exists(select 1 from public.profiles p where p.id=profile_id and p.id=auth.uid()));
create policy "own links write" on public.social_links for all using(exists(select 1 from public.profiles p where p.id=profile_id and p.id=auth.uid())) with check(exists(select 1 from public.profiles p where p.id=profile_id and p.id=auth.uid()));
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.profiles(id,username,display_name) values(new.id,'user_'||substr(new.id::text,1,8),'New creator') on conflict(id) do nothing; return new; end$$;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- NOTE: public selects never expose auth.users.email. Sponsored flag is admin-only: revoke update of is_sponsored from authenticated via column privilege if needed.
