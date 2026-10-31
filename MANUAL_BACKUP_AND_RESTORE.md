# Free manual backup and isolated restore test

**Status: workflow prepared and safety-tested; no real production backup or archive restore has been performed here.** The project is on Free without scheduled backups, and the owner confirmed no isolated restore test exists. This environment has no private PostgreSQL connection, PostgreSQL backup clients or Docker. Do not treat this document, synthetic fixtures or a successful build as recovery evidence.

This is a workstation workflow, not a browser-console command. On your Windows computer, use **WSL2 Ubuntu in Windows Terminal**, with Docker Desktop's WSL integration. Do not paste database credentials into Arena/chat, GitHub, Render, frontend environment variables or command-line URLs.

## 1. Prepare a trusted computer

Have the reviewed repository files available locally, including `scripts/manual-backup.py` from this change. Install:

- Python 3.
- **PostgreSQL 17 client tools**: `psql`, `pg_dump`, `pg_dumpall` (not just a running database server). Use an official PostgreSQL distribution/package source.
- Docker Desktop / local Docker Engine, with enough free memory/disk. The Docker daemon must be local; TCP/SSH contexts are rejected.
- A trusted **official `supabase/postgres` PostgreSQL 17 image** with compatible extension versions, pinned to its immutable digest. Do not use an arbitrary image, `latest`, PostgreSQL 15/16/18 or assume a vanilla Postgres image supports Supabase extensions. Review the backup's extension inventory when choosing the image. A restore failure is a failed test, not a reason to skip errors.

Check in WSL:

```sh
python3 --version
psql --version
pg_dump --version
pg_dumpall --version
docker version
docker context inspect --format '{{.Endpoints.docker.Host}}'
```

All PostgreSQL clients must say **17.x**, matching the recorded production major. If production major changes, stop and review. Do not run `pg_restore` against any cloud/production connection.

## 2. Configure the source privately — interactive terminal only

In WSL, from the repository directory:

```sh
umask 077
mkdir -p "$HOME/.config/danqel-recovery" "$HOME/danqel-private-backups"
chmod 700 "$HOME/.config/danqel-recovery" "$HOME/danqel-private-backups"
python3 scripts/manual-backup.py configure \
  --config-dir "$HOME/.config/danqel-recovery"
```

The prompts ask for:

1. **Host** from Supabase → existing project → **Connect**. Prefer **Session pooler, port 5432**, if direct IPv6 access does not work. Do not use transaction pooler/port 6543.
2. **Database user** from the same Connect panel. Session pooler uses `postgres.lohlvenibvohoxtfucfa`; direct host uses `postgres` at `db.lohlvenibvohoxtfucfa.supabase.co`.
3. **Trusted CA**: `system` uses system CA trust with verified TLS in PostgreSQL 17. If the certificate chain requires Supabase's root certificate, securely download that CA from the dashboard and provide its local WSL file path. Never disable hostname/certificate verification to make it connect.
4. The existing **database password**, entered twice with hidden input. This is not a Supabase website password, Auth-user password, anon key or service-role key. No password is printed. The helper refuses non-interactive entry and refuses to overwrite existing credential files. If the password is unknown, stop and arrange authorized access; do not casually reset production credentials.

Only the intended project/direct or session-pooler connection is accepted. Configuration files are mode 600, outside Git. They are still sensitive: protect the computer/account.

Set file paths, not secret values:

```sh
export PGSERVICEFILE="$HOME/.config/danqel-recovery/.pg_service.conf"
export PGPASSFILE="$HOME/.config/danqel-recovery/.pgpass"
unset PGPASSWORD
```

If TLS/network/authentication fails, diagnose locally. Do not paste connection strings, private logs, dump contents or screenshots showing passwords into chat.

## 3. Create the read-only production backup

Agree a quiet/maintenance window, particularly no staff role/schema changes during capture. Do not delete or force-reset legitimate activity.

```sh
python3 scripts/manual-backup.py backup \
  --service danqel_backup \
  --output-parent "$HOME/danqel-private-backups" \
  --owner "YOUR REAL RESTORE OWNER NAME"
```

Replace the owner with the actual responsible person. The command creates a new uniquely named mode-700 directory. It:

- Connects with verified TLS, no password in arguments/environment, and read-only transaction settings.
- Holds an exported repeatable-read snapshot open and gives **the same snapshot** to `pg_dump` and the evidence queries. Table evidence therefore matches the archive point in time, not an unrelated later count.
- Makes a full logical custom archive, preserving ownership/grants; separately captures role definitions **without database-role passwords**. No production inserts, updates, migrations or schema changes are issued.
- Records exact row counts/fingerprints in `public`, `auth`, `storage` and `supabase_migrations`; financial counts/total; public RLS/policies/function definitions/owners/ACLs; and extension versions.
- Writes SHA-256 archive/roles checksums and capture/completion times. No table contents are printed. On error/timeout it does not create a completed manifest.

Files:

- `database.dump` — **sensitive**: includes Auth password hashes, sessions and application data. Never commit/upload it to a PR or chat.
- `roles.sql` — role definitions, no role passwords. Still private.
- `manifest.json` — capture point, owner, hashes and expected verification data; `restore_verified` is initially false.
- Private command log — do not share unredacted.

