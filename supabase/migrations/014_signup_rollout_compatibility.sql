-- Keep the currently deployed email-only frontend usable during the account-form rollout.
-- Full-details registrations are strictly validated; legacy metadata-free signups remain
-- ordinary, private, email-verification-required accounts, with NO fabricated consent record.
begin;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare metadata jsonb:=coalesce(to_jsonb(new)->'raw_user_meta_data','{}'); chosen text; full_name text; modern boolean;
begin
 modern:=metadata ? 'username' or metadata ? 'full_name' or metadata ? 'terms_accepted';
 if modern then
  chosen:=lower(trim(metadata->>'username'));full_name:=trim(metadata->>'full_name');
  if chosen is null or chosen !~ '^[a-z0-9_]{3,24}$' or full_name is null or length(full_name) not between 1 and 60 or full_name ~ '[[:cntrl:]<>]' or metadata->>'terms_accepted' is distinct from 'true' then raise exception 'Valid account details and terms acceptance are required'; end if;
 else
  chosen:='user_'||case when to_jsonb(new) ? 'raw_user_meta_data' then substr(md5(new.id::text),1,19) else substr(new.id::text,1,8) end;full_name:='New creator';
 end if;
 insert into public.profiles(id,username,display_name,is_public) values(new.id,chosen,full_name,not (to_jsonb(new) ? 'raw_user_meta_data'));
 if modern then insert into public.account_consents(user_id,terms_version) values(new.id,'2026-10-31'); end if;
 return new;
end$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
commit;
