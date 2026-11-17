-- Super-admin-assisted completion of an existing member profile, only with the
-- member's explicit authorization. This fills missing fields and inserts new
-- public links; it never changes ownership, existing values, or privacy settings.
-- Profile completion remains derived from saved fields, never manually granted.
-- The existing launch_profile_eligibility trigger is intentionally preserved: if
-- an eligible member completes the required fields, the normal launch-reward rules
-- (confirmation, campaign capacity, duplicate checks) continue to apply.
-- This installer makes no member-data changes and is not a production deployment record.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

lock table auth.users,public.profiles,public.social_links,public.social_platforms,
 public.site_settings,public.user_roles,public.account_restrictions,public.audit_logs,
 public.notifications,public.launch_campaign,public.launch_awards,public.points_balance,
 public.points_ledger in share mode;

do $$begin
 if to_regclass('public.profiles') is null
  or to_regclass('public.social_links') is null
  or to_regclass('public.social_platforms') is null
  or to_regclass('public.site_settings') is null
  or to_regclass('public.user_roles') is null
  or to_regclass('public.account_restrictions') is null
  or to_regclass('public.audit_logs') is null
  or to_regclass('public.notifications') is null
  or to_regclass('public.launch_campaign') is null
  or to_regclass('public.launch_awards') is null
  or to_regclass('public.points_balance') is null
  or to_regclass('public.points_ledger') is null
  or to_regprocedure('public.require_active_account()') is null
  or to_regprocedure('public.admin_role()') is null
  or to_regprocedure('public.admin_feed_profile_complete(uuid)') is null
  or to_regprocedure('public.feed_profile_ready(uuid)') is null
  or to_regprocedure('public.admin_member_feed_status(uuid)') is null
  or to_regprocedure('public.admin_grant_member_feed(uuid,text,integer,text,boolean,uuid)') is null
  or to_regprocedure('public.admin_revoke_member_feed(uuid,text,boolean,uuid)') is null
  or to_regprocedure('public.award_launch_reward(uuid)') is null then
  raise exception 'Admin member profile assistance requires the installed member-feed, profile, social-link and launch-reward baseline';
 end if;
 if not exists(
  select 1 from pg_trigger t
  where t.tgrelid=to_regclass('public.profiles')
   and t.tgname='launch_profile_eligibility'
   and not t.tgisinternal and t.tgenabled='O'
 ) then
  raise exception 'Admin member profile assistance requires the active launch-reward eligibility trigger';
 end if;
 if to_regprocedure('public.admin_member_profile_assist_status(uuid)') is not null
  or to_regprocedure('public.admin_assist_member_profile(uuid,jsonb,jsonb,text,boolean,uuid)') is not null then
  raise exception 'Admin member profile assistance is already installed; reconcile before replaying';
 end if;
end$$;

create function pg_temp.admin_member_profile_assist_snapshot() returns jsonb
language sql stable as $$
 select jsonb_build_object(
  'users',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from auth.users t),
  'profiles',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.profiles t),
  'social_links',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.social_links t),
  'roles',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text,'null')) from public.user_roles t),
  'restrictions',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text,'null')) from public.account_restrictions t),
  'audit',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.audit_logs t),
  'notifications',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.notifications t),
  'launch_campaign',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.launch_campaign t),
  'launch_awards',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.launch_awards t),
  'wallets',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by user_id)::text,'null')) from public.points_balance t),
  'ledger',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'null')) from public.points_ledger t)
 )
$$;
create temp table admin_member_profile_assist_preservation on commit drop as
 select pg_temp.admin_member_profile_assist_snapshot() as snapshot;

-- Exposes only missing-field names and unused enabled platform names, never the
-- member's private links or profile values. The helper cannot grant a badge.
create function public.admin_member_profile_assist_status(p_user uuid) returns jsonb
language plpgsql volatile security definer set search_path=public as $$
declare
 member_row public.profiles;
 is_member boolean;
 is_restricted boolean;
 missing_fields text[];
 available_links jsonb;
 can_assist boolean;
