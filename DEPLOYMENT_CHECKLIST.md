# Danqel Social Boost — Deployment Checklist
## Completed in code
- [x] React+Vite+Tailwind app, premium dark UI, homepage sections, reusable components
- [x] Auth flows (register/login/logout/reset/verify redirect), protected routes, session persistence (Supabase) + labelled demo fallback
- [x] Discover/search/filter/pagination, profile detail, favourites, report/block, view tracking RPC, sponsored labels, wa.me encoding, safe external links
- [x] Rewards UI backed only by security-definer RPCs; ledger, streaks, tasks, referrals in SQL
- [x] Migrations 001–003 with RLS (own-profile writes only; no client writes to ledger/balance)
- [x] PWA: vite-plugin-pwa, manifest, SVG icons 192/512, offline fallback, NetworkOnly for Supabase (no sensitive caching), prompt update strategy
- [x] Render Static Site SPA rewrite (render.yaml) + security headers; legal/privacy/terms/cookies/support/delete pages; 404; SEO meta; labels/keyboard focus styles
- [x] Production build passes (see README)
## Outstanding / owner-only (requires YOUR credentials — not done, not claimed)
- [ ] Create Supabase project; set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in Render env (never service-role key in browser)
- [ ] Apply supabase/migrations 001→003 in SQL Editor; enable email confirmations; set Site URL/redirects to your Render domain
- [ ] Verify RLS with two test accounts (edit other's profile must fail); test referral/check-in duplicate claims
- [ ] Replace support@example.com placeholder; review legal copy with counsel
- [ ] Add real PNG icons (192/512) if desired (SVG provided), submit to search consoles, custom domain + HTTPS in Render
- [ ] Payments: NO payment/webhook code exists — do not claim payment verification until a provider (e.g. Paystack/Stripe) is integrated server-side with webhook signature checks
- [ ] Admin authorization: create admin role policy before enabling sponsored flags/config edits

- [ ] RENDER: create Static Site per RENDER_DEPLOY.md; run migration 004 only; set Supabase Auth URLs to Render URL; deploy Edge Functions + PAYSTACK_SECRET_KEY secret before taking payments

- [ ] Run migrations 004 then 005 in SQL Editor (additive only). Verify with 2 accounts: editing another user's profile, claiming check-in twice, and opening /admin without a user_roles row must all fail.
