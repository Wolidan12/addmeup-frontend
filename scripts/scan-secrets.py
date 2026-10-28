"""Read-only, value-redacting scan of working source, build, env/log files and local Git blobs.
Pattern-based detection is not a substitute for provider-side credential inventory.
"""
import base64, json, os, pathlib, re, subprocess, sys
root = pathlib.Path(__file__).resolve().parents[1]
patterns = {
    'Supabase private key': re.compile(rb'sb_secret_[A-Za-z0-9_-]{16,}'),
    'provider private key': re.compile(rb'\b(?:sk_live_|sk_test_)[A-Za-z0-9]{16,}'),
    'GitHub token': re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})'),
    'AWS access identifier': re.compile(rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'private key PEM': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
}
jwts = re.compile(rb'eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+')
findings = set()
scanned = 0

def scan(label, data):
    global scanned
    if b'\x00' in data[:2048]: return
    scanned += 1
    for kind, pattern in patterns.items():
        if pattern.search(data): findings.add((label, kind))
    for match in jwts.finditer(data):
        try:
            payload = json.loads(base64.urlsafe_b64decode(match[1] + b'=' * (-len(match[1]) % 4)))
            if payload.get('role') == 'service_role': findings.add((label, 'Supabase service-role JWT'))
        except (ValueError, TypeError): pass

skip = {'.git','node_modules','.cache','.arena','.local','.npm','.venv'}
for folder, dirs, files in os.walk(root):
    dirs[:] = [d for d in dirs if d not in skip]
    for name in files:
        p = pathlib.Path(folder) / name
        if p.stat().st_size < 8_000_000:
            scan(str(p.relative_to(root)), p.read_bytes())
# Only Git object contents, never .git/config, credentials or authentication stores.
objects = subprocess.check_output(['git','rev-list','--objects','--all'], cwd=root).splitlines()
for row in objects:
    oid = row.split(b' ', 1)[0].decode()
    if subprocess.check_output(['git','cat-file','-t',oid], cwd=root).strip() == b'blob':
        scan('git-blob:' + oid[:12], subprocess.check_output(['git','cat-file','blob',oid], cwd=root))
for key, value in os.environ.items():
    if key.startswith('VITE_'): scan('frontend-env:' + key, value.encode())
print(f'Scanned {scanned} text sources/blobs, including dist when present; private values are never printed.')
if findings:
    for label, kind in sorted(findings): print(f'REVIEW: {kind} in {label} [VALUE REDACTED]')
    sys.exit(1)
print('No supported private-credential patterns found. Public Supabase URLs and anon/publishable keys are expected.')