begin
 perform public.require_active_account();
 if public.admin_role() is distinct from 'super_admin' then
  raise exception 'Permission denied' using errcode='42501';
 end if;
 if p_user is null or p_user=auth.uid() then raise exception 'Choose another member account';end if;
 select p.* into member_row from public.profiles p join auth.users u on u.id=p.id where p.id=p_user;
 if not found then raise exception 'Member profile unavailable';end if;
 select coalesce((select r.role from public.user_roles r where r.user_id=p_user),'user')='user'
  into is_member;
 is_restricted:=exists(select 1 from public.account_restrictions r where r.user_id=p_user)
  or exists(select 1 from auth.users u where u.id=p_user and u.banned_until>now());
 missing_fields:=array_remove(array[
  case when length(trim(coalesce(member_row.display_name,'')))<2 or trim(member_row.display_name)='New creator' then 'display_name' end,
  case when length(trim(coalesce(member_row.username,'')))<3 then 'username' end,
  case when length(trim(coalesce(member_row.avatar_url,'')))=0 then 'avatar_url' end,
  case when length(trim(coalesce(member_row.bio,'')))=0 then 'bio' end,
  case when length(trim(coalesce(member_row.country,'')))=0 then 'country' end,
  case when not exists(select 1 from unnest(coalesce(member_row.interests,'{}'::text[])) interest(value)
    where length(trim(value))>0) then 'interests' end
 ]::text[],null::text);
 can_assist:=is_member and member_row.is_public is true and not is_restricted
  and (cardinality(missing_fields)>0 or not public.feed_profile_ready(p_user));
 select coalesce(jsonb_agg(jsonb_build_object('key',platform.key,'label',platform.label)
    order by platform.label,platform.key),'[]'::jsonb)
  into available_links
 from public.social_platforms platform
 where can_assist
  and exists(select 1 from public.site_settings s where s.id and platform.key=any(s.enabled_platforms))
  and not exists(select 1 from public.social_links link
   where link.profile_id=p_user and link.platform=platform.key);
 return jsonb_build_object(
  'user_id',p_user,
  'member_account',is_member,
  'profile_public',member_row.is_public is true,
  'restricted',is_restricted,
  'profile_complete',public.admin_feed_profile_complete(p_user),
  'profile_ready',public.feed_profile_ready(p_user),
  'can_assist',can_assist,
  'missing_fields',to_jsonb(missing_fields),
  'available_social_platforms',available_links
 );
end$$;

