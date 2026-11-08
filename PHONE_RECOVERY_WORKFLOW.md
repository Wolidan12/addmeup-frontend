# Phone-operated private database recovery

## Status

Prepared for review, **not run against production**. This adds a manual GitHub Actions runner option to `MANUAL_BACKUP_AND_RESTORE.md`; it does not add another application backend, move the database, authorize migrations, deploy Render or prove a real backup exists.

The application repository was **public** when checked. The recovery workflow intentionally fails before checkout/secrets if its repository is public. Do not put production secrets into the public application repository to try to bypass this guard.

## 1. Choose a private location (owner decision)

Recommended: create a **private recovery-only repository** on GitHub, using your phone browser. Keep the application repository unchanged. A trusted administrator can copy these reviewed files, retaining their directory names, onto that private repository's `main` branch:

- `.github/workflows/manual-recovery.yml`
- `scripts/ci-recovery.py`
- `scripts/manual-backup.py`

There is no npm/build dependency for the recovery-only repository. Do not configure Render for it. Alternatively the owner can deliberately make the application repository private after reviewing that visibility change's consequences; this tooling does not do that for you. Merging the application PR may trigger existing Render auto-deploy and is not a database rollout.

On a phone, GitHub's browser interface (request Desktop Website if needed) supports **New repository**, choosing **Private**, and **Add file → Create new file**. A reviewed copy of the three files is required; don't substitute an unknown third-party backup action. Limit collaborator access: anyone who can change a workflow with access to secrets can potentially exfiltrate them.

Use GitHub-hosted `ubuntu-24.04`, not an untrusted/self-hosted runner. Confirm private Actions is available for your account and review included minutes/billing before starting. Each manual run can use up to 45 minutes; no scheduled runs or automatic billing changes are configured here. Availability of PostgreSQL 17 packages on the runner is checked; it fails rather than using a different major.

## 2. Configure secrets privately

In the **private recovery repository**, open **Settings → Secrets and variables → Actions → Secrets → New repository secret**. Enter values there, never in chat, source files, workflow inputs, issues, pull requests or screenshots.

| Secret | Source / requirements |
| --- | --- |
| `RECOVERY_DB_HOST` | Existing Supabase project → **Connect → Session pooler** hostname, ending `.pooler.supabase.com`. Not a URL, and not a transaction-pooler connection. |
| `RECOVERY_DB_PASSWORD` | Existing **database** password. Not your Supabase login password, anon/publishable key, or service-role key. Do not reset it casually if unknown. |
| `RECOVERY_ARCHIVE_PASSPHRASE` | Separate randomly generated password-manager secret, preferably 64+ characters (minimum 32). Save an independent secure copy **before** adding it: GitHub will not show it again and losing it makes the archive unusable. Must differ from the database password. |
| `RECOVERY_CA_CERT_PEM` | Optional trusted root CA PEM from the existing project's connection/security settings when system trust is insufficient. Full certificate text, not a private key. Never disable TLS verification to work around a connection failure. |

The script fixes database `postgres`, **port 5432**, user `postgres.lohlvenibvohoxtfucfa` and `sslmode=verify-full`. It writes mode-600 service/password files only inside temporary runner storage, strips raw recovery secrets from child-process environments, and excludes credential files from the encrypted archive. Do not enable GitHub Actions step/runner debug logging for recovery runs.

## 3. Configure the reviewed restore image

Under **Actions → Variables**, add `RECOVERY_POSTGRES_IMAGE` with this format:

```
supabase/postgres@sha256:<64-character immutable digest>
```

This is a repository **variable**, not a password. A trusted administrator must resolve/review a matching official `supabase/postgres` PostgreSQL **17** image and its extension versions against the existing production instance before setting this. Production was PostgreSQL 17.11 at the latest preflight; a vanilla PostgreSQL image or an arbitrary 17.x image is not sufficient evidence. No digest is invented or preselected here. Never use `latest` or a mutable tag as this variable's value. If exact restore/extension comparisons fail, stop and review the image; do not weaken comparisons.

The workflow pulls that pinned image, then restores only inside a new disposable container with `--network=none` and no published port. It accepts no remote restore target.

## 4. Run from your phone

1. Open the private recovery repository → **Actions**.
2. Select **Private database recovery check** → **Run workflow**.
3. Select the reviewed **main** branch.
4. Enter the project confirmation `lohlvenibvohoxtfucfa` and start the run.
5. Wait for the **whole job** to finish. A skipped, cancelled, timed-out or failed job is not a PASS.

The workflow creates one shared read-only snapshot for the dump and evidence. It restores the archive into the isolated container and compares row counts/fingerprints, financial baseline, extension versions and public RLS/policies/functions/owners/ACLs. It then encrypts the backup, roles, manifest, private diagnostic logs and restore evidence with GPG AES-256, and checks that decryption reproduces the exact archive bytes before export. No passphrase is placed in a command-line argument.

## 5. Download and retain the encrypted recovery artifact

On the run's page, under **Artifacts**, download `encrypted-recovery-<run ID>-<attempt>` to your phone's Files/storage. It contains only:

- `database-recovery.tar.gpg` — encrypted private recovery archive;
- `SHA256SUMS` — checksum of that encrypted file;
- `RESULT.txt` — sanitized PASS/FAILED outcome, no database rows or credentials.

Artifacts expire after **3 days**. Download promptly and store an encrypted off-runner copy in secure storage. Keep the decryption passphrase separately in your password manager. GitHub is not permanent backup storage. Do not send the artifact or its decrypted contents through chat or commit them to Git.

A failed dump/restore may still produce an encrypted **diagnostic** archive. `RESULT.txt` will say FAILED and the job will fail; that archive is not recovery evidence. Encryption failure produces no approved `.gpg` export. Detailed diagnostics, if retained, are encrypted, not uploaded as plaintext logs.

To decrypt later on a trusted computer (outside any checkout), verify the downloaded checksum, then run `gpg --output recovery.tar --decrypt database-recovery.tar.gpg`; enter the saved passphrase interactively, never in the command line. Extract only into a private directory. Review the inner `restore-evidence-*.json`, manifest, checksums and capture time before using the backup. The existing local verification command in `MANUAL_BACKUP_AND_RESTORE.md` can repeat the restore test using the reviewed pinned image. Decryption alone is not a restore verification.

## 6. What to share afterward

Share only the private run URL/reference, sanitized RESULT outcome and confirmation that the encrypted file was downloaded and the independent passphrase saved. Do not share database credentials, private logs, Auth data, backup contents or the passphrase. This Arena session may not have access to the new private repository until appropriate GitHub access is configured.

Even a successful database restore leaves **external Storage file bytes, provider configuration/secrets and encryption-key recovery coverage pending**. Review those separately and the backup's age/current production changes. Do not authorize production rollout solely from a green Actions badge.

There is deliberately **no migration or deployment job**. The owner must separately approve the reviewed reconciliation/rollout after actual recovery evidence and external coverage are confirmed. Real admin/member Auth and independently verified Moniepoint settlement also remain separate acceptance steps.

## Security and cleanup limitations

Only manual dispatch on reviewed `main` is accepted, permissions are read-only for repository contents, checkout credentials are not persisted, actions are pinned by commit and concurrent recovery runs are serialized. Credentials are scoped to the backup step; export paths are an explicit allowlist, not a recursive upload. Normal success/failure removes private runner files and isolated containers. Abrupt runner termination may prevent cleanup steps; GitHub-hosted runner disposal is an additional boundary, not a secure-erasure guarantee. Use no shared or persistent runner. Recovery dumps contain sensitive Auth records even though database-role passwords are omitted.
