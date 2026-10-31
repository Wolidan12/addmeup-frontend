# DANQEL — User account system

Implemented and checked on 31 October 2026, on the existing session branch and Supabase project. This work extends the existing React/Vite + Supabase Auth/Postgres/RLS architecture; it does not introduce another backend or replace any account database.

## Delivered

### Registration and authentication

- Registration now collects full name, email, unique username, password, password confirmation and explicit Terms/Privacy acceptance.
- Shared trusted frontend validation trims names, lowercases usernames/emails, rejects markup/control characters and mismatched passwords, and requires 8–128-character passwords.
- Supabase Auth receives only the permitted signup metadata. A database trigger creates a private profile with the chosen name/username and a server-timestamped, versioned consent record. Role/XP/sponsorship fields in signup metadata are ignored.
- Username availability uses a boolean-only RPC, with the unique database constraint providing final race protection. No email lookup RPC was introduced. Supabase's existing Auth email uniqueness remains authoritative; signup responses avoid email-account enumeration.
- Login remains **email/password**, matching the existing Auth design. A public username is not an email-resolution service or login credential.
- Existing persistent sessions, automatic refresh and logout are retained. Account-specific member trees are keyed by user ID; stale overview requests and inaccessible local storage are handled safely.
- Unverified-email sign-in errors link to verification resend. Verification status is checked against `auth.getUser()`, never trusted from a `?success=true` parameter.
- Password recovery requests and authenticated password updates retain Supabase Auth, safe redirects, bounded requests and sanitized error messages.

### Profile and social management

- Existing profile photograph, display name, unique username, biography, country and interests are retained.
- Added optional location and categories. Displayed registration date is server-owned and read-only.
- Creator XP and Creator Level are server-owned. XP is the sum of positive trusted check-in/task reward points; purchases, referrals, arbitrary adjustments and spending do not grant XP. Level is `1 + floor(XP / 100)`. Existing eligible ledger entries were backfilled into XP without creating credits or altering transactions.
- Growth Credits reuse the existing private points balance. They are not cash, withdrawable money or a new exchange-rate product.
- Consistent seven-part completion measure: display name, username, photo, bio, country, at least one interest and at least one social connection. Optional location/categories do not reduce completion. Public completion uses visible links only and can differ from the owner's private completion.
- Members can add/update links, control public visibility, and remove links through an accessible confirmation dialog. Disabled-platform links can still be removed.
- Eight built-ins: WhatsApp, Instagram, TikTok, Snapchat, Facebook, X, **YouTube and Telegram**.
- Super Admin can configure additional platforms, exact HTTPS hostname allowlists and enabled state in **Admin → Site & platforms → Custom social platforms**. Changes require a reason and are audit-logged. Built-in hostname definitions cannot be overwritten through this RPC.
- New YouTube/Telegram icons are bundled locally. Custom platforms use a neutral link icon.
- External links are validated before rendering and use `noopener noreferrer` / no-referrer. Malformed links do not become clickable.
- **No ownership-verification provider is configured.** The UI explicitly distinguishes format validation from ownership verification; it does not issue fake verified badges or ask for platform passwords.
- Managed listings remain the separately audited non-login listing feature, with their existing six-platform editor contract. They are not promoted into Auth accounts by this work.

## Live database changes — already applied, do not replay

1. `013_user_accounts.sql`: new profile fields and generated level, private consent records, public platform catalogue, official/custom-host validation, signup metadata handling, profile column grants, earned-XP trigger/backfill and audited custom-platform RPC.
2. `014_signup_rollout_compatibility.sql`: preserves the currently deployed email-only signup client during rollout. New full-details registrations strictly validate the complete metadata/consent contract. Metadata-free legacy registrations remain ordinary private accounts; no consent is fabricated for those users. This compatibility path means consent is **not a blanket Auth API requirement for metadata-free legacy clients**. Remove that compatibility path only in a coordinated rollout after the new registration form is deployed, if a universal server-side consent requirement is desired.
3. `015_account_financial_grants.sql`: removes ambient hosted-default browser DML grants on balances, ledger and roles in addition to existing read-only RLS policies. Trusted SECURITY DEFINER reward, payment and administrator operations retain access.

The existing owner remains `super_admin`; Auth account count remained **2**. Roles, balances and ledger fingerprints matched before/after:

