-- Public admin-managed listings must satisfy the same profile-completion fields
-- represented by the cosmetic "Profile complete" badge. This is not identity,
-- email, or KYC verification, and does not create Auth users or alter member rewards.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $$begin
 if to_regclass('public.managed_profiles') is null then raise exception 'Managed-profile completion requires public.managed_profiles';
 elsif to_regprocedure('public.validate_managed_profile(jsonb)') is null then raise exception 'Managed-profile completion requires public.validate_managed_profile(jsonb)';
 elsif to_regprocedure('public.admin_save_managed_profile(uuid,jsonb,text)') is null then raise exception 'Managed-profile completion requires public.admin_save_managed_profile(uuid,jsonb,text)';
 elsif to_regprocedure('public.managed_feed_item(uuid)') is null then raise exception 'Managed-profile completion requires public.managed_feed_item(uuid)';
 elsif to_regprocedure('public.public_directory(text,text,text,text,integer)') is null then raise exception 'Managed-profile completion requires public.public_directory(text,text,text,text,integer)';
 elsif to_regprocedure('public.discovery_profile(text,boolean)') is null then raise exception 'Managed-profile completion requires public.discovery_profile(text,boolean)';
 end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.public_directory(text,text,text,text,integer)') and position('managed_feed_item' in prosrc)>0)
  or not exists(select 1 from pg_proc where oid=to_regprocedure('public.discovery_profile(text,boolean)') and position('managed_feed_item' in prosrc)>0) then
  raise exception 'Public feed and detail must delegate managed profiles through managed_feed_item';
 end if;
end$$;

lock table public.managed_profiles in share mode;

-- Shared predicate for the existing completion badge, public-save constraint and
-- the public managed-feed projection. Social links are not a completion field.
create or replace function public.managed_profile_completion_fields(p_data jsonb) returns boolean
language sql immutable set search_path=public as $$
 select case
  when p_data is null or jsonb_typeof(p_data)<>'object'
    or jsonb_typeof(p_data->'interests')<>'array' then false
  else coalesce(
    length(trim(p_data->>'display_name'))>=2
    and trim(p_data->>'display_name')<>'New creator'
    and p_data->>'username' ~ '^[a-z0-9_]{3,24}$'
    and length(trim(p_data->>'avatar_url'))>0
    and length(trim(p_data->>'bio'))>0
    and length(trim(p_data->>'country'))>0
    and exists(select 1 from jsonb_array_elements_text(p_data->'interests') as interest(value)
      where length(trim(value))>0),false)
 end
$$;
revoke all on function public.managed_profile_completion_fields(jsonb) from public,anon,authenticated,service_role;

do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.managed_profiles'::regclass and conname='managed_profiles_public_completion_check') then
  -- NOT VALID preserves historical rows. New public writes are checked immediately;
  -- incomplete existing public rows are separately hidden by managed_feed_item below.
  alter table public.managed_profiles add constraint managed_profiles_public_completion_check
   check(not is_public or public.managed_profile_completion_fields(jsonb_build_object(
    'display_name',display_name,'username',username,'avatar_url',avatar_url,
    'bio',bio,'country',country,'interests',to_jsonb(interests)))) not valid;
 end if;
end$$;

-- Keep old incomplete public rows stored for admin repair, but never return them
-- through the public feed or managed-profile detail endpoint.
create or replace function public.managed_feed_item(p_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
  'id',m.id,'username',m.username,'display_name',m.display_name,'bio',m.bio,
  'country',m.country,'interests',m.interests,'avatar_url',m.avatar_url,
  'created_at',m.created_at,'managed',true,'listing_source','admin_managed',
  'feed_listing_paid',false,
  'social_links',coalesce((select jsonb_agg(l)
   from jsonb_array_elements(m.social_links) l
   where l->'is_public'='true'::jsonb
    and l->>'platform'=any((select enabled_platforms from public.site_settings where id)::text[])
    and length(l->>'url')<=500
    and l->>'url' ~ '^https://[^/@:#?]+/[^[:space:]<>]+$'
    and l->>'url' !~ '[[:space:]<>\\]'
    and exists(select 1 from public.social_platforms c,unnest(c.hosts) h
     where c.key=l->>'platform'
      and (lower(split_part(split_part(l->>'url','://',2),'/',1))=h
       or lower(split_part(split_part(l->>'url','://',2),'/',1))='www.'||h))),'[]'::jsonb))
 from public.managed_profiles m
 where m.id=p_id and m.is_public
  and m.username ~ '^[a-z0-9_]{3,24}$'
  and length(trim(m.display_name)) between 1 and 60
  and public.managed_profile_completion_fields(jsonb_build_object(
   'display_name',m.display_name,'username',m.username,'avatar_url',m.avatar_url,
   'bio',m.bio,'country',m.country,'interests',to_jsonb(m.interests)))
$$;
revoke all on function public.managed_feed_item(uuid) from public,anon,authenticated,service_role;

notify pgrst,'reload schema';
commit;
