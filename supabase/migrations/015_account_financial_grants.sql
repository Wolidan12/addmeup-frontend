-- Defence in depth for hosted default ACLs: RLS already has read-only member policies,
-- but remove ambient browser DML grants on role and financial records as well.
begin;
revoke insert,update,delete,truncate,references,trigger on public.points_balance,public.points_ledger,public.user_roles from public,anon,authenticated;
grant select on public.points_balance,public.points_ledger,public.user_roles to authenticated;
-- Existing SECURITY DEFINER reward/payment/admin functions retain owner permissions.
commit;
