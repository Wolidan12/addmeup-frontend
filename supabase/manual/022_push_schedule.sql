-- Run ONLY after 022, Edge deployment and Vault setup. No secrets in this file.
-- Vault names: danqel_push_worker_url (your deployed /functions/v1/notification-worker URL)
-- and danqel_push_cron_secret (the same >=32-character value as PUSH_CRON_SECRET).
-- Use Supabase Vault UI/trusted CLI to set those; never put private values in Git/chat.
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Idempotently replace only our own job, never unrelated schedules.
select cron.unschedule(jobid) from cron.job where jobname='danqel-notification-minute';
select cron.schedule('danqel-notification-minute','* * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='danqel_push_worker_url'),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='danqel_push_cron_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=90000
 );
$job$);
-- Verify cron.job_run_details and net._http_response in the trusted dashboard.
-- A successful HTTP enqueue is NOT evidence of device delivery. Monitor push_attempts too.
