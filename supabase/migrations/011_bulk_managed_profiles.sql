-- Additive: bounded, atomic, create-only managed listings. Never creates Auth users.
begin;
create table public.managed_profile_batches(
 id uuid primary key, actor_id uuid not null, payload_hash text not null,
 result jsonb not null, created_at timestamptz not null default now()
);
alter table public.managed_profile_batches enable row level security;
revoke all on public.managed_profile_batches from public,anon,authenticated;

create or replace function public.validate_managed_profile(p_data jsonb) returns void
language plpgsql set search_path=public as $$
declare link jsonb; item jsonb; pattern text; avatar text;
begin
 if jsonb_typeof(p_data) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('username','display_name','bio','country','interests','avatar_url','social_links','is_public')) then raise exception 'Invalid listing fields'; end if;
 if jsonb_typeof(p_data->'username') is distinct from 'string' or p_data->>'username' !~ '^[a-z0-9_]{3,24}$' then raise exception 'Invalid listing username'; end if;
 if jsonb_typeof(p_data->'display_name') is distinct from 'string' or length(trim(p_data->>'display_name')) not between 1 and 60 then raise exception 'Invalid display name'; end if;
 if jsonb_typeof(p_data->'is_public') is distinct from 'boolean' then raise exception 'Choose listing visibility'; end if;
 if p_data ? 'bio' and (jsonb_typeof(p_data->'bio') is distinct from 'string' or length(p_data->>'bio')>280) then raise exception 'Invalid bio'; end if;
 if p_data ? 'country' and (jsonb_typeof(p_data->'country') is distinct from 'string' or length(p_data->>'country')>80) then raise exception 'Invalid country'; end if;
 if jsonb_typeof(p_data->'interests') is distinct from 'array' or jsonb_array_length(p_data->'interests')>10 then raise exception 'Use at most ten interests'; end if;
 for item in select * from jsonb_array_elements(p_data->'interests') loop
 if jsonb_typeof(item)<>'string' or length(trim(item#>>'{}')) not between 1 and 40 then raise exception 'Invalid interest'; end if;
 end loop;
 avatar:=p_data->>'avatar_url';
 if avatar is not null and avatar<>'' and (length(avatar)>2048 or avatar !~ '^https://[A-Za-z0-9.-]+/[^[:space:]<>]*$') then raise exception 'Photo URL must use HTTPS'; end if;
 if jsonb_typeof(p_data->'social_links') is distinct from 'array' or jsonb_array_length(p_data->'social_links')>6 then raise exception 'Invalid social links'; end if;
 if (select count(distinct x->>'platform') from jsonb_array_elements(p_data->'social_links') x)<>jsonb_array_length(p_data->'social_links') then raise exception 'Duplicate platforms'; end if;
 for link in select * from jsonb_array_elements(p_data->'social_links') loop
 if jsonb_typeof(link) is distinct from 'object' or exists(select 1 from jsonb_object_keys(link) k where k not in ('platform','url','is_public')) or jsonb_typeof(link->'url') is distinct from 'string' or jsonb_typeof(link->'is_public') is distinct from 'boolean' then raise exception 'Invalid social link fields'; end if;
 pattern:=case link->>'platform'
 when 'whatsapp' then '^https://wa\.me/[0-9]{7,20}$'
 when 'instagram' then '^https://(www\.)?instagram\.com/[^[:space:]<>]+$'
 when 'snapchat' then '^https://(www\.)?snapchat\.com/[^[:space:]<>]+$'
 when 'tiktok' then '^https://(www\.)?tiktok\.com/[^[:space:]<>]+$'
 when 'facebook' then '^https://(www\.)?facebook\.com/[^[:space:]<>]+$'
 when 'x' then '^https://(www\.)?(x|twitter)\.com/[^[:space:]<>]+$' end;
 if pattern is null or link->>'url' !~ pattern or length(link->>'url')>500 then raise exception 'Social URL must use the official HTTPS platform domain'; end if;
 end loop;
end$$;
revoke all on function public.validate_managed_profile(jsonb) from public,anon,authenticated;

create or replace function public.admin_bulk_create_managed_profiles(p_batch uuid,p_rows jsonb,p_reason text,p_confirm boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare previous public.managed_profile_batches; fingerprint text; row_data jsonb; new_id uuid;
 ids jsonb:='[]'; result jsonb; row_number int:=0;
begin
 if auth.uid() is null or public.admin_role() is distinct from 'super_admin' then raise exception 'Permission denied' using errcode='42501'; end if;
 if p_confirm is distinct from true or p_batch is null or p_reason is null or length(trim(p_reason)) not between 8 and 1000 then raise exception 'Confirm permission and provide a reason'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 25 or octet_length(p_rows::text)>524288 then raise exception 'A batch must contain 1 to 25 listings'; end if;
 perform pg_advisory_xact_lock(hashtextextended('managed-batch:'||p_batch::text,0));
 fingerprint:=md5(p_rows::text||trim(p_reason));
 select * into previous from public.managed_profile_batches where id=p_batch;
 if found then
  if previous.actor_id<>auth.uid() or previous.payload_hash<>fingerprint then raise exception 'Batch reference already used with different details'; end if;
  return previous.result;
 end if;
 if (select count(distinct x->>'username') from jsonb_array_elements(p_rows) x)<>jsonb_array_length(p_rows) then raise exception 'Duplicate usernames in batch'; end if;
 -- Validate the whole batch first. Every insert/audit rolls back on any failure.
 for row_data in select * from jsonb_array_elements(p_rows) loop
  row_number:=row_number+1;
  begin
   perform public.validate_managed_profile(row_data);
   if exists(select 1 from public.managed_profiles where username=row_data->>'username') or exists(select 1 from public.profiles where username=row_data->>'username') then raise exception 'Username is already used'; end if;
  exception when others then raise exception 'Listing % is invalid: %',row_number,sqlerrm; end;
 end loop;
 for row_data in select * from jsonb_array_elements(p_rows) loop
  new_id:=gen_random_uuid();
  perform public.admin_save_managed_profile(new_id,row_data,p_reason);
  ids:=ids||jsonb_build_array(new_id);
 end loop;
 result:=jsonb_build_object('count',jsonb_array_length(p_rows),'ids',ids,'batch_id',p_batch);
 insert into public.managed_profile_batches(id,actor_id,payload_hash,result) values(p_batch,auth.uid(),fingerprint,result);
 insert into public.audit_logs(actor_id,action,target,meta) values(auth.uid(),'managed_profiles_bulk_created',p_batch::text,jsonb_build_object('reason',trim(p_reason),'count',jsonb_array_length(p_rows),'ids',ids));
 return result;
end$$;
revoke all on function public.admin_bulk_create_managed_profiles(uuid,jsonb,text,boolean) from public,anon;
grant execute on function public.admin_bulk_create_managed_profiles(uuid,jsonb,text,boolean) to authenticated;
commit;
