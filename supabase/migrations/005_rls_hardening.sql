-- 005 ADDITIVE hardening: close RLS gaps found in audit. Preserves all data.
alter table public.reward_config enable row level security;
alter table public.referrals enable row level security;
-- reward_config: NO client policies = clients can neither read nor write config; security-definer claim functions still work. Admins edit via SQL Editor/service role.
drop policy if exists "referrals own read" on public.referrals;
create policy "referrals own read" on public.referrals for select using(auth.uid()=referrer_id or auth.uid()=referred_id);
-- task_claims & profile_views intentionally have RLS with no client policies: only security-definer functions write them.
grant select on public.referrals to authenticated;
create index if not exists idx_social_links_profile on public.social_links(profile_id);
create index if not exists idx_points_ledger_user on public.points_ledger(user_id, created_at desc);
create index if not exists idx_reports_status on public.reports(status, created_at desc);
create index if not exists idx_payment_user on public.payment_transactions(user_id, created_at desc);
