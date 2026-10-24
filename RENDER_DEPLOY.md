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
1. Already applied by owner: migrations 001-003 (APPLY_ALL). Now run ONLY supabase/migrations/004_admin_payments_storage.sql in SQL Editor (additive, preserves data).
2. Make yourself admin: edit last lines of 004: insert into public.user_roles(user_id,role) select id,'admin' from auth.users where email='YOUR_EMAIL'; (run after registering)
3. Auth -> URL Configuration: Site URL=https://YOUR-RENDER-URL.onrender.com ; Redirects: https://YOUR-RENDER-URL.onrender.com/** (+ localhost for dev). Delete/replace old Netlify/localhost entries as needed.
4. Edge Functions (only for payments/admin secrets): supabase secrets set PAYSTACK_SECRET_KEY=... ; supabase functions deploy verify-payment payment-webhook admin-action ; set Paystack webhook URL to https://lohlvenibvohoxtfucfa.supabase.co/functions/v1/payment-webhook
5. Storage bucket avatars is created by 004.
## Netlify removed: netlify.toml deleted. Do not deploy to Netlify/Railway.
