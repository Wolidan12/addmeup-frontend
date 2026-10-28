# Owner-assisted recovery: missing admin functions

> **Current status:** See [RELEASE_011.md](../../RELEASE_011.md) for stage 007–011 recovery, the latest owner evidence, tests and live-verification limitations. The earlier procedure below is historical: **do not replay completed 005/006 or the role grant.**

Owner-provided SQL Editor screenshots show `is_admin()` exists, but `admin_role`, `admin_can`, `admin_list`, `admin_mutate`, `admin_overview`, `account_restrictions` and `member_overview` are absent. The intended existing account's email is confirmed, its ban is null and its assigned role is null. These are screenshot-established findings, not a direct privileged connection from Arena.

The attempted role grant raised its missing-function guard before any role change. Do not bypass that guard, delete the database or recreate Auth users.

## Latest owner-reported production state

Subsequent SQL Editor screenshots show all four post-upgrade admin function checks returned `true`, and a separate account query returned `super_admin` for the owner's intended existing account. These are owner-supplied results, not an independent production sign-in test. **Do not replay the 005/006 upgrade or role grant.** The member function was previously absent; migrations 007–010 still require staged verification/application. The latest browser screenshots show the older frontend/member error and an offline fallback at `/admin`; successful real admin dashboard access is not established.

## Original procedure: admin schema upgrade only

1. Back up the existing database using the owner's trusted database tools. Do not share connection passwords or private keys in chat.
2. Open `005_006_admin_upgrade.sql`. Copy the **entire** file into a new query in the existing project's SQL Editor and run it as the project owner.
3. This is a sensitive schema/security change: the file applies existing migration 005 hardening and migration 006 admin operations in **one transaction**. Its preflight checks base table/column types, required legacy policies/role constraint/function, owner execution and absence of the newer admin schema. It stops on mismatches instead of guessing or resetting data. This is not a comprehensive attestation that every existing policy is correct.
4. All four returned `*_installed` results must be true. On any error, STOP and retain the error text, then run `rollback;` before another query. Do not delete the guards or rerun base migrations 001–004.
5. The upgrade does **not** grant an account a role. Once it succeeds, run the previously prepared, owner-approved existing-account grant, with independently verified UUID and email. Recheck the assigned role.

## What this deliberately does not do

- It does not create users, reset passwords, delete existing rows, grant a public self-promotion RPC or remove RLS protections.
- It does not install migrations 007–010 or fix the missing member function on its own. Check those stages before deploying the full member release. Do not assert that the whole app is ready because admin functions exist.
- It does not deploy frontend changes, Edge Functions or secrets. A role grant and a Render release are separate steps.

## Testing

`tests/admin-upgrade.test.mjs` executes this exact file against isolated PostgreSQL with migrations 001–004 and existing fixture rows. It checks column-mismatch, partial-schema and non-owner rejection; exact preservation of all existing public table rows; function installation; replay rejection; and ordinary-user denial. The normal migration test suite separately tests all migrations 001–010.

**Production execution was owner-operated; the supplied screenshots confirm the function-presence checks and role query, not complete schema integrity or end-to-end administrator access.**
