# Social platform directory fix — 31 October 2026

The reported upgrade block was a frontend routing/query dependency error, not a missing catalogue. The page sent `admin_list('social_platforms')` to the older live generic list wrapper, which does not support that resource until migration 023.

Read-only live inspection confirmed the existing 013 platform table has eight rows, RLS enabled and authenticated SELECT, and `admin_save_social_platform` already exists. Baseline: two users/profiles, six ledger entries, one wallet and 90 DC. No production modification was performed.

The directory now reads `key,label,hosts` from the existing RLS catalogue with server-side search, exact count, stable key ordering and 25-row pagination. Errors/permission failures propagate; unavailable counts are not treated as zero. No generic-list fallback or migration is required. Staff page access still requires the existing verified admin role check, and custom changes still use the protected Super Admin RPC with a mandatory reason and audit record. The directory refreshes immediately after a successful save. Built-in host definitions stay protected.

Verification:
- `npm test`: PASS, including baseline 001–015 + 024 platform reading/custom-save/audit and ordinary denial, helper search/count/pagination and original financial/Auth/profile preservation.
- `npm run test:deployment`: PASS (fresh build/artifact checks).
- `npm run test:secrets`: PASS; `git diff --check`: PASS.
- Extended admin Chromium compatibility fixture: PASS for platform catalogue, protected-save request, immediate refresh, search/empty state, five responsive sizes and no unsupported platform list call, alongside prior analytics/ledger/denial checks. These are local network/Auth fixtures, not real production login/save acceptance.

Logs: `/home/user/platform-{browser,regression,deployment,secrets}.log`. Source integration/merge is not proof of successful Render deployment; verify the clean published build after release. Remaining financial migrations and real backup/restore verification are separate and unchanged.
