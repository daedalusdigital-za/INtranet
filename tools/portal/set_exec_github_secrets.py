"""Push the exec-portal GitHub repository variable + secret so .github/workflows/exec-portal-swa.yml can deploy.

Usage: python tools/portal/set_exec_github_secrets.py
Reads the SWA deployment token straight from Azure (az CLI must be signed in) and the GitHub token from the
local git credential store, exactly like set_portal_github_secrets.py.
"""
import subprocess
import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from set_portal_github_secrets import api, gh_token, set_secret, set_var  # noqa: E402

SWA_NAME = "swa-rocket-exec"
RG = "rg-rocket-portal"
EXEC_API_BASE = "https://app-rocket-portal-edge.azurewebsites.net"


def main():
    swa_token = subprocess.run(
        ["az", "staticwebapp", "secrets", "list", "-n", SWA_NAME, "-g", RG, "--query", "properties.apiKey", "-o", "tsv"],
        capture_output=True, text=True, check=True, shell=True).stdout.strip()
    if not swa_token:
        sys.exit("could not read the SWA deployment token from Azure")
    token = gh_token()
    st, key = api(token, "GET", "/actions/secrets/public-key")
    if st != 200:
        sys.exit(f"public-key failed: {st} {key}")
    set_var(token, "EXEC_API_BASE", EXEC_API_BASE)
    set_secret(token, key["key_id"], key["key"], "AZURE_STATIC_WEB_APPS_API_TOKEN_EXEC", swa_token)


if __name__ == "__main__":
    main()
