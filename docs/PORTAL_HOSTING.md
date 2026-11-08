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

## 1. One-time Azure setup (≈ 30 min, portal clicks)

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
