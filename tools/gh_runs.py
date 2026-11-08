"""Print the latest GitHub Actions runs for this repo (uses the git credential store token)."""
import json, re, subprocess, sys, urllib.request

p = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n', capture_output=True, text=True).stdout
t = re.search(r'^password=(.+)$', p, re.M).group(1).strip()
n = sys.argv[1] if len(sys.argv) > 1 else '6'
r = urllib.request.Request(f'https://api.github.com/repos/daedalusdigital-za/INtranet/actions/runs?per_page={n}',
                           headers={'Authorization': 'Bearer ' + t, 'User-Agent': 'x'})
for w in json.load(urllib.request.urlopen(r))['workflow_runs']:
    print(f"{w['name']:28} | {w['head_branch']:24} | {w['status']:12} | {str(w['conclusion']):8} | {w['html_url']}")
