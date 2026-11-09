# Email/password signup without email confirmation

Owner requested removal of the email-confirmation requirement for new users.

## Live Auth change

Production project `lohlvenibvohoxtfucfa`: read existing Auth configuration, changed only the requested `mailer_autoconfirm` setting to `true`, then read configuration again to verify it persisted. Email/password authentication remains enabled, signup remains enabled, anonymous sign-in remains disabled, and the configured site/redirect URLs and token expiry are unchanged. Password-reset emails and secure email-change confirmation remain enabled as before.

Auto-confirm is an onboarding policy, **not proof of mailbox ownership, identity, genuine mission activity or a bank payment**. No users were created for a production test; existing user rows, wallet balances, roles, ledgers, deposit orders and feature-spending settings were not modified. No bulk confirmation/backfill was performed for existing accounts. Actual existing-unconfirmed-account sign-in behavior has not been acceptance-tested.

## Frontend changes (deployment still required)

- A successful signup with an actual returned Auth session opens `/dashboard`.
- A sessionless signup response never fabricates authentication: it keeps the visitor on registration and offers ordinary password sign-in/password reset without claiming an email-confirmation message was sent.
- Beginner-guide signup instructions no longer require email confirmation.
- Legacy `/verify` routes and recovery handling are retained for historical accounts/links; admin authorization remains server-controlled.

Validation: `npm test`, `npm run test:deployment`, `npm run test:secrets`, `git diff --check` pass. Optional `tests/signup-session-browser.smoke.mjs` tests real local Chromium with mocked Auth/transport for signup-session navigation and refresh, no-session fallback and sanitized errors. These are not a live production signup/login test and do not prove Render deployment.

## Separate pending listing-policy decision

The owner stated that purchased DC should be used to list profiles in the feed. Existing UI distinguishes ordinary public directory visibility from paid promotion. Clarification requested: must *every* feed listing require purchased DC, or only promoted/featured placements? Purchased-only eligibility must be implemented and checked server-side, not inferred from a displayed combined wallet balance. No listing fee, duration, debit, reward restriction, wallet reclassification or broader financial migration was introduced in this auth change.
