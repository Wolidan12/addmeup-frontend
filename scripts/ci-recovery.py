#!/usr/bin/env python3
"""Manual private-runner recovery. No migrations, deployments or remote restores."""
import configparser
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('manual_backup', Path(__file__).with_name('manual-backup.py'))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


def validate(env):
    b.require(env.get('GITHUB_EVENT_NAME') == 'workflow_dispatch', 'Manual dispatch required.')
    b.require(env.get('GITHUB_REF') == 'refs/heads/main', 'Only reviewed main is allowed.')
    b.require(env.get('RECOVERY_REPOSITORY_PRIVATE') == 'true', 'Recovery requires a private repository.')
    b.require(env.get('RECOVERY_CONFIRMATION') == b.PROJECT, 'Project confirmation does not match.')
    host = env.get('RECOVERY_DB_HOST', '')
    b.require(re.fullmatch(r'[a-z0-9.-]+\.pooler\.supabase\.com', host) is not None, 'Use the Session Pooler host from Supabase Connect.')
    password = env.get('RECOVERY_DB_PASSWORD', '')
    phrase = env.get('RECOVERY_ARCHIVE_PASSPHRASE', '')
    b.require(bool(password) and not any(c in password for c in '\r\n\x00'), 'Valid database secret required.')
    b.require(len(phrase) >= 32 and not any(c in phrase for c in '\r\n\x00') and phrase != password, 'Use a separate archive passphrase of at least 32 characters.')
    image = env.get('RECOVERY_POSTGRES_IMAGE', '')
    b.require(re.fullmatch(r'(?:docker\.io/)?supabase/postgres@sha256:[a-f0-9]{64}', image) is not None, 'Reviewed immutable Supabase image required.')
    b.require(bool(env.get('GITHUB_ACTOR')), 'Recovery owner required.')
    return host, password, phrase, image


def configure(folder, host, password, ca):
    folder.mkdir(mode=0o700)
    cfg = configparser.ConfigParser(interpolation=None)
    rootcert = 'system'
    if ca:
        import ssl
        cert = folder / 'root.crt'
        cert.write_text(ca, encoding='utf8')
        ssl.create_default_context(cafile=str(cert))  # Reject invalid PEM, never disable TLS.
        rootcert = str(cert)
    user = 'postgres.' + b.PROJECT
    cfg['danqel_backup'] = {'host': host, 'user': user, 'dbname': 'postgres', 'port': '5432', 'sslmode': 'verify-full', 'sslrootcert': rootcert}
    service, passwd = folder / '.pg_service.conf', folder / '.pgpass'
    with service.open('x') as stream:
        cfg.write(stream)
    escape = lambda value: value.replace('\\', '\\\\').replace(':', '\\:')
    passwd.write_text(':'.join(escape(v) for v in [host, '5432', 'postgres', user, password]) + '\n')
    os.environ.update(PGSERVICEFILE=str(service), PGPASSFILE=str(passwd))


def seal(backups, output, phrase, work):
    # Credentials live in a different directory and must never enter the archive.
    archive = work / 'recovery.tar'
    with tarfile.open(archive, 'w') as tar:
        tar.add(backups, arcname='backups')
    target = work / 'sealed.tar.gpg'
    result = subprocess.run(['gpg', '--batch', '--yes', '--no-symkey-cache', '--homedir', str(work / 'gnupg'),
        '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--symmetric', '--cipher-algo', 'AES256',
        '--s2k-mode', '3', '--s2k-count', '65011712', '--output', str(target), str(archive)],
        input=phrase + '\n', text=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
    b.require(result.returncode == 0 and target.is_file() and target.stat().st_size > 0, 'Archive encryption failed; no artifact is approved.')
    decrypted = work / 'decrypt-check.tar'
    checked = subprocess.run(['gpg', '--batch', '--yes', '--no-symkey-cache', '--homedir', str(work / 'gnupg'),
        '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--output', str(decrypted), '--decrypt', str(target)],
        input=phrase + '\n', text=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
    b.require(checked.returncode == 0 and decrypted.is_file() and b.digest(decrypted) == b.digest(archive), 'Encrypted archive round-trip verification failed.')
    target = target.replace(output / 'database-recovery.tar.gpg')
    (output / 'SHA256SUMS').write_text(b.digest(target) + '  ' + target.name + '\n')


def main():
    os.umask(0o077)
    work = None
    output = None
    try:
        host, password, phrase, image = validate(os.environ)
        temp = Path(os.environ['RUNNER_TEMP']).resolve()
        b.require(temp.is_dir() and not b.inside(temp, b.ROOT), 'Runner temp must be outside checkout.')
        output = temp / 'danqel-recovery-export'
        b.require(not output.exists(), 'Do not overwrite an earlier recovery export.')
        output.mkdir(mode=0o700)
        work = Path(tempfile.mkdtemp(prefix='danqel-recovery-private-', dir=temp))
        backups = work / 'backups'
        backups.mkdir(mode=0o700)
        (work / 'gnupg').mkdir(mode=0o700)
        configure(work / 'credentials', host, password, os.environ.get('RECOVERY_CA_CERT_PEM', ''))
        # Neither database tools nor Docker receive raw GitHub secrets in their environment.
        for key in list(os.environ):
            if key.startswith('RECOVERY_') or key == 'PGPASSWORD':
                os.environ.pop(key, None)
        try:
            b.backup(SimpleNamespace(service='danqel_backup', output_parent=str(backups), owner=os.environ['GITHUB_ACTOR']))
            folders = list(backups.iterdir())
            b.require(len(folders) == 1, 'Exactly one backup is required.')
            b.verify(SimpleNamespace(backup_dir=str(folders[0]), image=image))
            evidence = list(folders[0].glob('restore-evidence-*.json'))
            b.require(len(evidence) == 1 and json.loads(evidence[0].read_text())['database_restore_result'] == 'PASS', 'Restore evidence required.')
        finally:
            # Retain private diagnostics encrypted even when dump/restore fails.
            seal(backups, output, phrase, work)
        (output / 'RESULT.txt').write_text('Database restore PASS. External recovery review still pending. No rollout authorized.\n')
        print('Encrypted recovery export ready. Database restore PASS; no migrations or deployment performed.')
        return 0
    except Exception:
        # Never print provider exceptions, child stderr, credentials or database rows.
        if output and output.exists():
            (output / 'RESULT.txt').write_text('FAILED: no recovery approval. Any encrypted archive is diagnostic only.\n')
        print('STOP: recovery did not complete. No production rollout is authorized. Review private prerequisites or encrypted diagnostics.')
        return 1
    finally:
        if work:
            shutil.rmtree(work, ignore_errors=True)
        for key in ['PGSERVICEFILE', 'PGPASSFILE']:
            os.environ.pop(key, None)


if __name__ == '__main__':
    raise SystemExit(main())
