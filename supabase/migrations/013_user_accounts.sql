-- Account onboarding, permitted profile fields, extensible social hosts and earned Creator XP.
-- Additive migration: retains existing users, roles, balances and ledger entries.
begin;
alter table public.profiles add column location text, add column categories text[] not null default '{}', add column creator_xp bigint not null default 0 check(creator_xp>=0), add column creator_level bigint generated always as (1+creator_xp/100) stored;
create table public.account_consents(user_id uuid primary key references auth.users(id) on delete cascade,terms_version text not null,accepted_at timestamptz not null default now());
alter table public.account_consents enable row level security;
revoke all on public.account_consents from anon,authenticated;
grant select on public.account_consents to authenticated;
create policy "own consent read" on public.account_consents for select to authenticated using(user_id=auth.uid());
create table public.social_platforms(key text primary key check(key ~ '^[a-z][a-z0-9_]{0,29}$'),label text not null check(length(trim(label)) between 1 and 40),hosts text[] not null check(cardinality(hosts) between 1 and 10));
insert into public.social_platforms values
 ('whatsapp','WhatsApp',array['wa.me']),('instagram','Instagram',array['instagram.com']),('tiktok','TikTok',array['tiktok.com']),('snapchat','Snapchat',array['snapchat.com']),('facebook','Facebook',array['facebook.com','fb.com']),('x','X',array['x.com','twitter.com']),('youtube','YouTube',array['youtube.com','youtu.be']),('telegram','Telegram',array['t.me','telegram.me']);
alter table public.social_platforms enable row level security;
revoke all on public.social_platforms from anon,authenticated;
grant select on public.social_platforms to anon,authenticated;
create policy "public platform catalogue" on public.social_platforms for select using(true);
alter table public.social_links drop constraint social_links_platform_check;
alter table public.social_links add constraint social_links_platform_fkey foreign key(platform) references public.social_platforms(key);
alter table public.site_settings drop constraint site_settings_enabled_platforms_check;
update public.site_settings set enabled_platforms=enabled_platforms||array['youtube','telegram'];
create function public.validate_platform_selection() returns trigger language plpgsql set search_path=public as $$begin
 if cardinality(new.enabled_platforms)>40 or exists(select 1 from unnest(new.enabled_platforms) x where x is null or not exists(select 1 from public.social_platforms where key=x)) then raise exception 'Choose configured social platforms'; end if;
 return new; end$$;
create trigger validate_platform_selection before insert or update of enabled_platforms on public.site_settings for each row execute function public.validate_platform_selection();
create function public.admin_save_social_platform(p_key text,p_label text,p_hosts text[],p_enabled boolean,p_reason text) returns void language plpgsql security definer set search_path=public as $$begin
 if public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied'; end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 or p_enabled is null then raise exception 'Provide a reason and enabled state'; end if;
 if p_key in ('whatsapp','instagram','tiktok','snapchat','facebook','x','youtube','telegram') then raise exception 'Built-in host definitions are protected; use site settings to enable or disable them'; end if;
 if p_hosts is null or cardinality(p_hosts) not between 1 and 10 or exists(select 1 from unnest(p_hosts) h where h is null or h !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,63}$' or h ~ '(^|\.)(localhost|local|internal|test|invalid)$') then raise exception 'Use public DNS hostnames without protocol, path or port'; end if;
 insert into public.social_platforms(key,label,hosts) values(p_key,trim(p_label),p_hosts) on conflict(key) do update set label=excluded.label,hosts=excluded.hosts;
 update public.site_settings set enabled_platforms=array_remove(enabled_platforms,p_key)||case when p_enabled then array[p_key] else '{}'::text[] end where id;
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'social_platform_saved',p_key,jsonb_build_object('reason',trim(p_reason),'label',p_label,'hosts',p_hosts,'enabled',p_enabled));
end$$;
revoke all on function public.admin_save_social_platform(text,text,text[],boolean,text) from public,anon;
grant execute on function public.admin_save_social_platform(text,text,text[],boolean,text) to authenticated;
create function public.is_username_available(p_username text) returns boolean language sql stable security definer set search_path=public as $$select p_username ~ '^[a-z0-9_]{3,24}$' and not exists(select 1 from public.profiles where username=p_username)$$;
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon,authenticated;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare metadata jsonb:=coalesce(to_jsonb(new)->'raw_user_meta_data','{}'); chosen text; full_name text;
begin
 -- Real Auth rows always include raw_user_meta_data; legacy minimal test/bootstrap schemas do not.
 if to_jsonb(new) ? 'raw_user_meta_data' then
  chosen:=lower(trim(metadata->>'username'));full_name:=trim(metadata->>'full_name');
  if chosen is null or chosen !~ '^[a-z0-9_]{3,24}$' or full_name is null or length(full_name) not between 1 and 60 or full_name ~ '[[:cntrl:]<>]' or metadata->>'terms_accepted' is distinct from 'true' then raise exception 'Valid account details and terms acceptance are required'; end if;
 else chosen:='user_'||substr(new.id::text,1,8);full_name:='New creator'; end if;
 insert into public.profiles(id,username,display_name,is_public) values(new.id,chosen,full_name,not (to_jsonb(new) ? 'raw_user_meta_data'));
 if metadata->>'terms_accepted'='true' then insert into public.account_consents(user_id,terms_version) values(new.id,'2026-10-31'); end if;
 return new;
