-- Narrow READ-ONLY improvement. No old migration replay, account/wallet/data changes,
-- new staff scope, deposit approvals or financial mutation helpers.
begin;
create function public.admin_user_directory(p_search text default '',p_status text default '',p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin
 perform public.require_active_account();
 if not public.admin_can('profiles') then raise exception 'Permission denied' using errcode='42501';end if;
 if p_page is null or p_page<0 or p_page>100000 or p_search is null or length(p_search)>200 or p_status is null or p_status not in ('','verified','unverified','suspended') then raise exception 'Invalid user directory filter';end if;
 with matching as (
  select p.*,u.email,u.email_confirmed_at is not null as email_confirmed,
   exists(select 1 from public.account_restrictions r where r.user_id=p.id) or coalesce(u.banned_until>now(),false) as suspended,
   coalesce((select role from public.user_roles where user_id=p.id),'user') as staff_role
  from public.profiles p join auth.users u on u.id=p.id
  where (p_search='' or p.id::text=p_search or concat_ws(' ',p.username,p.display_name,u.email) ilike '%'||p_search||'%')
 ), filtered as (select * from matching where p_status='' or (p_status='verified' and email_confirmed) or (p_status='unverified' and not email_confirmed) or (p_status='suspended' and suspended))
 select jsonb_build_object('rows',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from(select * from filtered order by created_at desc,id limit 25 offset p_page*25)r),'total',(select count(*) from filtered)) into result;
 return result;
end$$;
revoke all on function public.admin_user_directory(text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_user_directory(text,text,integer) to authenticated;
commit;
