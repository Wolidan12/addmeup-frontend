"""Synthetic orchestration tests; no production connection or real archive recovery."""
import configparser
import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from contextlib import redirect_stdout

spec = importlib.util.spec_from_file_location('ci_recovery', Path(__file__).parents[1] / 'scripts/ci-recovery.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.mask = os.umask(0o077)
        self.env = {'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_REF':'refs/heads/main',
            'GITHUB_ACTOR':'fixture-owner','RECOVERY_REPOSITORY_PRIVATE':'true',
            'RECOVERY_CONFIRMATION':c.b.PROJECT,'RECOVERY_DB_HOST':'aws-0-eu-west-1.pooler.supabase.com',
            'RECOVERY_DB_PASSWORD':'fixture-only:database\\value', 'RECOVERY_ARCHIVE_PASSPHRASE':'fixture-only-archive-passphrase-long-enough',
            'RECOVERY_POSTGRES_IMAGE':'supabase/postgres@sha256:'+'a'*64,'RUNNER_TEMP':str(self.root)}
    def tearDown(self):
        os.umask(self.mask)
        self.tmp.cleanup()
    def test_guards(self):
        c.validate(self.env)
        for key,value in [('GITHUB_EVENT_NAME','pull_request'),('GITHUB_REF','refs/heads/unreviewed'),
                ('RECOVERY_REPOSITORY_PRIVATE','false'),('RECOVERY_CONFIRMATION','another-project'),
                ('RECOVERY_DB_HOST','attacker.example'),('RECOVERY_DB_PASSWORD',''),
                ('RECOVERY_ARCHIVE_PASSPHRASE','short'),('RECOVERY_POSTGRES_IMAGE','supabase/postgres:latest')]:
            with self.subTest(key=key), self.assertRaises(c.b.SafetyError): c.validate({**self.env,key:value})
    def test_private_configuration(self):
        with patch.dict(os.environ,{},clear=True):
            c.configure(self.root/'credentials',self.env['RECOVERY_DB_HOST'],self.env['RECOVERY_DB_PASSWORD'],'')
            service=Path(os.environ['PGSERVICEFILE']);passwd=Path(os.environ['PGPASSFILE'])
            cfg=configparser.ConfigParser();cfg.read(service)
            self.assertEqual(cfg['danqel_backup']['sslmode'],'verify-full')
            self.assertEqual(cfg['danqel_backup']['port'],'5432')
            self.assertEqual(cfg['danqel_backup']['user'],'postgres.'+c.b.PROJECT)
            self.assertNotIn(self.env['RECOVERY_DB_PASSWORD'],service.read_text())
            self.assertIn('fixture-only\\:database\\\\value',passwd.read_text())
            for path in [service,passwd]: self.assertEqual(path.stat().st_mode & 0o077,0)
    def test_encryption_only_export_and_no_passphrase_argument(self):
        backups=self.root/'backups';backups.mkdir();(backups/'database.dump').write_text('synthetic rows')
        work=self.root/'work';work.mkdir();output=self.root/'export';output.mkdir()
        (work/'credentials').mkdir();(work/'credentials'/'password').write_text('must-not-be-archived')
        phrase=self.env['RECOVERY_ARCHIVE_PASSPHRASE']
        def fake_gpg(args,**kwargs):
            self.assertNotIn(phrase,' '.join(args));self.assertEqual(kwargs['input'],phrase+'\n')
            self.assertEqual(kwargs['stderr'],c.subprocess.DEVNULL)
            with tarfile.open(work/'recovery.tar') as tar:
                self.assertFalse(any('credentials' in n for n in tar.getnames()))
            Path(args[args.index('--output')+1]).write_bytes((work/'recovery.tar').read_bytes() if '--decrypt' in args else b'encryption-fixture-only')
            return SimpleNamespace(returncode=0)
        with patch.object(c.subprocess,'run',side_effect=fake_gpg): c.seal(backups,output,phrase,work)
        self.assertEqual({p.name for p in output.iterdir()},{'database-recovery.tar.gpg','SHA256SUMS'})
    def test_encryption_failure_exports_no_archive(self):
        backups=self.root/'backups';backups.mkdir();work=self.root/'work';work.mkdir();output=self.root/'export';output.mkdir()
        with patch.object(c.subprocess,'run',return_value=SimpleNamespace(returncode=1)),self.assertRaises(c.b.SafetyError):
            c.seal(backups,output,'fixture passphrase',work)
        self.assertEqual(list(output.iterdir()),[])
    def test_corrupt_encryption_roundtrip_exports_nothing(self):
        backups=self.root/'backups';backups.mkdir();work=self.root/'work';work.mkdir();output=self.root/'export';output.mkdir()
        def fake_gpg(args,**kwargs):
            Path(args[args.index('--output')+1]).write_bytes(b'corrupt-fixture')
            return SimpleNamespace(returncode=0)
        with patch.object(c.subprocess,'run',side_effect=fake_gpg),self.assertRaises(c.b.SafetyError):
            c.seal(backups,output,'fixture-passphrase',work)
        self.assertEqual(list(output.iterdir()),[])
    def exercise(self,fail=False,evidence=True):
        def backup(args):
            self.assertFalse(any(k.startswith('RECOVERY_') for k in os.environ))
            (Path(args.output_parent)/'fixture').mkdir()
            if fail: raise RuntimeError('PRIVATE_PROVIDER_EXCEPTION')
        def verify(args):
            if evidence: (Path(args.backup_dir)/'restore-evidence-fixture.json').write_text(json.dumps({'database_restore_result':'PASS'}))
        def seal(backups,output,phrase,work):
            (output/'database-recovery.tar.gpg').write_bytes(b'fixture-only')
        output=io.StringIO()
        with patch.dict(os.environ,self.env,clear=True),patch.object(c.b,'backup',side_effect=backup),patch.object(c.b,'verify',side_effect=verify),patch.object(c,'seal',side_effect=seal),redirect_stdout(output):
            status=c.main()
            self.assertNotIn('PGPASSFILE',os.environ)
        self.assertNotIn('PRIVATE_PROVIDER_EXCEPTION',output.getvalue())
        self.assertFalse(list(self.root.glob('danqel-recovery-private-*')))
        return status,(self.root/'danqel-recovery-export'/'RESULT.txt').read_text()
    def test_success_requires_evidence_and_cleans_credentials(self):
        status,text=self.exercise();self.assertEqual(status,0);self.assertIn('PASS',text)
    def test_failed_dump_is_sealed_but_never_approved(self):
        status,text=self.exercise(fail=True);self.assertEqual(status,1);self.assertIn('FAILED',text)
    def test_missing_evidence_never_approved(self):
        status,text=self.exercise(evidence=False);self.assertEqual(status,1);self.assertIn('FAILED',text)
    def test_workflow_has_no_rollout_or_plaintext_upload(self):
        text=(Path(__file__).parents[1]/'.github/workflows/manual-recovery.yml').read_text()
        self.assertIn('workflow_dispatch:',text);self.assertNotIn('pull_request:',text);self.assertNotIn('push:',text)
        self.assertIn('persist-credentials: false',text);self.assertIn('retention-days: 3',text)
        self.assertNotIn('create_migration',text);self.assertNotIn('deploy',text)
        upload=text.split('          path: |')[1].split('          if-no-files-found:')[0]
        self.assertNotIn('private-',upload);self.assertNotIn('**',upload);self.assertNotIn('database.dump',upload)
        for action in ['actions/checkout@','actions/upload-artifact@']:
            self.assertRegex(text,action+'[a-f0-9]{40}')

if __name__=='__main__': unittest.main()
