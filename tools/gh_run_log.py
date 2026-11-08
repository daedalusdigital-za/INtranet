"""Print failing step logs for a GitHub Actions run: python tools/gh_run_log.py <run_id> [tail_lines]"""
import io, json, re, subprocess, sys, urllib.request, zipfile

run_id = sys.argv[1]
tail = int(sys.argv[2]) if len(sys.argv) > 2 else 60
p = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n', capture_output=True, text=True).stdout
t = re.search(r'^password=(.+)$', p, re.M).group(1).strip()
H = {'Authorization': 'Bearer ' + t, 'User-Agent': 'x'}
base = f'https://api.github.com/repos/daedalusdigital-za/INtranet/actions/runs/{run_id}'
jobs = json.load(urllib.request.urlopen(urllib.request.Request(base + '/jobs', headers=H)))['jobs']
for j in jobs:
    print(f"== job {j['name']}: {j['conclusion']}")
    for s in j['steps']:
        if s['conclusion'] not in ('success', 'skipped', None):
            print(f"   step FAILED: {s['name']}")
z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(urllib.request.Request(base + '/logs', headers=H)).read()))
failed = {s['name'] for j in jobs for s in j['steps'] if s['conclusion'] == 'failure'}
for name in z.namelist():
    if any(f in name for f in failed) and '/' in name:
        print(f"\n--- {name} ---")
        lines = z.read(name).decode('utf-8', 'replace').splitlines()
        for l in lines[-tail:]:
            print(re.sub(r'^\S+T\S+Z ', '', l))