| Record family | Matching fingerprint |
|---|---|
| Roles | `3bb83b6e95be7130e44e569253236c87` |
| Balances | `a931b27b188a1a50a5f1cce45cf5fa1f` |
| Ledger | `63654c22836ca70f14825511f7f018ee` |

Existing original-field profile fingerprints changed during the XP backfill: the profile validation trigger trims name, username, bio and country. Thus this is **not** a claim of byte-for-byte profile-text preservation. No profiles were deleted or recreated. New XP values matched the eligible ledger sum.

Final live read-only security checks:

- Both new tables have RLS; no public table lacks RLS.
- Browser public-table TRUNCATE grants: **0**.
- Authenticated direct balance UPDATE, ledger INSERT and role INSERT privileges: **false**.
- Financial/role INSERT/UPDATE/DELETE/ALL browser RLS policies: **0**.
- Profile ID, creation timestamp, sponsorship, XP and generated level are not user-updatable. Only an explicit permitted profile-column list is granted.
- Existing consent rows remain **0**; no historical acceptance was invented.

## Tests performed

- `npm test` passed, now including `tests/user-accounts.test.mjs`.
- The account test uses isolated PostgreSQL with hostile hosted-style default grants. It proves Auth-shaped metadata validation/consent, legacy compatibility without fabricated consent, atomic username collision rejection, ignored administrator spoofing, column restrictions, cross-user RLS denial, private/public social visibility, removal, built-ins/custom hosts, audited admin-only platform configuration, protected financial records and earned-only XP/levels.
- `tests/accounts-browser.smoke.mjs` passed with explicitly intercepted provider fixtures: registration/password mismatch/duplicate username, verification reminders/resend/anti-spoofing, simulated verified login and refresh, logout, profile edits/duplicate rejection/portrait upload, unsafe URL rejection, social private/public/edit/removal confirmation, custom-platform configuration, recovery request/password update and signed-out recovery denial.
- Auth, profile and platform-configuration layouts checked at **320px, 390px, 844px landscape, 768px tablet and 1440px desktop**, without document-level horizontal overflow.
- Existing `tests/member-browser.smoke.mjs` passed after account changes, preserving member/admin/commerce/listing/bulk workflows under fixtures.
- Production build and deployment-artifact checks passed. `git diff --check` passed. Secret-pattern scan rerun against source, build and account-test logs.

**These are not real GoTrue sign-ins, delivered emails, operator-owned mailbox verification, or real account recovery tests.** No production test account, password, email confirmation, role promotion or financial mutation was manufactured to simulate that proof.

## Live Auth inspection and remaining release steps

Observed existing project settings:

- Email Auth and signups enabled; email auto-confirm **off**; unverified-email sign-in **disallowed**.
- Actual refresh-token rotation enabled; access-token lifetime 3600 seconds.
- Production Site URL and production callback allowlist already target the Render app.
- **No custom SMTP host/sender configured**, built-in email rate limit 2/hour. Delivery to ordinary external mailboxes is therefore not established and may be restricted by the provider.
- Provider password minimum is currently **6**, while the new UI requires **8**. Set the Supabase Auth password minimum to at least 8 in the dashboard; the available configuration-update tool does not expose that setting. Do not claim the frontend rule alone enforces it at the Auth API.

Before calling this production-accepted:

1. Deploy the changed frontend to the existing Render service, retaining its existing public Supabase URL/anon-or-publishable key. No frontend deployment, commit or push was performed in this session.
2. Configure a trusted SMTP provider and sender, inspect delivery/rate limits, and raise the Auth password minimum to at least 8. Keep email confirmation required. Never put SMTP credentials or service-role keys in Vite variables.
3. Using an operator-controlled mailbox, register through the actual deployed form; confirm name/username, one private profile, one consent row and no privileged role. Follow the delivered confirmation link.
4. Test wrong-password and unverified sign-in, successful sign-in, refresh, cross-tab logout and re-login. Username login is intentionally not offered.
5. Update portrait/profile/interests/categories/location; test duplicate username and private/public/social removal behavior from a second browser/user.
6. Request a real recovery email, follow the link, update the password, verify the old password fails and the new one works. Test expired links and verify reminders.
7. Retest ordinary-user financial/role write denial through authenticated browser requests and real admin access through the trusted role path. Browser fixtures and SQL catalog checks do not substitute for this live acceptance.

Local optional browser tooling and fixture-server instructions are in `PREMIUM_REDESIGN.md`; the new account suite uses the same isolated `https://test.supabase.co` fixture setup. Do not deploy those fixture environment values.