-- Atomically fills only currently missing completion fields and inserts new
-- supported public links. It never overwrites a filled field or existing link.
create function public.admin_assist_member_profile(
 p_user uuid,p_profile jsonb,p_social_links jsonb,p_reason text,
 p_member_authorized boolean,p_request uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 actor uuid:=auth.uid();
 member_row public.profiles;
 prior public.audit_logs;
 fingerprint text;
 prior_actor uuid;
 prior_action text;
 prior_target text;
 missing_fields text[];
 updated_fields text[]:='{}'::text[];
 added_platforms text[]:='{}'::text[];
 allowed_keys text[]:=array['display_name','username','avatar_url','bio','country','interests'];
 display_value text;
 username_value text;
 avatar_value text;
 bio_value text;
 country_value text;
 interest_values text[];
 enabled_platforms text[];
 link_item jsonb;
 platform_value text;
 link_value text;
 host_value text;
 digit_value text;
 original_url text;
 had_launch_award boolean;
 result jsonb;
 missing_after text[];
begin
 perform public.require_active_account();
 if public.admin_role() is distinct from 'super_admin' then
  raise exception 'Permission denied' using errcode='42501';
 end if;
 if p_user is null or p_user=actor or p_request is null then
  raise exception 'Member and request reference required';
 end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 then
  raise exception 'Provide an 8–1000 character reason';
 end if;
 if p_member_authorized is distinct from true then
  raise exception 'Confirm the member supplied and authorized these exact profile changes';
 end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object'
  or p_social_links is null or jsonb_typeof(p_social_links)<>'array' then
  raise exception 'Profile details and public links need valid structured data';
 end if;
 if exists(select 1 from jsonb_object_keys(p_profile) as item(key)
   where not (item.key=any(allowed_keys))) then
  raise exception 'Only profile-completion fields may be supplied';
 end if;
 if jsonb_array_length(p_social_links)>8 then raise exception 'Add no more than 8 public links at a time';end if;
 if not (p_profile ? 'display_name' or p_profile ? 'username' or p_profile ? 'avatar_url'
   or p_profile ? 'bio' or p_profile ? 'country' or p_profile ? 'interests'
   or jsonb_array_length(p_social_links)>0) then
  raise exception 'Enter missing profile details or a new public social link';
 end if;
 fingerprint:=md5(jsonb_build_array(p_user,p_profile,p_social_links,trim(p_reason),p_member_authorized)::text);
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select a.* into prior from public.audit_logs a where a.meta->>'request_id'=p_request::text limit 1;
 if found then
  if prior.actor_id=actor and prior.action='member_profile_assisted'
   and prior.target=p_user::text and prior.meta->>'payload_hash'=fingerprint then
   return prior.meta->'result';
  end if;
  raise exception 'Request reference unavailable';
 end if;

 select p.* into member_row from public.profiles p join auth.users u on u.id=p.id
 where p.id=p_user for update of p;
 if not found then raise exception 'Member profile unavailable';end if;
 if coalesce((select r.role from public.user_roles r where r.user_id=p_user),'user')<>'user' then
  raise exception 'Only member accounts can receive admin profile assistance';
 end if;
 if member_row.is_public is distinct from true then
  raise exception 'The member must keep their profile public using their own privacy settings';
 end if;
 if exists(select 1 from public.account_restrictions r where r.user_id=p_user)
  or exists(select 1 from auth.users u where u.id=p_user and u.banned_until>now()) then
  raise exception 'Restricted member profiles cannot be assisted or listed';
 end if;
 missing_fields:=array_remove(array[
  case when length(trim(coalesce(member_row.display_name,'')))<2 or trim(member_row.display_name)='New creator' then 'display_name' end,
  case when length(trim(coalesce(member_row.username,'')))<3 then 'username' end,
  case when length(trim(coalesce(member_row.avatar_url,'')))=0 then 'avatar_url' end,
  case when length(trim(coalesce(member_row.bio,'')))=0 then 'bio' end,
  case when length(trim(coalesce(member_row.country,'')))=0 then 'country' end,
  case when not exists(select 1 from unnest(coalesce(member_row.interests,'{}'::text[])) interest(value)
    where length(trim(value))>0) then 'interests' end
 ]::text[],null::text);
 if cardinality(missing_fields)=0 and public.feed_profile_ready(p_user) then
  raise exception 'This profile is already complete and ready for the community feed';
 end if;
 if p_profile ? 'display_name' then
  if not ('display_name'=any(missing_fields)) or jsonb_typeof(p_profile->'display_name')<>'string' then
   raise exception 'Only a missing display name may be filled';
  end if;
  display_value:=trim(p_profile->>'display_name');
  if length(display_value) not between 2 and 60 or display_value='New creator'
   or display_value ~ '[[:cntrl:]<>]' then raise exception 'Enter a valid member-supplied display name';end if;
  updated_fields:=array_append(updated_fields,'display_name');
 end if;
 if p_profile ? 'username' then
  if not ('username'=any(missing_fields)) or jsonb_typeof(p_profile->'username')<>'string' then
   raise exception 'Only a missing signup username may be filled';
  end if;
  username_value:=lower(trim(p_profile->>'username'));
  if username_value !~ '^[a-z0-9_]{3,24}$' then raise exception 'Enter the member-selected signup username';end if;
  if exists(select 1 from public.profiles p where p.username=username_value and p.id<>p_user) then
   raise exception 'That signup username is already taken';
  end if;
  updated_fields:=array_append(updated_fields,'username');
 end if;
 if p_profile ? 'avatar_url' then
  if not ('avatar_url'=any(missing_fields)) or jsonb_typeof(p_profile->'avatar_url')<>'string' then
   raise exception 'Only a missing profile photo URL may be filled';
  end if;
  avatar_value:=trim(p_profile->>'avatar_url');
  if length(avatar_value)>1000 or avatar_value !~ '^https://[^[:space:]<>]+$' then
   raise exception 'Use the member-supplied HTTPS profile-photo URL';
  end if;
  updated_fields:=array_append(updated_fields,'avatar_url');
 end if;
 if p_profile ? 'bio' then
  if not ('bio'=any(missing_fields)) or jsonb_typeof(p_profile->'bio')<>'string' then
   raise exception 'Only a missing profile bio may be filled';
  end if;
  bio_value:=trim(p_profile->>'bio');
  if length(bio_value) not between 1 and 280 or bio_value ~ '[<>]' then
   raise exception 'Enter a valid member-supplied bio of 1–280 characters';
  end if;
  updated_fields:=array_append(updated_fields,'bio');
 end if;
 if p_profile ? 'country' then
  if not ('country'=any(missing_fields)) or jsonb_typeof(p_profile->'country')<>'string' then
   raise exception 'Only a missing country may be filled';
  end if;
  country_value:=trim(p_profile->>'country');
  if length(country_value) not between 1 and 80 or country_value ~ '[[:cntrl:]<>]' then
   raise exception 'Enter a valid member-supplied country';
  end if;
  updated_fields:=array_append(updated_fields,'country');
 end if;
 if p_profile ? 'interests' then
  if not ('interests'=any(missing_fields)) or jsonb_typeof(p_profile->'interests')<>'array' then
   raise exception 'Only missing profile interests may be filled';
  end if;
  if jsonb_array_length(p_profile->'interests') not between 1 and 10
   or exists(select 1 from jsonb_array_elements(p_profile->'interests') as interest(value)
     where jsonb_typeof(interest.value)<>'string'
      or length(trim(interest.value#>>'{}')) not between 1 and 40
      or interest.value#>>'{}' ~ '[[:cntrl:]<>]') then
   raise exception 'Enter 1–10 valid member-supplied interests';
  end if;
  select array_agg(trim(interest.value#>>'{}') order by interest.ordinality)
   into interest_values
  from jsonb_array_elements(p_profile->'interests') with ordinality as interest(value,ordinality);
  updated_fields:=array_append(updated_fields,'interests');
 end if;
 if exists(select 1 from unnest(missing_fields) as missing(field_name)
   where not (missing.field_name=any(updated_fields))) then
  raise exception 'Complete every currently missing profile field before saving';
 end if;

 select s.enabled_platforms into enabled_platforms from public.site_settings s where s.id;
 if jsonb_array_length(p_social_links)>0 then
  if exists(select 1 from jsonb_array_elements(p_social_links) as item(value)
    where jsonb_typeof(item.value)<>'object') then
   raise exception 'Each new public link needs a valid object';
  end if;
  if exists(select 1 from jsonb_array_elements(p_social_links) as item(value)
    where not (item.value ?& array['platform','url']::text[])
     or (select count(*) from jsonb_object_keys(item.value))<>2
     or jsonb_typeof(item.value->'platform')<>'string'
     or jsonb_typeof(item.value->'url')<>'string') then
   raise exception 'Each new public link needs exactly a platform and URL';
  end if;
  if (select count(distinct item.value->>'platform') from jsonb_array_elements(p_social_links) as item(value))<>jsonb_array_length(p_social_links) then
   raise exception 'Choose each social platform only once';
  end if;
  for link_item in select value from jsonb_array_elements(p_social_links) loop
   platform_value:=link_item->>'platform';
   original_url:=link_item->>'url';
   if platform_value !~ '^[a-z][a-z0-9_]{0,29}$'
    or not (platform_value=any(coalesce(enabled_platforms,'{}'::text[])))
    or not exists(select 1 from public.social_platforms c where c.key=platform_value) then
    raise exception 'Choose an enabled public social platform';
   end if;
   if exists(select 1 from public.social_links l where l.profile_id=p_user and l.platform=platform_value) then
    raise exception 'That platform already has a member link; ask the member to manage its value and privacy';
   end if;
   if original_url is null or original_url<>btrim(original_url) or length(original_url)>500 then
    raise exception 'Enter the member-supplied official social profile URL';
   end if;
   link_value:=original_url;
   if platform_value='whatsapp' then
    if original_url ~ '^[+]?[0-9 -]{7,20}$' then
     digit_value:=regexp_replace(original_url,'[^0-9]','','g');
     if length(digit_value) not between 7 and 20 then raise exception 'Enter a valid WhatsApp number';end if;
     link_value:='https://wa.me/'||digit_value;
    elsif original_url !~ '^https://wa[.]me/[0-9]{7,20}$' then
     raise exception 'Enter a valid WhatsApp number or wa.me link';
    end if;
   else
    if original_url !~ '^https://[^/@:#?]+/[^[:space:]<>]+$'
     or original_url ~ '[[:space:]<>]'
     or original_url ~ '^https://[^/@:#?]+/[?#]'
     or strpos(original_url,chr(92))>0 then
     raise exception 'Enter a valid official HTTPS social profile link';
    end if;
    host_value:=lower(split_part(split_part(original_url,'://',2),'/',1));
    if not exists(select 1 from public.social_platforms c
      cross join lateral unnest(c.hosts) permitted(host)
      where c.key=platform_value
       and (host_value=lower(permitted.host) or host_value='www.'||lower(permitted.host))) then
     raise exception 'Use the official host for this social platform';
    end if;
   end if;
   if not exists(select 1 from public.site_settings s where s.id and platform_value=any(s.enabled_platforms)) then
    raise exception 'This social platform is unavailable';
   end if;
   insert into public.social_links(profile_id,platform,url,is_public)
   values(p_user,platform_value,link_value,true);
   added_platforms:=array_append(added_platforms,platform_value);
  end loop;
 end if;

 -- Saving completion intentionally retains the installed trigger. Its award is
 -- still decided by the existing eligibility, capacity, and duplicate safeguards.
 had_launch_award:=exists(select 1 from public.launch_awards a where a.user_id=p_user);
 if cardinality(updated_fields)>0 then
  update public.profiles p set
   display_name=coalesce(display_value,p.display_name),
   username=coalesce(username_value,p.username),
   avatar_url=coalesce(avatar_value,p.avatar_url),
   bio=coalesce(bio_value,p.bio),
   country=coalesce(country_value,p.country),
   interests=coalesce(interest_values,p.interests)
  where p.id=p_user;
 end if;
 if not public.admin_feed_profile_complete(p_user) then
  raise exception 'Profile completion did not pass the existing server-side badge rules';
 end if;
 if not public.feed_profile_ready(p_user) then
  raise exception 'Add a supported new public link or ask the member to update their own link privacy';
 end if;
 missing_after:='{}'::text[];
 result:=jsonb_build_object(
  'request_id',p_request,'user_id',p_user,
  'updated_fields',to_jsonb(updated_fields),
  'added_platforms',to_jsonb(added_platforms),
  'profile_complete',true,'profile_ready',true,
  'missing_fields',to_jsonb(missing_after),
  'launch_reward_awarded',not had_launch_award and exists(
   select 1 from public.launch_awards a where a.user_id=p_user)
 );
 insert into public.audit_logs(actor_id,action,target,meta)
 values(actor,'member_profile_assisted',p_user::text,jsonb_build_object(
  'request_id',p_request,'payload_hash',fingerprint,'reason',trim(p_reason),
  'member_authorized',true,'updated_fields',to_jsonb(updated_fields),
  'added_public_platforms',to_jsonb(added_platforms),
  'profile_complete',true,'profile_ready',true,
  'launch_reward_awarded',result->'launch_reward_awarded','result',result));
 insert into public.notifications(user_id,title,body)
 values(p_user,'Profile details saved at your request',
  'With your permission, an administrator filled missing profile details and added any requested new public social links. Your Profile complete badge is based on saved profile fields; it is not identity, email, or KYC verification. Profile privacy and existing social-link visibility were not changed. Contact support if you did not authorize these updates.');
 return result;
end$$;

revoke all on function public.admin_member_profile_assist_status(uuid),
 public.admin_assist_member_profile(uuid,jsonb,jsonb,text,boolean,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.admin_member_profile_assist_status(uuid),
 public.admin_assist_member_profile(uuid,jsonb,jsonb,text,boolean,uuid) to authenticated;

-- No table rows, profiles, links, grants, wallets, launch rewards, or ledgers may
-- be changed by installing this capability.
do $$begin
 if (select snapshot from admin_member_profile_assist_preservation)
  is distinct from pg_temp.admin_member_profile_assist_snapshot() then
  raise exception 'Admin member profile assistance installer changed existing rows; abort';
 end if;
end$$;
notify pgrst,'reload schema';
commit;
