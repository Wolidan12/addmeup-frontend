# Danqel — Render + Supabase (exact settings)
## Render Static Site (frontend ONLY — no Node/Express backend)
Render Dashboard -> New -> Static Site -> connect GitHub repo Wolidan12/addmeup-frontend (branch with latest code / merged PR)
- Name: danqel-social-boost
- Build Command: npm ci && npm run build
- Publish Directory: dist
- Environment variables (public, frontend-safe):
  VITE_SUPABASE_URL=https://lohlvenibvohoxtfucfa.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_lHs-TyUoDiSN-mV3wECoHw_3VgnFYU-   (publishable key - safe in browser; protected by RLS)
  NODE_VERSION=20
- SPA fallback: render.yaml in repo already sets rewrite /* -> /index.html (or Dashboard -> Redirects/Rewrites: Source /* Action Rewrite Destination /index.html)
These values are also committed in render.yaml so Render Blueprint import works. NEVER add service_role/Paystack secret to Render.
## Supabase (existing project lohlvenibvohoxtfucfa — DO NOT create a new one)
1. Already applied by owner: migrations 001-003 (APPLY_ALL). Now run ONLY supabase/migrations/004_admin_payments_storage.sql, then 005_rls_hardening.sql, in SQL Editor (both additive, preserve data/accounts).
2. Make yourself admin: edit last lines of 004: insert into public.user_roles(user_id,role) select id,'admin' from auth.users where email='YOUR_EMAIL'; (run after registering)
3. Auth -> URL Configuration: Site URL=https://YOUR-RENDER-URL.onrender.com ; Redirects: https://YOUR-RENDER-URL.onrender.com/** (+ localhost for dev).
4. Edge Functions (only for payments/admin secrets): supabase secrets set PAYSTACK_SECRET_KEY=... ; supabase functions deploy verify-payment payment-webhook admin-action ; set Paystack webhook URL to https://lohlvenibvohoxtfucfa.supabase.co/functions/v1/payment-webhook
5. Storage bucket avatars is created by 004.

## Production verification status (honest)
- Local: production build + tests pass (see README). SPA fallback verified locally via vite preview (deep links return index.html).
- NOT verified from the build sandbox (outbound to supabase.co is blocked there): live registration/login, RLS attack tests, Edge Function deploys, Render deploy. Owner runs the checklist in DEPLOYMENT_CHECKLIST.md after deploying.
- Reward claims use Supabase Postgres security-definer RPCs (trusted server-side inside Supabase) - no separate server and no client-side point awards. Edge Functions are used where external secrets are required (payments/admin).
- Unimplemented (do not claim live): actual Paystack checkout UI + taking live payments (Edge Functions are ready to deploy; provider account/secrets + webhook setup are owner steps), push notifications, AI features (no AI keys anywhere).
