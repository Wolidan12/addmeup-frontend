-- Independent, idempotent least-privilege hardening; safe on the existing 015 catalog
-- as well as after 023. No records, Auth identities or financial amounts are changed.
begin;
revoke create on schema public from public,anon,authenticated;
revoke truncate,references,trigger on all tables in schema public from public,anon,authenticated;
alter default privileges in schema public revoke truncate,references,trigger on tables from public,anon,authenticated;
-- These resources are written by trusted audited functions, never direct browser DML.
-- Notification read-state is re-granted explicitly after the blanket table revoke.
revoke insert,update,delete on public.account_consents,public.account_restrictions,public.audit_logs,public.bank_point_orders,public.bank_transfer_details,public.boost_plans,public.managed_profile_batches,public.managed_profiles,public.payment_transactions,public.point_packages,public.points_balance,public.points_ledger,public.profile_views,public.promotions,public.purchases,public.referral_purchase_rewards,public.referrals,public.reward_config,public.reward_tasks,public.site_settings,public.social_platforms,public.subscriptions,public.task_claims,public.user_boosts,public.user_roles from public,anon,authenticated;
revoke insert,update,delete on public.notifications from public,anon,authenticated;
grant update(is_read) on public.notifications to authenticated;
commit;
