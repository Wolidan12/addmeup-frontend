#!/usr/bin/env python3
"""Private logical backup + isolated Docker restore test. Never restores remotely.
No third-party Python dependencies; requires matching PostgreSQL clients and Docker.
"""
import argparse
import configparser
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time
import warnings
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'lohlvenibvohoxtfucfa'
SCOPES = "'public','auth','storage','supabase_migrations'"
TABLES = f"select coalesce(json_agg(json_build_array(schemaname,tablename) order by schemaname,tablename),'[]') from pg_tables where schemaname in ({SCOPES})"
EXTENSIONS = "select coalesce(json_agg(json_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) order by e.extname),'[]') from pg_extension e join pg_namespace n on n.oid=e.extnamespace"
FINANCIAL = "select json_build_object('users',(select count(*) from auth.users),'profiles',(select count(*) from public.profiles),'wallet_rows',(select count(*) from public.points_balance),'ledger_rows',(select count(*) from public.points_ledger),'total_dc',(select coalesce(sum(balance),0)::text from public.points_balance))"
SECURITY = """select json_build_object('tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),'policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public'),'functions',(select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,'definer',p.prosecdef,'body_hash',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p')))"""

class SafetyError(Exception):
    pass

def now():
    return datetime.now(timezone.utc).isoformat()

def require(condition, message):
    if not condition:
        raise SafetyError(message)

def inside(path, root):
    return path == root or root in path.parents

def private_path(value, directory=False):
    raw = Path(value).expanduser()
    require(not raw.is_symlink(), 'Symlink paths are not allowed.')
    path = raw.resolve()
    require(not inside(path, ROOT), 'Recovery files and credentials must be outside the Git repository.')
    require(path.is_dir() if directory else path.is_file(), 'Required private file/directory does not exist.')
    require(path.stat().st_mode & 0o077 == 0, 'Private files must be mode 600; private directories mode 700.')
    require(path.stat().st_uid == os.getuid(), 'Recovery paths must belong to the current OS user.')
    return path

