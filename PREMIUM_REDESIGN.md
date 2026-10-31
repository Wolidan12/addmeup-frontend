# DANQEL SOCIAL BOOST — Signal edition

Implemented 31 October 2026 on `arena/24d9981d-addmeup-frontend`.

## Design and implementation

- Black/charcoal foundation, electric violet/blue/cyan lighting, locally bundled Space Grotesk display typography and Manrope body type. No remote font service or generated fictional people.
- Shared responsive surfaces, typography, actions, form controls, social cards, tables, empty/loading/error states, dialogs and safe-area-aware navigation in `src/design/premium.css`.
- Original CSS brand constellation built around the supplied logo and official social-platform icons, shared across the landing, authentication, member and admin experiences.
- Split editorial/form authentication layout shared by registration, login, staff login, verification and password recovery/reset. Existing authentication handlers and validation remain intact.
- Member creator-studio dashboard with a personal passport, profile-readiness progress, real account metrics, action cards and activity.
- Refreshed gallery discovery, public/member creator dossiers, saved connections, profile settings, referrals, capped point boosters, promotions, subscriptions, payments, help and legal pages.
- Distinct administrator control-room overview; consistent operations styling across all 23 resource sections, searchable records, managed-profile cards, chart, detail/action/create/bulk dialogs and access/error states.
- Mobile sidebars have inert closed navigation, focus containment, Escape/explicit close, focus restoration and background-scroll locking. Bottom member navigation includes Overview, Explore, Saved, Wallet and Inbox.
- Wide tables scroll inside their own surfaces instead of widening the page. Responsive checks include narrow phones, landscape and tablets. Reduced-motion mode disables decorative animation.
- Official supplied artwork remains in all shared chrome, install icons, manifest and offline fallback. Metadata now uses **CONNECT. ENGAGE. GROW.** and the viewport enables iPhone safe areas.

## Route coverage

| Area | Actual routes / implementation |
|---|---|
| Landing | `/` — editorial hero, constellation, community gallery and real catalogue availability |
| Authentication | `/register`, `/login`, `/admin/login`, `/verify`, `/forgot-password`, `/reset-password` — shared new split experience |
| Dashboard | `/dashboard` — personal creator studio |
| Discovery & profile | `/discover`, `/profile/:username`, `/listing/:username` — gallery / creator dossier |
| Connections **new** | `/connections` — own `favourites`, server-side pagination, private/unavailable-profile state and removal |
| Growth Wallet **new** | `/wallet` — existing balance, streak, multiplier and own paginated `points_ledger` |
| Missions **new** | `/missions` — existing eligible `reward_tasks`, profile-link actions and trusted claim/check-in RPCs |
| Buy Growth Credits **new** | `/credits` — existing points purchase workflow, admin-configured package prices and bank-transfer process |
| Rewards & leaderboard **new** | `/leaderboard` — own recorded progress, navigation to missions/wallet, explicit unpublished public-ranking state |
| Legacy rewards | `/rewards` remains a combined wallet/tasks/purchase view for existing links |
| Boost Center | `/boosts` — existing capped booster plans and activation confirmation |
| Referrals | `/referrals` — existing referral link, configured rates and actual earnings |
| Promotions / campaigns | `/promotions` — existing promotion catalogue; no invented checkout/fulfilment |
| Subscriptions | `/subscriptions` — existing packages/records, not a new payment product |
| Deposit/payment history | `/payments` — existing payment records and transfer status |
| Notifications **new** | `/notifications` — private paginated inbox, user-scoped mark-as-read and header refresh; existing settings inbox retained |
| Settings | `/settings` — existing portrait, profile, privacy and social-link workflows |
| Help / legal / error | `/support`, `/privacy`, `/terms`, `/cookies`, `/delete-account`, wildcard — consistent typography/surfaces, help destination cards |
| Administration | `/admin` overview and every existing `?view=` resource; existing permission/RPC architecture preserved |

“Growth Credits” means the platform's existing points. It does not introduce cash balances, withdrawal rights, new exchange rates or a separate currency ledger.

## Verification performed

- `npm test` — passed, including isolated PostgreSQL permission/migration tests and existing validation/security/branding gates.
- `npm run test:deployment` — passed after the redesign; production build, release marker, approved icons, manifest and offline precache checked.
- `tests/member-browser.smoke.mjs` — passed with explicitly intercepted Supabase fixtures: supplied logo loading, member flows, booster dialog, commerce, managed-profile creation/bulk retry, mocked staff sign-in/refresh/denial/timeout and sanitized errors.
- `tests/premium-browser.smoke.mjs` — passed with explicit network fixtures:
  - public and member routes plus all 23 administrator resource sections at **320px and 1440px**;
  - core screens at **360×780, 390×844, 844×390, 768×1024, 1024×768, 1440×1000**;
  - no document-level horizontal overflow at checked route/size combinations;
  - mobile drawer focus containment, Escape and inaccessible closed navigation;
  - saved-profile removal, notification read, separate wallet/missions/credits composition;
  - reduced-motion rendering, no uncaught browser exceptions and no Vite error overlay.
- Desktop/mobile screenshots visually inspected, including landing, member, authentication and admin. Screenshot accounts/metrics are explicitly browser-test fixtures, not production activity.
- Secret-pattern scan: **270 text sources/blobs**, including production assets and test logs; no supported private-credential patterns found.
- `git diff --check` — passed.
- Dependency audit still reports **2 low, 8 moderate, 0 high, 0 critical** advisories. No forced dependency downgrade performed.

### Reproducing the optional browser tests

Install the optional local browser tooling without changing application dependencies:

```sh
npm install --no-save --package-lock=false playwright @sparticuz/chromium
VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=test-key npm run dev -- --host 0.0.0.0
# In another terminal, run each test:
node tests/member-browser.smoke.mjs
node tests/premium-browser.smoke.mjs
```

Chromium system libraries must be available. This sandbox needed `LD_LIBRARY_PATH=/home/user/.cache/browser-libs/lib`. These fixtures intercept browser requests; do not deploy the fixture environment values. No mock data was added to application production code or Supabase.

## Preserved architecture and remaining acceptance

- Existing React/Vite on Render + Supabase Auth/Postgres/RLS/RPC architecture retained. No separate backend, production reset, new credentials, administrator promotion or production data mutation was performed for this redesign.
- No new database migration is required for the new destination pages. Previously applied migration 012 belongs to the earlier security work and **must not be replayed**.
- Public rankings are **not implemented as fabricated data**. A real public leaderboard requires a privacy-approved ranking contract/backend source before standings can be published; current UI states this clearly.
- Promotions remain the existing catalogue, not a newly implemented campaign management/automated fulfilment system.
- Real administrator/ordinary-user authentication, live reward claims, real-money transfer approval, payment-provider webhook deployment, installed PWA and physical iPhone/Android/Safari/Windows-device acceptance were **not** proven by these fixtures. Real accounts, configured packages/provider functions and operator-controlled test funds are needed for those acceptance tests.
- Existing live business setup blockers documented in `MASTER_PROJECT_AUDIT.md` (unpublished packages/support details and undeployed payment functions at the prior audit) were not silently filled with invented prices or contacts.
- Frontend changes are saved locally on the session branch. No commit, push, Render deployment or verification of a newly deployed production UI has been performed. Existing Render frontend environment variables must be retained when deploying.
