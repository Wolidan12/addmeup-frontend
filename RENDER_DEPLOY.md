# Render + existing Supabase — current rollout gate

**31 October 2026: NO new Render deployment performed.** See `PRODUCTION_BLOCKERS_REPORT.md` for current evidence and `MIGRATION_RECONCILIATION.md` for the 024-before-016–023 correction. Historical bootstrap/admin self-grant instructions are superseded; do not replay them.

## Static frontend configuration

Use the existing Render Static Site, repository `Wolidan12/addmeup-frontend`, published domain `https://danqel-social-boost.onrender.com`. `render.yaml` specifies:

- Branch `main` (production configuration, not the Arena working branch).
- `npm ci && npm run build`; publish directory `dist`; Node `22.22.3`.
- SPA rewrite `/*` → `/index.html`.
- Revalidate HTML; no-store version marker/service worker/manifest; immutable hashed assets; nosniff/frame/referrer headers.
- Only public `VITE_SUPABASE_URL` and anon/publishable key. No service-role, SMTP, Paystack, VAPID-private or scheduler secrets in Render/browser variables.

The dashboard's actual branch/env/headers/domain and successful release deployment remain unverified. Repository configuration is not proof of live settings. This session must remain on `arena/24d9981d-addmeup-frontend`; no push, PR merge or automatic production deployment was performed. Production release requires reviewed integration through the owner's normal workflow after backend gates clear.

## Ordered release

1. Verify recovery and execute only the reviewed new forward reconciliation, with recorded postchecks. Never run the numbered migration directory blindly against this production project.
2. Configure/test SMTP, real staff sessions/ordinary denial, secure notification providers and statement-verified Moniepoint manual deposits. Production online funding remains disabled.
3. Produce a reviewed clean source release. Local `dist/version.json` currently truthfully says `sourceDirty: true`; do not announce it as a clean published release. Never edit the marker to hide dirty source.
4. Build/test, deploy the actual approved commit through Render, then inspect `/version.json` and real hashed asset responses. A generic 200 HTML SPA fallback is NOT proof a manifest/icon/asset exists. Run `EXPECTED_COMMIT=<approved-40-character-commit> node scripts/verify-production.mjs https://danqel-social-boost.onrender.com` from an environment with domain access.
5. Verify direct deep links/refresh, real login/token refresh, ordinary/admin authorization, manifest PNG/maskable icons, SW update lifecycle/cache headers, old-tab update banner/save-work flow, offline fallback and recovery. Keep Supabase Auth/financial/API data out of runtime caches.
6. Only announce a release after the exact clean commit is live and accepted; never publish notifications for failed/unpublished builds.

The last previously observed live marker was commit `d7bdd4607c9a3771dfba4e4210bc2c820304bce2`, built `2026-10-28T12:12:29.375Z`. It was not re-fetched in this continuation; no claim is made that current production has changed.
