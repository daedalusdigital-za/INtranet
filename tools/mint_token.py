"""Mint a short-lived HS256 JWT for a local user (dev/verification only). Reads the secret from the backend container env."""
import base64, hmac, hashlib, json, subprocess, sys, time

def b64(b: bytes) -> str: return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

env = subprocess.run(["docker", "exec", "projecttracker-backend", "printenv"], capture_output=True, text=True).stdout
cfg = dict(l.split("=", 1) for l in env.splitlines() if "=" in l)
key = cfg["JwtSettings__SecretKey"]
issuer = cfg.get("JwtSettings__Issuer", "ProjectTrackerAPI"); audience = cfg.get("JwtSettings__Audience", "ProjectTrackerClient")
uid = sys.argv[1] if len(sys.argv) > 1 else "1"
role = sys.argv[2] if len(sys.argv) > 2 else "Super Admin"
now = int(time.time())
claims = {
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": uid,
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "verify@local",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "verify",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": role,
    "nbf": now, "exp": now + 900, "iat": now,
}
if issuer: claims["iss"] = issuer
if audience: claims["aud"] = audience
h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()); p = b64(json.dumps(claims).encode())
sig = b64(hmac.new(key.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest())
print(f"{h}.{p}.{sig}")
