-- GATED additive manual workflow. Requires reviewed baseline Auth/admin tables and verified recovery.
-- No provider requests, billing, wallet updates or automatic delivery.
begin;
create function public.reseller_is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(public.admin_role()='super_admin' and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and (banned_until is null or banned_until<now())) and not exists(select 1 from public.account_restrictions where user_id=auth.uid()),false)
$$;
create table public.reseller_services(
 id text primary key, name text not null, description text not null, deliverable text not null,
 is_active boolean not null default true, fulfillment text not null default 'MANUAL' check(fulfillment='MANUAL')
);
insert into public.reseller_services(id,name,description,deliverable) values
 ('content-design','Content creation','Original graphics or copy, delivered manually with rights review.','Link to the finished content package'),
 ('campaign-plan','Campaign planning','A documented campaign strategy; no guaranteed follower or engagement counts.','Link to the campaign plan'),
 ('ad-creative','Paid-ad creative assistance','Prepare advertising assets. Ad spend and platform submission are separate and not performed here.','Link to the ad creative and instructions'),
 ('consent-review','Audience consent review','Review opt-in collection and opt-out procedures; no unsolicited outreach.','Link to the consent review report');
create table public.reseller_orders(
 id uuid primary key, service_id text not null references public.reseller_services(id),
 requested_by uuid not null references auth.users(id), title text not null check(length(trim(title)) between 3 and 120),
 brief text not null check(length(trim(brief)) between 10 and 4000), scope_confirmed boolean not null check(scope_confirmed),
 charge_dc numeric not null default 0 check(charge_dc=0),
 status text not null default 'SUBMITTED' check(status in ('SUBMITTED','IN_PROGRESS','COMPLETED','CANCELLED')),
 version integer not null default 1 check(version>0), delivery_url text, completion_note text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status<>'COMPLETED' or (delivery_url is not null and delivery_url~'^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' and completion_note is not null and length(trim(completion_note)) between 10 and 2000))
);
create index reseller_orders_queue on public.reseller_orders(status,created_at desc,id);
create index reseller_orders_actor on public.reseller_orders(requested_by,created_at desc);
create table public.reseller_events(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.reseller_orders(id) on delete restrict,
 actor_id uuid not null references auth.users(id),status text not null check(status in ('SUBMITTED','IN_PROGRESS','COMPLETED','CANCELLED')),
 note text not null check(length(trim(note)) between 10 and 2000), created_at timestamptz not null default now()
);
create index reseller_events_order on public.reseller_events(order_id,created_at,id);
do $$declare t text;begin foreach t in array array['reseller_services','reseller_orders','reseller_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('create policy reseller_admin_read on public.%I for select to authenticated using(public.reseller_is_admin())',t);
 execute format('grant select on public.%I to authenticated',t);
end loop;end$$;
create function public.reseller_create_order(p_id uuid,p_service text,p_title text,p_brief text,p_scope boolean) returns uuid
language plpgsql security definer set search_path=public as $$
declare old public.reseller_orders;
begin
 if not public.reseller_is_admin() then raise exception 'Permission denied' using errcode='42501';end if;
 if p_id is null or p_scope is distinct from true or p_title is null or length(trim(p_title)) not between 3 and 120 or p_brief is null or length(trim(p_brief)) not between 10 and 4000 then raise exception 'Invalid order';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old from public.reseller_orders where id=p_id;
 if found then
  if old.requested_by<>auth.uid() or old.service_id<>p_service or old.title<>trim(p_title) or old.brief<>trim(p_brief) then raise exception 'Request reference already used';end if;
  return p_id;
 end if;
 if not exists(select 1 from public.reseller_services where id=p_service and is_active) then raise exception 'Service unavailable';end if;
 insert into public.reseller_orders(id,service_id,requested_by,title,brief,scope_confirmed) values(p_id,p_service,auth.uid(),trim(p_title),trim(p_brief),true);
 insert into public.reseller_events(order_id,actor_id,status,note) values(p_id,auth.uid(),'SUBMITTED','Zero-charge manual request created');
 return p_id;
end$$;
create function public.reseller_update_order(p_id uuid,p_version integer,p_status text,p_note text,p_delivery_url text default null) returns void
language plpgsql security definer set search_path=public as $$
declare old public.reseller_orders;
begin
 if not public.reseller_is_admin() then raise exception 'Permission denied' using errcode='42501';end if;
 select * into old from public.reseller_orders where id=p_id for update;
 if not found then raise exception 'Order unavailable';end if;
 if p_version is distinct from old.version then raise exception 'Order changed. Refresh before updating.';end if;
 if p_note is null or length(trim(p_note)) not between 10 and 2000 then raise exception 'A meaningful review note is required';end if;
 if not ((old.status='SUBMITTED' and p_status in ('IN_PROGRESS','CANCELLED')) or (old.status='IN_PROGRESS' and p_status in ('COMPLETED','CANCELLED'))) or p_status is null then raise exception 'Invalid order transition';end if;
 if p_status='COMPLETED' and (p_delivery_url is null or length(p_delivery_url)>2000 or p_delivery_url!~'^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:]]*)?$') then raise exception 'HTTPS delivery evidence is required';end if;
 update public.reseller_orders set status=p_status,version=version+1,updated_at=now(),delivery_url=case when p_status='COMPLETED' then p_delivery_url else null end,completion_note=case when p_status='COMPLETED' then trim(p_note) else null end where id=p_id;
 insert into public.reseller_events(order_id,actor_id,status,note) values(p_id,auth.uid(),p_status,trim(p_note));
end$$;
revoke all on function public.reseller_is_admin(),public.reseller_create_order(uuid,text,text,text,boolean),public.reseller_update_order(uuid,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.reseller_is_admin(),public.reseller_create_order(uuid,text,text,text,boolean),public.reseller_update_order(uuid,integer,text,text,text) to authenticated;
commit;
