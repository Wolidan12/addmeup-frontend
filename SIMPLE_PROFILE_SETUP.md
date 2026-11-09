# Simple member profile setup

## What changed

Settings now presents the existing profile editor as a short flow:

1. **Your profile**: display name (prefilled from the account), optional short bio, existing username shown as the profile address, and an explicit public-visibility choice. The existing photo uploader is retained.
2. **Your social link**: choose an enabled platform, enter a valid own-profile URL (or supported WhatsApp number), explicitly choose public visibility and save. Links remain private by default; no external passwords or verification claims.
3. **Feed listing time**: the working owner-state/purchase component reuses the saved profile, distinguishes purchased DC from total/reward DC, loads authoritative packages, confirms exact duration/cost once and shows real start/end/history. Backend unavailability fails closed. Saving profile details never purchases time. The same component is available at `/list-profile`.

Username editing, country, location, interests and categories are inside **Optional details & username**. Account/reward progress and notifications are collapsed separately, rather than occupying the top of the setup page. Advanced fields, social-link removal and account-deletion information remain available.

## Data and validation

`profileUpdate` reuses the existing allowlisted profile validation and omits unchanged optional fields/username. A basic name/bio edit therefore does not erase hidden optional data or overwrite optional values from an old form snapshot. Unchanged legacy optional values do not have to be repaired to save a basic edit; changed optional values are still validated. Explicit optional edits and clears are retained. The profile owner filter and database permissions remain authoritative; balance, role, XP and sponsorship fields cannot be submitted through the editor.

A synchronous in-flight ref blocks duplicate saves, social saves and removals while awaiting a request. Basic/social inputs are disabled while saving, unavailable or restricted. Invalid fields hidden inside optional details automatically reopen the disclosure for correction. Mobile styling wraps long content and keeps controls touch-sized.

## Validation

- `npm test`, `npm run test:deployment`, `npm run test:secrets`, and `git diff --check` passed during this change. After extending optional legacy-field preservation, focused simple-profile and account tests passed again.
- `tests/simple-profile.test.mjs` checks minimal payloads, preserved optional values/username, explicit edits/clears, unchanged legacy optional values, changed-value validation and absence of financial/grant fields.
- Optional real Chromium `tests/simple-profile-browser.smoke.mjs`: five portrait/landscape layouts (320–1440px), basic visible fields, empty optional bio, hidden-data preservation, duplicate-save suppression, optional edits, hidden invalid-field recovery, social URL validation/private default/public opt-in, sanitized failure/retry, restriction/owner filtering and read-only pricing with no financial mutation.
- Beginner-guide browser fixtures and member compatibility browser fixtures passed, including dashboard/deposit/wallet behavior.

Browser tests mock Auth and transport; they do not prove production login or deployment. No live user profiles, balances or feed eligibility were changed. The purchased-only feed backend and checkout are now implemented as described in `PAID_FEED_LISTING_POLICY.md`; production activation is still separately gated.