A manual dump is a **logical database backup**, not an entire Supabase-hosted project/cluster image. A permissions/extension error is not acceptable success; stop and investigate. Never ignore errors, silently drop Auth/Storage scope or rerun with weaker security flags.

Keep a securely encrypted, access-controlled copy on a **separate device/storage location**, not just beside the source computer. Use your organization's approved encryption/storage process. Record retention and who can retrieve/decrypt it. A checksum proves file integrity, not encryption or recovery ability.

## 4. Restore ONLY into a disposable local container

Select/review a compatible official Supabase Postgres 17 image. After pulling a reviewed version, Docker can show its immutable reference with:

```sh
docker image inspect --format '{{index .RepoDigests 0}}' supabase/postgres:REVIEWED_17_VERSION
```

`REVIEWED_17_VERSION` is a placeholder, not a supplied image tag. Use the real reviewed image and copy its `supabase/postgres@sha256:...` reference. Do not invent a digest. Different extensions/configuration can prevent a generic image from restoring; obtain a compatible image instead of suppressing restore errors.

Using the actual backup directory and digest:

```sh
python3 scripts/manual-backup.py verify \
  --backup-dir "$HOME/danqel-private-backups/ACTUAL_BACKUP_DIRECTORY" \
  --image 'supabase/postgres@sha256:ACTUAL_64_CHARACTER_DIGEST'
```

Those two placeholders must be replaced. The verifier accepts **no target database URI**. It:

1. Checks private-file permissions/project identity/checksums and a local Docker endpoint.
2. Creates a **new** labeled container with `--network=none`, **no published ports**, no mounted source credentials/host data, and disposable in-memory Postgres data. Temporary trust authentication exists only inside this isolated container, never production.
3. Applies role definitions with guards for roles already provisioned locally. Restores with `--exit-on-error` through the new container's own Unix socket. Any `--clean` operation is confined to that new disposable container, never your cloud database.
4. Compares restored fingerprints/counts, financial baseline, public security definitions and extension versions to the captured snapshot. A mismatch means failure. No success is recorded for a failed/incomplete restore.
5. Removes the test container/volumes on success or failure. Success evidence is written only after restore, comparison **and cleanup** succeed. If cleanup itself fails, inspect the labeled container locally and remove only that known test container before retrying; no success is claimed.

Supabase images/extensions may need reviewed configuration adjustments to be compatible. This workflow intentionally fails closed; it is **not** a guarantee that any image tag will restore every managed object.

## 5. Cover what database dumps do NOT recover

Before authorizing production rollout, separately inventory and securely preserve/verify:

- **Storage file bytes**, not just `storage.objects` metadata. Export required avatars/receipts/other objects to secure storage; verify object counts, representative hashes and retrieval/restore procedure. Do not make private receipt buckets public or share their signed URLs.
- Auth/SMTP/site/redirect configuration, Edge-function source/configuration, private provider/VAPID/cron secrets and any external encryption/Vault keys. Keep secret values outside Git/chat/served files. A database dump cannot replace external key custody.
- Database-role passwords/credentials intentionally excluded from `roles.sql`, and managed platform configuration/extensions. Document authorized reconfiguration/rotation, access and ownership.
- Off-machine encrypted backup retrieval/decryption; recovery time, retention and responsible operator.

If a bucket is actually empty or no provider is configured, record a verified inventory result—do not assume it. A local database PASS alone does not establish full project recovery.

## 6. Send only safe recovery metadata

After the real run succeeds and external coverage is reviewed, provide:

```text
Backup reference (generated directory name):
Capture timestamp + timezone:
Restore owner:
Database restore-test verification timestamp:
Restore evidence filename/reference and result:
Encrypted off-machine copy retrievable: yes/no
Storage files / settings / secret-key recovery coverage:
```

Do **not** send the dump, password file, connection URI, private command logs, secrets or download/decryption links. The local evidence contains a database restore result, but deliberately says `production_rollout_authorized: false` until the remaining review is done. Do not change the SQL recovery guard to pretend this review happened.

## Current validation of the tooling (not your real backup)

- Python tests pass: private paths/modes, hidden credential configuration, source/TLS checks, shared read-only snapshot flags, checksums, immutable-image requirement, remote-Docker rejection, isolated-only restore commands and cleanup, no success on mismatches.
- Real embedded PostgreSQL test passes for the evidence SQL, quoting/role guards, fingerprints, cloned-fixture comparison and detection of modified data/RLS. This is a synthetic clone test, **not an archive/Docker restore**.
- Full production archive capture, real Docker restore and external recovery coverage remain **NOT TESTED here**. Production users, financial history and balances have not been modified by preparing this workflow.

Run tool tests with `npm run test:backup`. Optional real SQL test: install the documented `embedded-postgres@18.6.0-beta.19` test dependency without saving/changing the lockfile, then `npm run test:backup:postgres`. That SQL test uses a local PostgreSQL 18 fixture, not the production PostgreSQL 17 backup client/image; the production workflow strictly requires matching 17 clients/image.
