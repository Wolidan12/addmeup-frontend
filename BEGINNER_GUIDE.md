# Beginner guide and sample profile

`/how-it-works` is available to visitors without signing in and inside the member workspace after sign-in.

Entry points:
- Homepage hero: **How it works**.
- Member dashboard: **New here? See how it works.** / **Show me the guide**.
- Member navigation: **How it works**.
- Public footer help links.

The three-step walkthrough explains the simplified Settings flow: display name/optional short bio and photo, separately public social links, then profile visibility and **Preview profile**. Username is reused from signup; optional extras are collapsed. It explains purchased-DC timed listings separately: open List my profile, choose the duration and confirm once. The working UI is backed by the forward installation in PAID_FEED_LISTING_POLICY.md; production backend installation is verified in PAID_FEED_LISTING_POLICY.md, separately from frontend deployment. A fictional sample card illustrates each step. Its sample connection/undo is local React state only: no profile, relationship, credit, reward or external social account is created or modified. Sample links are not clickable external accounts; the sample is never inserted into directory data or reused as a real `ProfileCard`.

The guide also explains free connections/favourites, social-password safety, the distinction between a completion badge and identity verification, optional DC deposits with independent admin bank verification, and the absence of guaranteed followers/engagement or cash withdrawals. Real setup CTAs point guests to registration and signed-in users to existing profile settings. There is no new schema, onboarding tracking, browser-storage preference or forced popup.

Validation:
- `npm test` includes `tests/how-it-works.test.mjs` (entry points, required instructional/safety copy, no tutorial network/storage mutation).
- `npm run test:deployment`, `npm run test:secrets`, `git diff --check` pass.
- Optional `tests/how-it-works-browser.smoke.mjs` passes with mocked Supabase transport/Auth, covering guest/member entry, ten portrait/landscape layouts (320–1440px), steps/back, connection/undo, FAQ, setup CTA, homepage/dashboard links and no sample mutation calls.
- Existing `tests/member-compatibility-browser.smoke.mjs` passes, including dashboard layouts and preservation of read-only wallet/deposit behavior.

Optional browser tools: install `playwright` and `@sparticuz/chromium` without saving dependencies; run a fixture-only Vite server at port 5174 with `VITE_SUPABASE_URL=https://test.supabase.co` and `VITE_SUPABASE_ANON_KEY=test-key`. Set `TEST_BASE_URL` if using a different port. These tests are not production-login or deployment evidence. No live records or balances were changed.

Email confirmation is no longer a signup step: production Auth auto-confirm is enabled at the owner’s request. This does not establish mailbox ownership or identity verification. Password recovery still uses email.
