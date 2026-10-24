-- 002: favourites, reports, blocks, views
create table public.favourites(user_id uuid references auth.users(id) on delete cascade, profile_id uuid references public.profiles(id) on delete cascade, created_at timestamptz default now(), primary key(user_id,profile_id));
create table public.blocks(blocker_id uuid references auth.users(id) on delete cascade, blocked_id uuid references public.profiles(id) on delete cascade, created_at timestamptz default now(), primary key(blocker_id,blocked_id));
create table public.reports(id uuid primary key default gen_random_uuid(), reporter_id uuid references auth.users(id) on delete cascade, profile_id uuid references public.profiles(id) on delete cascade, reason text check(char_length(reason)<=500), status text default 'open', created_at timestamptz default now());
create table public.profile_views(profile_id uuid references public.profiles(id) on delete cascade, viewer_id uuid references auth.users(id) on delete cascade, viewed_on date default current_date, primary key(profile_id,viewer_id,viewed_on));
alter table public.favourites enable row level security; alter table public.blocks enable row level security; alter table public.reports enable row level security; alter table public.profile_views enable row level security;
create policy "own favourites" on public.favourites for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "own blocks" on public.blocks for all using(auth.uid()=blocker_id) with check(auth.uid()=blocker_id);
create policy "own reports insert" on public.reports for insert with check(auth.uid()=reporter_id);
create policy "own reports read" on public.reports for select using(auth.uid()=reporter_id);
create index idx_profiles_search on public.profiles using gin(to_tsvector('english',coalesce(display_name,'')||' '||username||' '||coalesce(country,'')));
create index idx_profiles_interests on public.profiles using gin(interests);
create or replace function public.record_profile_view(p_profile uuid) returns void language plpgsql security definer set search_path=public as $$begin if auth.uid() is null or auth.uid()=p_profile then return; end if; insert into public.profile_views(profile_id,viewer_id) values(p_profile,auth.uid()) on conflict do nothing; end$$;
create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path=public as $$begin delete from auth.users where id=auth.uid(); end$$;

grant select, insert, update, delete on public.favourites, public.blocks to authenticated;
grant insert, select on public.reports to authenticated;
grant execute on function public.record_profile_view(uuid), public.delete_my_account() to authenticated;
