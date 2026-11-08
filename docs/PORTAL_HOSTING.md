# Client portal hosting — runbook

Customers (first: AFB Overberg) book, track, manage addresses, download documents and talk to support from
anywhere, while the intranet API itself stays on the LAN.

```
 browser ──HTTPS──▶ Azure Static Web App (client-portal/)          free · free TLS · deploys from GitHub
     │
     └──HTTPS──▶ Azure App Service "portal-edge" (portal-edge/)    B1 · YARP · forwards ONLY /api/portal/*
                        │  Hybrid Connection (outbound-only from SAGE-SVR, no router ports)
                        ▼
                 on-prem API  http://sage-svr:5143  (docker backend)
                 Security/PortalEdge.cs: requests carrying X-Portal-Edge-Key may reach /api/portal + /health only
```

Protection layers: SWA/App Service TLS · edge rate limits (120/min, 10/min on credentials, per client IP) ·
API rate limits (same) · BCrypt + 5-strikes/15-min lockout on portal logins · portal JWT has its own audience so it
is useless on intranet endpoints · edge key check + 404 for anything outside `/api/portal` on the API side.

---

## 0. What exists (provisioned 8 Nov 2026 by `tools/provision-portal-azure.ps1`)

Subscription **PromedSubscription** · resource group **rg-rocket-portal**

| Resource | Name | Notes |
|---|---|---|
| Static Web App | `swa-rocket-portal` (Free, westus2*) | https://thankful-river-00b68851e.5.azurestaticapps.net |
| App Service plan | `asp-rocket-portal-edge` (B1 Windows, southafricanorth) | Windows is required for Hybrid Connections |
| Web app | `app-rocket-portal-edge` (.NET 10) | https://app-rocket-portal-edge.azurewebsites.net |
| Relay namespace / hybrid connection | `relay-rocket-portal` / `sage-svr-5143` | endpoint `sage-svr:5143`; auth rules `defaultSender` (app) + `defaultListener` (HCM) |
| Hybrid Connection Manager | installed on SAGE-SVR (`C:\Program Files (x86)\HybridConnectionManager`) | `hcm.exe list` should show **Connected** |

\* West Europe refused new SWA customers on this subscription; SWA content is served from a global CDN so the region only holds metadata.

GitHub repo vars/secrets were set by `tools/set_portal_github_secrets.py` (`PORTAL_API_BASE`, `PORTAL_EDGE_APP_NAME`,
`AZURE_STATIC_WEB_APPS_API_TOKEN_PORTAL`, `AZURE_WEBAPP_PUBLISH_PROFILE_PORTAL_EDGE`). `PORTAL_GOOGLE_MAPS_KEY` is **not** set yet.
Generated values live in `tools/portal-azure-output.local.txt` (gitignored). Re-running the provisioning script is safe (idempotent).

Custom domains (`portal.rocketfreight.co.za`, `portal-api.rocketfreight.co.za`) are not configured; when they are, add them in
SWA → Custom domains and App Service → Custom domains, then add the host to `ALLOWED_ORIGINS` (edge) and `.env` `PORTAL_ORIGIN_1` (API).

## 1. One-time Azure setup (manual alternative to the script, ≈ 30 min)

### 1.1 Static Web App (portal front end)
1. Azure Portal → **Create resource → Static Web App**. Plan **Free**. Region: West Europe (closest with SWA).
2. Deployment: **Other** (we use our own workflow). Create.
3. Overview → **Manage deployment token** → copy. GitHub repo → Settings → Secrets → Actions → new secret
   `AZURE_STATIC_WEB_APPS_API_TOKEN_PORTAL`.
4. Note the default hostname `https://<name>.azurestaticapps.net`.
5. Custom domain (optional, recommended): SWA → Custom domains → add `portal.rocketfreight.co.za`; create the
   CNAME it asks for at your DNS host. TLS is issued automatically.

### 1.2 App Service (edge)
1. Create resource → **Web App**: Runtime **.NET 10 (STS)**, OS **Windows** (Hybrid Connections need Windows or
   Linux non-container; Windows is the safe choice), plan **Basic B1** (~R250/month). Region: South Africa North.
2. Configuration → Application settings:
   | Setting | Value |
   |---|---|
   | `PORTAL_EDGE_KEY` | the `PORTAL_EDGE_KEY` from `.env` on SAGE-SVR |
   | `UPSTREAM` | `http://sage-svr:5143` |
   | `ALLOWED_ORIGINS` | `https://<name>.azurestaticapps.net,https://portal.rocketfreight.co.za` |
   | `WEBSITE_RUN_FROM_PACKAGE` | `1` |
3. Settings → **Networking → Hybrid connections → Add hybrid connection → Create new**: name `sage-svr-api`,
   **Endpoint Host `sage-svr`, Port `5143`** (must match `UPSTREAM`), create a new Relay namespace (Basic).
4. Still on that page: **Download connection manager** → install **Hybrid Connection Manager** on SAGE-SVR →
   open it → *Add a new Hybrid Connection* → sign in → pick `sage-svr-api`. Status must show **Connected**.
   (Outbound 443 only. Keep HCM running as its Windows service.)
5. Overview → **Download publish profile** → GitHub secret `AZURE_WEBAPP_PUBLISH_PROFILE_PORTAL_EDGE`.
   GitHub variable `PORTAL_EDGE_APP_NAME` = the web app name.
6. Custom domain (optional): `portal-api.rocketfreight.co.za` → App Service → Custom domains (free managed cert).
7. Health check: Monitoring → Health check → path `/health`.

### 1.3 GitHub variables
Settings → Secrets and variables → Actions → **Variables**:
- `PORTAL_API_BASE` = `https://<edge host>/api/portal` (custom domain or `https://<app>.azurewebsites.net/api/portal`)
- `PORTAL_GOOGLE_MAPS_KEY` = browser key restricted to the portal hostnames (optional)

### 1.4 On-prem
`.env` already has `PORTAL_EDGE_KEY`, `PORTAL_ORIGIN_1`, `PORTAL_ORIGIN_2`. Set `PORTAL_ORIGIN_2` to the real
`https://<name>.azurestaticapps.net`, then `docker compose up -d backend`.

## 2. Deploy
Push to `main` (or `stock/ledger-integrity`) touching `client-portal/**` or `portal-edge/**` — the two workflows
in `.github/workflows/` build and deploy. Or run them from the Actions tab (*Run workflow*).

## 3. Verify
```
curl https://<edge>/health                                   → {"status":"ok"}
curl -X POST https://<edge>/api/portal/auth/login -d '{}'     → 401 (API reached through the tunnel)
curl https://<edge>/api/users                                 → 404 (nothing else exists publicly)
```
Portal: open the SWA URL → sign in with the customer's portal login → place a booking → it appears under
Logistics → Overberg tripsheets (awaiting confirmation).

## 4. Customer logins
Logistics → Overberg tripsheets → **Portal users** (API `POST api/logistics/portal/users`): pick the customer,
name, email, role (`admin` can manage that customer's addresses/users). A temporary password is emailed; the user
must change it on first sign-in. Overberg = customer **435 AFB OVERBERG BREDASDORP** (1814 is a duplicate).

## 5. Rotate / revoke
- Edge key: change `PORTAL_EDGE_KEY` in `.env` and the App Service setting, restart both.
- Kill the public surface instantly: stop the App Service (or stop HCM on SAGE-SVR). The LAN is unaffected.
- Portal tokens: 12 h lifetime (`Portal:TokenHours`); changing `JWT_SECRET_KEY` signs everyone out.
