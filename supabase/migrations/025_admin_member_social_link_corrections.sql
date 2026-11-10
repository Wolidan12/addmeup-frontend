-- A narrowly scoped admin correction path for a member's already-public social link.
-- Ownership, link visibility and feed/listing timing remain unchanged.
begin;

create or replace function public.admin_update_member_social_link(
 p_link uuid,
 p_url text,
 p_reason text,
 p_member_confirmed boolean,
 p_request uuid
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
 prior_actor uuid;
 prior_action text;
 prior_target text;
 member_id uuid;
 member_is_public boolean;
 link_is_public boolean;
 link_platform text;
 old_url text;
 new_url text;
 host_name text;
 digit_string text;
begin
 perform public.require_active_account();
 if not public.admin_can('social_links') then
  raise exception 'Permission denied' using errcode='42501';
 end if;
 if p_link is null or p_request is null then raise exception 'Link and request reference required'; end if;
 if p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Provide an 8–1000 character reason'; end if;
 if p_member_confirmed is distinct from true then raise exception 'Confirm the member authorized this correction'; end if;
 if p_url is null or length(p_url)>500 or p_url<>btrim(p_url) then raise exception 'Enter a valid official social profile link'; end if;

 -- Serialize retries and prevent a request reference from being reused for another action.
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select a.actor_id,a.action,a.target into prior_actor,prior_action,prior_target
 from public.audit_logs a where a.meta->>'request_id'=p_request::text limit 1;
 if found then
  if prior_actor=auth.uid() and prior_action='member_social_link_updated' and prior_target=p_link::text then return; end if;
  raise exception 'Request reference unavailable';
 end if;

 select l.profile_id,p.is_public,l.is_public,l.platform,l.url
 into member_id,member_is_public,link_is_public,link_platform,old_url
 from public.social_links l
 join public.profiles p on p.id=l.profile_id
 where l.id=p_link
 for update of l,p;
 if not found then raise exception 'Social link not found'; end if;
 if member_id=auth.uid() then raise exception 'Use account settings to edit your own social link'; end if;
 if exists(select 1 from public.user_roles r where r.user_id=member_id and r.role<>'user') then
  raise exception 'Staff profile corrections require a separate security review';
 end if;
 if member_is_public is distinct from true or link_is_public is distinct from true then
  raise exception 'Only an already-public member link can be corrected';
 end if;
 if not exists(
  select 1 from public.site_settings s where link_platform=any(s.enabled_platforms)
 ) then raise exception 'This social platform is unavailable'; end if;

 new_url:=p_url;
 if link_platform='whatsapp' then
  if p_url ~ '^[+]?[0-9 -]{7,20}$' then
   digit_string:=regexp_replace(p_url,'[^0-9]','','g');
   if length(digit_string) not between 7 and 20 then raise exception 'Enter a valid WhatsApp number'; end if;
   new_url:='https://wa.me/'||digit_string;
  elsif p_url !~ '^https://wa[.]me/[0-9]{7,20}$' then
   raise exception 'Enter a valid WhatsApp number or wa.me link';
  end if;
 else
  if length(new_url)>500
   or new_url !~ '^https://[^/@:#?]+/[^[:space:]]+$'
   or new_url ~ '[[:space:]<>]'
   or new_url ~ '^https://[^/@:#?]+/[?#]'
   or strpos(new_url,chr(92))>0 then
   raise exception 'Enter a valid official HTTPS social profile link';
  end if;
  host_name:=lower(split_part(split_part(new_url,'://',2),'/',1));
  if not exists(
   select 1
   from public.social_platforms c cross join lateral unnest(c.hosts) as permitted(host)
   where c.key=link_platform
    and (host_name=lower(permitted.host) or host_name='www.'||lower(permitted.host))
  ) then raise exception 'Use the official host for this social platform'; end if;
 end if;

 if new_url=old_url then raise exception 'No change detected'; end if;
 update public.social_links set url=new_url where id=p_link and profile_id=member_id;
 if not found then raise exception 'Social link not found'; end if;

 -- Keep phone numbers out of audit metadata; the audit records who, why, which link,
 -- and the member-authorization attestation without duplicating the private value.
 insert into public.audit_logs(actor_id,action,target,meta)
 values(auth.uid(),'member_social_link_updated',p_link::text,jsonb_build_object(
  'reason',trim(p_reason),
  'profile_id',member_id,
  'platform',link_platform,
  'public_link',true,
  'member_authorized',true,
  'request_id',p_request
 ));
 insert into public.notifications(user_id,title,body)
 values(member_id,'Public profile link updated','An authorized administrator updated a social link on your public profile at your request. If you did not request this change, contact support.');
end;
$$;

revoke all on function public.admin_update_member_social_link(uuid,text,text,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_update_member_social_link(uuid,text,text,boolean,uuid) to authenticated;

commit;
