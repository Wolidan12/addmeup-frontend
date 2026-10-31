"""Guard/command tests use synthetic files and mocked tools, never production."""
import contextlib
import io
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', Path(__file__).parents[1] / 'scripts/manual-backup.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

class BackupSafetyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.folder = Path(self.tmp.name)
        self.oldmask = os.umask(0o077)
    def tearDown(self):
        os.umask(self.oldmask)
        self.tmp.cleanup()
    def artifact(self):
        for name, value in [('database.dump', b'ISOLATED FIXTURE ONLY'), ('roles.sql', b'CREATE ROLE "test role";\n')]:
            (self.folder / name).write_bytes(value)
        expected = {'tables': {}, 'financial': {'users': 2, 'total_dc': '90'}, 'public_security': {},'extensions':[]}
        b.save(self.folder / 'manifest.json', {'format': 1, 'project_ref': b.PROJECT, 'server_major': 17,
            'captured_at': '2026-10-31T00:00:00+00:00', 'restore_owner': 'Fixture operator',
            'files': {n:b.digest(self.folder / n) for n in ['database.dump','roles.sql']}, 'expected': expected})
        return expected
    def args(self):
        return SimpleNamespace(backup_dir=str(self.folder), image='supabase/postgres@sha256:' + 'a'*64)
    def test_private_paths(self):
        file = self.folder / 'credential'
        file.write_text('fixture-only')
        file.chmod(0o644)
        with self.assertRaises(b.SafetyError): b.private_path(file)
        file.chmod(0o600)
        self.assertEqual(b.private_path(file), file)
        link = self.folder / 'link'; link.symlink_to(file)
        with self.assertRaises(b.SafetyError): b.private_path(link)
        with self.assertRaises(b.SafetyError): b.private_path(b.ROOT, directory=True)
    def test_hidden_configuration_never_echoes_password(self):
        password = 'fixture' + chr(92) + 'only:secret'
        args = SimpleNamespace(config_dir=str(self.folder))
        answers = [f'db.{b.PROJECT}.supabase.co','postgres','system']
        output = io.StringIO()
        with patch.object(b.sys.stdin,'isatty',return_value=True), patch('builtins.input',side_effect=answers), patch.object(b.getpass,'getpass',return_value=password), contextlib.redirect_stdout(output):
            b.configure(args)
        self.assertNotIn(password,output.getvalue())
        line = (self.folder / '.pgpass').read_text()
        self.assertIn('fixture' + chr(92)*2 + 'only' + chr(92) + ':secret',line)
        self.assertEqual((self.folder / '.pgpass').stat().st_mode & 0o077,0)
        self.assertNotIn(password,(self.folder / '.pg_service.conf').read_text())
    def test_configuration_and_no_plaintext_environment_password(self):
        service = self.folder / 'service'; passwd = self.folder / 'pass'
        service.write_text(f'[production]\nhost=db.{b.PROJECT}.supabase.co\nuser=postgres\ndbname=postgres\nport=5432\nsslmode=verify-full\nsslrootcert=system\n')
        passwd.write_text('fixture-only')
        env = {'PGSERVICEFILE':str(service),'PGPASSFILE':str(passwd)}
        with patch.dict(os.environ, env, clear=True):
            conn, child = b.source_config('production')
            self.assertEqual(conn,'service=production sslmode=verify-full')
            self.assertIn('default_transaction_read_only=on',child['PGOPTIONS'])
            self.assertNotIn('PGPASSWORD',child)
            with self.assertRaises(b.SafetyError): b.source_config('postgresql://not-allowed')
        with patch.dict(os.environ, {**env,'PGPASSWORD':'fixture-only'}, clear=True):
            with self.assertRaises(b.SafetyError): b.source_config('production')
    def test_roles_are_guarded_and_quoted(self):
        text = b.guarded_roles('CREATE ROLE postgres;\nCREATE ROLE "test role";\nALTER ROLE postgres WITH SUPERUSER;')
        self.assertIn('IF NOT EXISTS',text)
        self.assertNotIn('\nCREATE ROLE ',text)
        self.assertIn("rolname='test role'",text)
        self.assertIn('ALTER ROLE postgres WITH SUPERUSER;',text)
        self.assertEqual(b.quote_identifier('a"b'),'"a""b"')
    def test_backup_uses_shared_read_only_snapshot_and_never_marks_verified(self):
        closed = []
        expected = {'tables': {},'financial': {'total_dc':'90'},'public_security':{},'extensions':[]}
        class Session:
            def __init__(self,*args): pass
            def query(self,sql):
                if sql=='SHOW server_version_num': return '170011'
                if sql=='SELECT pg_export_snapshot()': return '00000003-0000001B-1'
                return ''
            def close(self): closed.append(True)
        def tool(args,**kwargs):
            if '--version' in args: return args[0]+' (PostgreSQL) 17.11'
            self.assertIn('default_transaction_read_only=on',kwargs['env']['PGOPTIONS'])
            if args[0]=='pg_dump':
                self.assertIn('--snapshot=00000003-0000001B-1',args)
                Path(next(a.removeprefix('--file=') for a in args if a.startswith('--file='))).write_bytes(b'FIXTURE ARCHIVE')
            if args[0]=='pg_dumpall':
                self.assertIn('--no-role-passwords',args)
                return 'CREATE ROLE postgres;'
            return ''
        args=SimpleNamespace(service='fixture',output_parent=str(self.folder),owner='Fixture operator')
        with patch.object(b,'source_config',return_value=('service=fixture',{'PGOPTIONS':'-c default_transaction_read_only=on'})), patch.object(b,'Snapshot',Session), patch.object(b,'inspect_database',return_value=expected), patch.object(b,'run',side_effect=tool), contextlib.redirect_stdout(io.StringIO()):
            b.backup(args)
        self.assertEqual(closed,[True])
        folder=next(self.folder.iterdir()); manifest=json.loads((folder/'manifest.json').read_text())
        self.assertFalse(manifest['restore_verified']);self.assertEqual(manifest['expected'],expected)
        self.assertFalse(list(folder.glob('restore-evidence-*')))
        self.assertEqual((folder/'database.dump').stat().st_mode & 0o077,0)
    def test_unpinned_image_stops_before_docker(self):
        self.artifact();args=self.args();args.image='supabase/postgres:latest'
        with patch.object(b,'run') as run:
            with self.assertRaises(b.SafetyError): b.verify(args)
            run.assert_not_called()
    def test_checksum_failure_stops_before_docker(self):
        self.artifact(); (self.folder / 'database.dump').write_bytes(b'TAMPERED')
        with patch.object(b,'run') as run:
            with self.assertRaises(b.SafetyError): b.verify(self.args())
            run.assert_not_called()
    def test_docker_override_rejected_before_tools(self):
        self.artifact()
        with patch.dict(os.environ, {'DOCKER_HOST':'tcp://not-local'}, clear=True), patch.object(b,'run') as run:
            with self.assertRaises(b.SafetyError): b.verify(self.args())
            run.assert_not_called()
    def test_only_fresh_isolated_container_and_verified_evidence(self):
        self.exercise_restore(False)
    def test_mismatch_cleans_up_without_success_evidence(self):
        self.exercise_restore(True)
    def exercise_restore(self, mismatch):
        expected = self.artifact(); commands=[]
        def tool(args, **kwargs):
            commands.append((args,kwargs))
            if args[:3] == ['docker','context','inspect']: return 'unix:///var/run/docker.sock'
            if args[:2] == ['docker','run']: return 'b'*64
            if args[:2] == ['docker','exec'] and '-c' in args:
                sql=args[-1]
                if sql=='SHOW server_version_num': return '170011'
                if b.TABLES in sql or b.EXTENSIONS in sql: return '[]'
                if b.FINANCIAL in sql: return json.dumps({'users':3} if mismatch else expected['financial'])
                if b.SECURITY in sql: return '{}'
            return ''
        with patch.dict(os.environ, {}, clear=True), patch.object(b,'run',side_effect=tool), patch.object(b.subprocess,'run',return_value=SimpleNamespace(returncode=0)):
            if mismatch:
                with self.assertRaises(b.SafetyError): b.verify(self.args())
            else:
                with contextlib.redirect_stdout(io.StringIO()):
                    b.verify(self.args())
        evidence=list(self.folder.glob('restore-evidence-*.json'))
        self.assertEqual(len(evidence),0 if mismatch else 1)
        if evidence:
            result=json.loads(evidence[0].read_text()); self.assertFalse(result['production_rollout_authorized'])
            self.assertEqual(result['database_restore_result'],'PASS')
        launch=next(args for args,_ in commands if args[:2]==['docker','run'])
        self.assertIn('--network=none',launch); self.assertIn('--tmpfs=/var/lib/postgresql/data:rw,mode=0700',launch)
        self.assertFalse(any(a.startswith(('--publish','-p','--volume=')) for a in launch))
        restore=next(args for args,_ in commands if 'pg_restore' in args)
        self.assertEqual(restore[:3],['docker','exec','b'*64]); self.assertIn('/var/run/postgresql',restore)
        self.assertEqual(commands[-1][0],['docker','rm','--force','--volumes','b'*64])
        roles=next(args for args,kwargs in commands if kwargs.get('input'))
        self.assertIn('--interactive',roles)

if __name__=='__main__': unittest.main()