end$$;
-- Existing constraints are retained; new validation runs on future edits, not destructive backfills.
create function public.validate_account_profile() returns trigger language plpgsql set search_path=public as $$declare item text; begin
 new.display_name:=trim(new.display_name);new.username:=lower(trim(new.username));new.bio:=trim(new.bio);new.country:=trim(new.country);new.location:=trim(new.location);
 if new.display_name ~ '[[:cntrl:]<>]' or length(coalesce(new.country,''))>80 or length(coalesce(new.location,''))>100 or coalesce(new.country,'') ~ '[[:cntrl:]<>]' or coalesce(new.location,'') ~ '[[:cntrl:]<>]' or coalesce(new.bio,'') ~ '[<>]' then raise exception 'Invalid profile details'; end if;
 if cardinality(new.interests)>10 or cardinality(new.categories)>5 then raise exception 'Too many interests or categories'; end if;
 foreach item in array coalesce(new.interests,'{}')||new.categories loop
  if item is null or length(trim(item)) not between 1 and 40 or item ~ '[[:cntrl:]<>]' then raise exception 'Invalid interest or category'; end if;
 end loop;
 if new.avatar_url is not null and new.avatar_url<>'' and (length(new.avatar_url)>1000 or new.avatar_url !~ '^https://[^[:space:]<>]+$') then raise exception 'Use an HTTPS image URL'; end if;
 if current_user in ('anon','authenticated') then
  if tg_op='INSERT' or new.id is distinct from old.id or new.created_at is distinct from old.created_at or new.creator_xp is distinct from old.creator_xp then raise exception 'Protected account field'; end if;
 end if;
 return new;
end$$;
create trigger validate_account_profile before insert or update on public.profiles for each row execute function public.validate_account_profile();
revoke insert,delete,update on public.profiles from authenticated,anon;
grant update(username,display_name,bio,country,location,interests,categories,avatar_url,is_public) on public.profiles to authenticated;
-- React renders text; server enforces lengths and official/custom allowlisted HTTPS hosts for ALL links, including private ones.
create or replace function public.guard_account_write() returns trigger language plpgsql set search_path=public as $$
declare hostname text; begin
 if current_user in ('authenticated','anon') then perform public.require_active_account(); end if;
 if tg_table_name='social_links' and tg_op<>'DELETE' then
  if current_user in ('authenticated','anon') and not exists(select 1 from public.site_settings where new.platform=any(enabled_platforms)) then raise exception 'This social platform is not currently available'; end if;
  new.url:=trim(new.url);
  if new.platform='whatsapp' and new.url ~ '^\+?[0-9 -]{7,20}$' then new.url:='https://wa.me/'||regexp_replace(new.url,'[^0-9]','','g'); end if;
  hostname:=lower(substring(new.url from '^https://([^/]+)/'));
  if length(new.url)>500 or new.url ~ '[[:space:]<>\\]' or new.url !~ '^https://[^/@:#?]+/[^[:space:]]+$' or not exists(select 1 from public.social_platforms c,unnest(c.hosts) h where c.key=new.platform and (hostname=h or hostname='www.'||h)) or (new.platform='whatsapp' and new.url !~ '^https://wa[.]me/[0-9]{7,20}$') then raise exception 'Use a valid official HTTPS social profile URL'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end$$;
-- XP is non-purchasable engagement progress: positive trusted check-in/task ledger entries only.
-- 100 earned XP per level. No new wallet credits, reward amounts or ledger entries are created.
create function public.refresh_creator_xp() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.points>0 and (new.reason='daily_checkin' or new.reason like 'task:%') then update public.profiles set creator_xp=creator_xp+new.points where id=new.user_id; end if;return new;
end$$;
create trigger creator_xp_earned after insert on public.points_ledger for each row execute function public.refresh_creator_xp();
update public.profiles p set creator_xp=(select coalesce(sum(points::bigint),0) from public.points_ledger l where l.user_id=p.id and l.points>0 and (l.reason='daily_checkin' or l.reason like 'task:%')) where exists(select 1 from public.points_ledger l where l.user_id=p.id and l.points>0 and (l.reason='daily_checkin' or l.reason like 'task:%')); 
revoke all on function public.refresh_creator_xp(),public.validate_account_profile(),public.validate_platform_selection(),public.handle_new_user() from public,anon,authenticated;
-- Hosted default ACLs must not give browser roles destructive access to new tables.
revoke truncate,references,trigger on public.account_consents,public.social_platforms from anon,authenticated;
commit;
