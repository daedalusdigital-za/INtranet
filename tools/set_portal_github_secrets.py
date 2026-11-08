"""Push the client-portal GitHub repository variables + secrets from tools/portal-azure-output.local.txt.

Usage: python tools/set_portal_github_secrets.py
Uses the GitHub token from the local git credential store (git credential fill).
"""
import base64
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

from nacl import encoding, public

REPO = "daedalusdigital-za/INtranet"
OUT = Path(__file__).with_name("portal-azure-output.local.txt")


def gh_token() -> str:
    p = subprocess.run(["git", "credential", "fill"], input="protocol=https\nhost=github.com\n\n",
                       capture_output=True, text=True, check=True)
    m = re.search(r"^password=(.+)$", p.stdout, re.M)
    if not m:
        sys.exit("no GitHub token in credential store")
    return m.group(1).strip()


def api(token: str, method: str, path: str, body=None):
    req = urllib.request.Request(f"https://api.github.com/repos/{REPO}{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                                          "User-Agent": "portal-setup", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, (json.loads(r.read() or b"null"))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def set_var(token, name, value):
    st, _ = api(token, "PATCH", f"/actions/variables/{name}", {"name": name, "value": value})
    if st == 404:
        st, _ = api(token, "POST", "/actions/variables", {"name": name, "value": value})
    print(f"var    {name}: {st}")


def set_secret(token, key_id, key_b64, name, value):
    pk = public.PublicKey(key_b64.encode(), encoding.Base64Encoder())
    sealed = public.SealedBox(pk).encrypt(value.encode())
    st, _ = api(token, "PUT", f"/actions/secrets/{name}",
                {"encrypted_value": base64.b64encode(sealed).decode(), "key_id": key_id})
    print(f"secret {name}: {st}")


def main():
    text = OUT.read_text(encoding="utf-8-sig")
    api_base = re.search(r"PORTAL_API_BASE\s*=\s*(\S+)", text).group(1)
    app_name = re.search(r"PORTAL_EDGE_APP_NAME\s*=\s*(\S+)", text).group(1)
    swa_token = re.search(r"AZURE_STATIC_WEB_APPS_API_TOKEN_PORTAL\s*=\s*(\S+)", text).group(1)
    pub = text.split("AZURE_WEBAPP_PUBLISH_PROFILE_PORTAL_EDGE =", 1)[1].split("--- .env", 1)[0].strip()

    token = gh_token()
    st, key = api(token, "GET", "/actions/secrets/public-key")
    if st != 200:
        sys.exit(f"public-key failed: {st} {key}")

    set_var(token, "PORTAL_API_BASE", api_base)
    set_var(token, "PORTAL_EDGE_APP_NAME", app_name)
    set_secret(token, key["key_id"], key["key"], "AZURE_STATIC_WEB_APPS_API_TOKEN_PORTAL", swa_token)
    set_secret(token, key["key_id"], key["key"], "AZURE_WEBAPP_PUBLISH_PROFILE_PORTAL_EDGE", pub)

    st, vars_ = api(token, "GET", "/actions/variables?per_page=100")
    names = {v["name"] for v in vars_.get("variables", [])}
    if "PORTAL_GOOGLE_MAPS_KEY" not in names:
        print("note: PORTAL_GOOGLE_MAPS_KEY variable not set (map features in the portal will be disabled until it is)")


if __name__ == "__main__":
    main()
