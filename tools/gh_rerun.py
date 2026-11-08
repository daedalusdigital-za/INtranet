"""Re-run failed jobs of a GitHub Actions run: python tools/gh_rerun.py <run_id>"""
import re, subprocess, sys, urllib.request
p = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n', capture_output=True, text=True).stdout
t = re.search(r'^password=(.+)$', p, re.M).group(1).strip()
r = urllib.request.Request(f'https://api.github.com/repos/daedalusdigital-za/INtranet/actions/runs/{sys.argv[1]}/rerun-failed-jobs',
                           method='POST', headers={'Authorization': 'Bearer ' + t, 'User-Agent': 'x'})
print(urllib.request.urlopen(r).status)
