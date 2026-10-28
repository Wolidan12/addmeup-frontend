# Old website / dashboard access: deployment recovery

## What the screenshot establishes

The old green “Live — connected to Supabase” banner, old Discover form and letter-only avatars belong to the pre-dashboard UI. That banner is absent from the merged main source. The screenshot also shows **Log in**, not a signed-in session. It does not establish whether Render has an old release, an old browser/PWA cache is controlling the page, or both.

PR #2 was merged into main at `cda761dc6d5ed9e84aa79a6077e48801aa8dcfb1`. Merging a PR is not evidence of a successful Render deployment or Supabase migration. No Render deployment access was available from this workspace. No new Railway backend is required to resolve this.

## 1. Check the actual Render release

In Render, open the **existing static site** serving `danqel-social-boost.onrender.com`:

- Repository: `Wolidan12/addmeup-frontend`.
- Branch: **main**, not the old feature branch.
- Build: `npm ci && npm run build`.
- Publish directory: `dist`.
- SPA rewrite: `/*` to `/index.html` (Rewrite, not Redirect).
- Check the Events/Deploys page. The latest successful commit must include PR #2, or a later main commit. A deploy still in progress or a failed build leaves the previous release live.
- Use **Manual Deploy → Clear build cache & deploy** to build the latest main code. If the main release does not match the expected commit, correct the connected branch/repository first.
- Existing dashboard-created services do not necessarily adopt a changed `render.yaml` automatically. Apply/sync the branch, build, rewrite and header settings to the actual service.

This recovery patch also needs to be merged/deployed to get its release marker and PWA fixes. After that, open `/version.json?check=<unique-value>` in a fresh private window. It returns only a Git commit and build timestamp. Compare that commit with Render's successful deployment commit. Before this patch is deployed, that URL may return old HTML/404 and is not a valid release marker.

## 2. Separate server staleness from browser caching

Open the website in a **new incognito/private window**, not the installed PWA:

- Old banner there too: first investigate Render branch/build/deployment. Repeated refreshes of the original browser cannot deploy new source code.
- New design in private browsing but old design in the normal browser: the normal browser has an old cached app/service worker.

For one-time old-PWA recovery in Chrome:

1. Save any unsent forms and close other Danqel tabs.
2. DevTools → Application → Service Workers → **Unregister** for this origin.
3. DevTools → Application → Cache Storage → remove the **Danqel/Workbox app caches** for this origin, then reload the page with the network online.
4. Avoid deleting Local Storage unless necessary: it holds the sign-in session. If you choose Clear site data instead, expect to sign in again.
5. Reopen/update an installed PWA after verifying the ordinary website is current.

The patch adds an explicit **Update now / Later** prompt, checks for updates when the browser regains focus/network, and uses network-first document navigation rather than treating every navigation as the offline page. It never automatically reloads an unfinished form. An already-running old client without the new prompt may still need the one-time recovery above.

Render headers revalidate documents/service-worker assets; `/version.json` must not be cached. The deployment marker is not precached. Supabase API requests remain network-only; no account/payment data is cached by this update.

## 3. Sign in to the right dashboard

- Member workspace: `https://danqel-social-boost.onrender.com/dashboard`.
- Staff workspace: `https://danqel-social-boost.onrender.com/admin`.

Both require a real Supabase Auth sign-in. The new login flow preserves `/admin` (including selected section) or `/dashboard` through authentication, rather than always sending staff to the member dashboard. Admin additionally requires a database staff role; membership does **not** imply admin privileges. No frontend bypass or automatic promotion is added.

## 4. Check the existing Supabase backend separately

Run `supabase/diagnostics/dashboard_readiness.sql` in the **existing** project's SQL Editor. It is read-only and reports whether required RPC functions exist. It does not grant roles, modify data, or prove complete policy correctness.

- Missing functions: compare actual schema/migration history; apply **only missing migrations 006–010**, in order, after the existing schema, in staging first. Do not rerun the bootstrap SQL bundle against production tables.
- Functions present but member workspace fails: check authenticated RPC errors and live schema/RLS compatibility, not just function names.
- Admin denied: a trusted project owner must verify your registered Auth user UUID and grant the intended role using the documented bootstrap instructions in `ADMIN_DASHBOARD.md`. Do not send passwords, service-role keys or access tokens in chat.
- Set Auth Site URL and login/reset redirect allowlist to the deployed domain. Browser keys must belong to the same existing Supabase project.

An old frontend banner is not caused by missing database migrations. Conversely, publishing new frontend assets will not create the new backend functions. Both deployment layers must be verified independently.

## Changes in this recovery patch

- `vite.config.js`: public commit/timestamp release marker; network-first same-origin HTML with offline fallback; outdated-cache cleanup and network-only release/API requests.
- `src/components/AppUpdate.jsx`, `src/main.jsx`, `src/index.css`: visible, user-approved app-update flow.
- `src/App.jsx`, `src/pages/AuthPages.jsx`, `src/lib/navigation.js`: safe login return destinations, already-signed-in redirect and handled sign-in failures.
- `render.yaml`: explicit main branch and cache revalidation headers.
- Read-only readiness SQL and regression/artifact tests. No new schema migration or Node backend.

## Verification limits

`npm test` and `npm run test:deployment` validate local navigation rules, existing database tests, production build, release marker, update prompt inclusion and generated worker strategy. They do not verify the live Render release, real-browser old-worker-to-new-worker lifecycle, HTTP headers on the actual service, or live Supabase schema/roles. Those require the deployment and private-window checks above. Existing dependency advisories remain outstanding.