def run(args, *, env=None, log=None, input=None, timeout=600):
    try:
        result = subprocess.run(args, input=input, text=True, stdout=subprocess.PIPE,
                                stderr=log or subprocess.PIPE, env=env, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        raise SafetyError('A required tool is unavailable or timed out. No recovery success recorded.') from None
    require(result.returncode == 0, 'A backup/restore command failed. Inspect the private log locally; do not paste it into chat.')
    return result.stdout.strip()

def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()

def save(path, value):
    with path.open('x', encoding='utf8') as stream:
        json.dump(value, stream, indent=2, sort_keys=True)
        stream.write('\n')

def configure(args):
    require(sys.stdin.isatty(), 'Run configure in your own interactive terminal; never pipe credentials into this command.')
    folder = private_path(args.config_dir, directory=True)
    service_file, password_file = folder / '.pg_service.conf', folder / '.pgpass'
    require(not service_file.exists() and not password_file.exists(), 'Configuration already exists; do not overwrite existing credentials.')
    host = input('Host from Supabase Connect (direct or session pooler): ').strip()
    user = input('Database user from Supabase Connect: ').strip()
    rootcert = input('Trusted CA file path, or system for system trust [system]: ').strip() or 'system'
    require((host == f'db.{PROJECT}.supabase.co' and user == 'postgres') or
            (host.endswith('.pooler.supabase.com') and user == f'postgres.{PROJECT}'), 'Host/user do not identify the existing project.')
    require(rootcert == 'system' or Path(rootcert).expanduser().is_file(), 'Trusted CA file was not found.')
    require(not any(char in rootcert for char in ['\n', '\r']), 'Invalid CA path.')
    with warnings.catch_warnings():
        warnings.simplefilter('error', getpass.GetPassWarning)
        try:
            password = getpass.getpass('Existing DATABASE password (hidden; not your account password): ')
            confirmation = getpass.getpass('Confirm database password (hidden): ')
        except getpass.GetPassWarning:
            raise SafetyError('Hidden password entry is unavailable. No credentials were accepted.') from None
    require(bool(password) and '\n' not in password and '\r' not in password, 'Password was not supplied or contains an unsupported newline.')
    require(password == confirmation, 'Password confirmation differs.')
    cfg = configparser.ConfigParser(interpolation=None)
    cfg['danqel_backup'] = {'host': host, 'user': user, 'dbname': 'postgres', 'port': '5432',
                            'sslmode': 'verify-full', 'sslrootcert': str(Path(rootcert).expanduser()) if rootcert != 'system' else rootcert}
    with service_file.open('x') as stream:
        cfg.write(stream)
    escape = lambda value: value.replace('\\', '\\\\').replace(':', '\\:')
    with password_file.open('x') as stream:
        stream.write(':'.join(escape(value) for value in [host, '5432', 'postgres', user, password]) + '\n')
    print('Private credential files created. No connection was attempted. Set these file paths in your shell:')
    print('PGSERVICEFILE: ' + str(service_file))
    print('PGPASSFILE: ' + str(password_file))


def source_config(service):
    require(re.fullmatch(r'[A-Za-z0-9_.-]{1,64}', service), 'Use a service alias, never a URL/password argument.')
    require(not os.environ.get('PGPASSWORD'), 'Unset PGPASSWORD; use a private PGPASSFILE instead.')
    service_file = private_path(os.environ.get('PGSERVICEFILE', ''))
    password_file = private_path(os.environ.get('PGPASSFILE', ''))
    settings = configparser.ConfigParser(interpolation=None)
    settings.read(service_file)
    require(service in settings, 'Service alias is missing from the private service file.')
    cfg = settings[service]
    require('password' not in cfg and 'hostaddr' not in cfg, 'Keep passwords in PGPASSFILE; hostaddr overrides are not allowed.')
    require(set(cfg).issubset({'host','user','dbname','port','sslmode','sslrootcert'}), 'Use only the documented service fields; connection overrides are not allowed.')
    host, user = cfg.get('host', ''), cfg.get('user', '')
    direct = host == f'db.{PROJECT}.supabase.co' and user == 'postgres'
    pooled = host.endswith('.pooler.supabase.com') and user == f'postgres.{PROJECT}'
    require(direct or pooled, 'Service must identify the existing project direct/session-pooler database.')
    require(cfg.get('port', '5432') == '5432' and cfg.get('dbname') == 'postgres', 'Use database postgres and port 5432, not transaction pooling.')
    require(cfg.get('sslmode') == 'verify-full' and cfg.get('sslrootcert'), 'Configure verified TLS and its trusted root certificate in the service file.')
    env = {key: os.environ[key] for key in ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR'] if key in os.environ}
    env.update(PGSERVICEFILE=str(service_file), PGPASSFILE=str(password_file), PGCONNECT_TIMEOUT='10',
               PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=300000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=900000 -c timezone=UTC -c datestyle=ISO,MDY')
    return f'service={service} sslmode=verify-full', env

class Snapshot:
    """Keep one exported read-only snapshot alive for pg_dump and evidence queries."""
    def __init__(self, connection, env, log):
        try:
            self.proc = subprocess.Popen(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', connection],
                                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=log, text=True, env=env)
        except OSError:
            raise SafetyError('Install matching PostgreSQL client tools first.') from None
    def query(self, sql):
        marker = 'END_' + secrets.token_hex(16)
        try:
            self.proc.stdin.write(sql + ';\n\\echo ' + marker + '\n')
            self.proc.stdin.flush()
            rows = []
            for line in self.proc.stdout:
                if line.strip() == marker:
                    return '\n'.join(rows).strip()
                rows.append(line.rstrip('\n'))
        except (OSError, BrokenPipeError):
            pass
        raise SafetyError('The read-only snapshot session failed; inspect the private log locally.')
    def close(self):
        if self.proc.poll() is None:
            try:
                self.proc.stdin.write('ROLLBACK;\n\\q\n')
                self.proc.stdin.flush()
                self.proc.wait(timeout=10)
            except (OSError, BrokenPipeError, subprocess.TimeoutExpired):
                self.proc.kill()
                self.proc.wait()
        self.proc.stdin.close()
        self.proc.stdout.close()


def quote_identifier(value):
    return '"' + value.replace('"', '""') + '"'

def fingerprint_sql(schema, table):
    target = quote_identifier(schema) + '.' + quote_identifier(table)
    return f"select json_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex')) from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from {target} t) row_hashes"


def inspect_database(query):
    tables = json.loads(query(TABLES))
    result = {'tables': {}, 'financial': json.loads(query(FINANCIAL)),
              'public_security': json.loads(query(SECURITY)), 'extensions': json.loads(query(EXTENSIONS))}
    for schema, table in tables:
        sql = fingerprint_sql(schema, table)
        result['tables'][schema + '.' + table] = json.loads(query(sql))
    return result


def guarded_roles(text):
    # Preserve dumped ALTER/membership statements, but tolerate roles already
    # provisioned by a fresh Supabase Postgres image. Never executed on production.
    pattern = re.compile(r'^CREATE ROLE ("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*);$', re.M)
    def guard(match):
        name = match[1]
        if name.startswith('"'):
            name = name[1:-1].replace('""', '"')
        literal = "'" + name.replace("'", "''") + "'"
        tag = '$guard_' + secrets.token_hex(8) + '$'
        return f"DO {tag} BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname={literal}) THEN EXECUTE format('CREATE ROLE %I',{literal}); END IF; END; {tag};"
    return pattern.sub(guard, text)


def backup(args):
    require(bool(args.owner.strip()), 'Name the restore owner.')
    parent = private_path(args.output_parent, directory=True)
    connection, env = source_config(args.service)
    folder = parent / ('danqel-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + secrets.token_hex(4))
    folder.mkdir(mode=0o700)
    snapshot = None
    with (folder / 'private-command.log').open('x') as log:
        try:
            snapshot = Snapshot(connection, env, log)
            snapshot.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
            version = int(snapshot.query('SHOW server_version_num')) // 10000
            require(version == 17, 'Server version changed: review the recovery procedure first.')
            for tool in ['psql', 'pg_dump', 'pg_dumpall']:
                detected = re.search(r'\b(\d+)\.\d+', run([tool, '--version'], env=env))
                require(detected is not None and int(detected[1]) == version, 'Use PostgreSQL 17 clients matching the server.')
            snap = snapshot.query('SELECT pg_export_snapshot()')
            captured_at = now()
            require(re.fullmatch(r'[0-9A-Fa-f]+-[0-9A-Fa-f]+-\d+', snap), 'Invalid exported snapshot.')
            expected = inspect_database(snapshot.query)
            run(['pg_dump', '-d', connection, '--format=custom', '--snapshot=' + snap,
                 '--lock-wait-timeout=5s', '--file=' + str(folder / 'database.dump')], env=env, log=log)
            # No database-role passwords in this separate globals file. Auth password
            # hashes/tokens ARE in the private database archive and must be protected.
            roles = run(['pg_dumpall', '-d', connection, '--roles-only', '--no-role-passwords'], env=env, log=log)
            (folder / 'roles.sql').write_text(roles, encoding='utf8')
            save(folder / 'manifest.json', {'format': 1, 'project_ref': PROJECT, 'captured_at': captured_at, 'backup_completed_at': now(),
                 'restore_owner': args.owner.strip(), 'server_major': version,
                 'files': {name: digest(folder / name) for name in ['database.dump', 'roles.sql']},
                 'expected': expected, 'restore_verified': False,
                 'scope': 'Logical database and role definitions without database-role passwords. Storage file bytes, provider secrets/config and external encryption keys require separate recovery coverage.'})
        finally:
            if snapshot:
                snapshot.close()
    print('Private backup created at ' + str(folder))
    print('NOT restore-verified. Store an encrypted off-machine copy and run verify before any rollout.')


def verify(args):
    folder = private_path(args.backup_dir, directory=True)
    manifest = json.loads(private_path(folder / 'manifest.json').read_text())
    require(manifest.get('format') == 1 and manifest.get('project_ref') == PROJECT, 'Unexpected backup manifest.')
    for name in ['database.dump', 'roles.sql']:
        path = private_path(folder / name)
        require(digest(path) == manifest['files'].get(name), 'Backup checksum mismatch. Stop.')
    require(re.fullmatch(r'(?:docker\.io/)?supabase/postgres@sha256:[a-f0-9]{64}', args.image), 'Use a trusted Supabase Postgres 17 image pinned by sha256 digest.')
    # Reject remote Docker daemons: a restore must occur on this computer only.
    require(not os.environ.get('DOCKER_HOST') and not os.environ.get('DOCKER_CONTEXT'), 'Unset Docker host/context overrides before verification.')
    endpoint = run(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'])
    require(endpoint.startswith(('unix://', 'npipe://')), 'Only a local Docker daemon is permitted.')
    container = None
    evidence = folder / ('restore-evidence-' + secrets.token_hex(6) + '.json')
    with (folder / ('private-restore-' + secrets.token_hex(6) + '.log')).open('x') as log:
        try:
            container = run(['docker', 'run', '--detach', '--network=none', '--label=danqel.isolated-restore=true',
                             '--env=POSTGRES_HOST_AUTH_METHOD=trust', '--tmpfs=/var/lib/postgresql/data:rw,mode=0700',
                             args.image], log=log)
            require(re.fullmatch(r'[a-f0-9]{64}', container), 'Docker did not return a valid isolated container ID.')
            base = ['docker', 'exec', container]
            pg = ['-h', '/var/run/postgresql', '-U', 'postgres', '-d', 'postgres']
            ready = False
            for _ in range(60):
                check = subprocess.run(base + ['pg_isready'] + pg, stdout=log, stderr=log)
                if check.returncode == 0:
                    ready = True
                    break
                time.sleep(1)
            require(ready, 'Isolated Postgres did not become ready.')
            def query(sql):
                return run(base + ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'] + pg + ['-c', sql], log=log)
            require(int(query('SHOW server_version_num')) // 10000 == manifest['server_major'], 'Restore image must match PostgreSQL major version.')
            run(['docker', 'exec', '--interactive', container, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1'] + pg,
                input=guarded_roles((folder / 'roles.sql').read_text()), log=log)
            run(['docker', 'cp', str(folder / 'database.dump'), container + ':/tmp/database.dump'], log=log)
            # The only restore target is the socket INSIDE our newly created,
            # network-isolated disposable container. No target URI is accepted.
            run(base + ['pg_restore', '--exit-on-error', '--clean', '--if-exists', '--no-tablespaces'] + pg + ['/tmp/database.dump'], log=log)
            query("SET timezone='UTC'; SET datestyle='ISO,MDY'")
            actual = inspect_database(lambda sql: query("SET timezone='UTC'; SET datestyle='ISO,MDY'; " + sql))
            require(actual == manifest['expected'], 'Restored data/security differs from the backup snapshot. Do not authorize rollout.')
            result = {'project_ref': PROJECT, 'backup_reference': folder.name, 'captured_at': manifest['captured_at'],
                      'restore_owner': manifest['restore_owner'], 'verified_at': now(),
                      'image': args.image, 'checksums': manifest['files'], 'database_restore_result': 'PASS',
                      'compared': ['all row fingerprints/counts in public/auth/storage/supabase_migrations', 'financial baseline and extension versions', 'public RLS/policies/function definitions/owners/ACLs'],
                      'external_recovery_coverage': 'PENDING separate Storage bytes/provider/config/key review',
                      'production_rollout_authorized': False}
        finally:
            if container and re.fullmatch(r'[a-f0-9]{64}', container):
                run(['docker', 'rm', '--force', '--volumes', container], log=log)
    # Evidence is emitted only after a successful restore, exact comparisons AND cleanup.
    save(evidence, result)
    print('Database restore test PASS. Private evidence: ' + str(evidence))
    print('Review external recovery coverage before approving production rollout. No production restore was run.')


def main():
    require(os.name == 'posix', 'Run this workflow in Linux, macOS or WSL, not native Windows.')
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    setup = commands.add_parser('configure')
    setup.add_argument('--config-dir', required=True, help='Existing mode-700 credential directory outside Git')
    create = commands.add_parser('backup')
    create.add_argument('--service', required=True, help='Private pg_service.conf alias; never a connection URL')
    create.add_argument('--output-parent', required=True, help='Existing mode-700 directory outside Git')
    create.add_argument('--owner', required=True, help='Named person responsible for recovery')
    restore = commands.add_parser('verify')
    restore.add_argument('--backup-dir', required=True)
    restore.add_argument('--image', required=True, help='Trusted compatible Supabase Postgres 17 image@sha256:digest')
    args = parser.parse_args()
    try:
        {'configure': configure, 'backup': backup, 'verify': verify}[args.command](args)
    except SafetyError as error:
        print('STOP: ' + str(error), file=sys.stderr)
        return 1
    except (ValueError, KeyError, OSError, EOFError, configparser.Error):
        print('STOP: backup/verification did not complete. No recovery approval recorded. Check prerequisites and private local logs; do not paste secrets/log contents into chat.', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
