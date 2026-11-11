# Azure Hosting Plan — Promed Intranet

> Living document. Written 12 Nov 2026 as a plan for moving the intranet (ProjectTracker) from the on-prem Docker host to Azure. Update as decisions are made.

## 1. Where we are today

| Component | Today | Notes |
|---|---|---|
| API | `backend` container (.NET 10, port 5143) | SignalR hubs, hosted background services (mailbox monitors, remittance sweep, flow engine, schedulers) |
| UI | `frontend` container (nginx + Angular, port 80/443) | Certs mounted from `./certs` |
| Database | `mcr.microsoft.com/mssql/server:2022` container, volume `sql-data` | Backups to `C:\Backups\ProjectTrackerDB` via `Database/Backup-Database.ps1` |
| Search | `searxng` container | Internal only, used by AI features |
| MCP | `mcp-logistics` + `mcp-cloudflared` tunnel | Read-only NAS mount |
| Files | NAS share `\\192.168.10.76\WorkSpace\IntranetDocuments` (`DocumentsPath`), plus `./uploads`, `./documents`, `./archives`, `./kb-docs`, `./ai-data`, `./downloads`, `./attachments`, `C:\Users\Administrator\Documents\quotes` | PODs, remittance PDFs, aging uploads, vault docs, logos, requisition attachments |
| AI | Ollama (`host.docker.internal:11434`), local LLM server (`:8090`, `start-llm-server.ps1`) | GPU on the host |
| On-prem integrations | Sage server `SAGE-SVR`, biometric devices, TrayApp | LAN only |
| Internet integrations | CarTrack, TFN, SDM depots, Ngcandu, IMAP `mail.promedtechnologies.co.za` | No change needed |
| Public access | Cloudflare tunnel; `portal.rocketfreight.co.za` client portal | |
| Auth | Own JWT (users/roles/modules in DB); portal tokens separate audience | |

Existing Microsoft footprint: M365 tenant `Promedt.onmicrosoft.com`; several App Services already run (`app-sdm-*`, `ngcanduapi`), so a subscription and Entra ID exist.

## 2. Target architecture

```
Internet ──► Azure Front Door / Container Apps ingress (HTTPS, managed cert)
                 │
                 ├─ frontend  (Container App, nginx)        ─┐
                 ├─ backend   (Container App, min 1 replica) ─┤ Container Apps Environment
                 ├─ searxng   (Container App, internal)      ─┤ (VNet-integrated)
                 └─ mcp-logistics (Container App, internal)  ─┘
                        │               │
                        │               └─► Azure Files share  (mounted /app/documents, /app/uploads …)
                        └─► Azure SQL Database (Private Endpoint)

Key Vault (secrets)   ACR (images)   Log Analytics + App Insights
Optional: VPN Gateway ──► office LAN (Sage, biometrics, GPU box)
```

Region: **South Africa North**. Resource group: `rg-intranet-prod`.

| Service | SKU (starting point) |
|---|---|
| Container Apps Environment | Consumption + Dedicated workload profile if needed |
| backend | 1 vCPU / 2 GiB, **min 1 / max 1** replica (see §5 background jobs) |
| frontend | 0.25 vCPU / 0.5 GiB, min 1 |
| Azure SQL | General Purpose, Serverless 2 vCore (auto-pause **off** — background jobs) or Provisioned 2 vCore |
| Azure Files | Premium or Transaction-optimised, 1 TB, SMB mounted via Container Apps storage |
| ACR | Basic |
| Key Vault | Standard |
| VPN Gateway | VpnGw1 — only if phase 2 needs LAN |

## 3. Migration steps

### Phase 0 — access & prep
- [ ] Working Azure login (Owner/Contributor on the subscription). `az login` with `welcome@Promedt.onmicrosoft.com` failed on 11 Nov — need a proper account or service principal.
- [ ] Create `rg-intranet-prod`, ACR, Key Vault, Log Analytics.
- [ ] Create service principal / OIDC federation for GitHub Actions.

### Phase 1 — lift & shift (1–2 days, run in parallel with on-prem)
- [ ] **Images**: push `backend`, `frontend`, `searxng`, `mcp-logistics` to ACR (`docker compose build` → `docker tag` → `docker push`).
- [ ] **Database**: `sqlpackage /Action:Export` → `.bacpac` → import into Azure SQL. Check: append-only trigger on `ShipmentEvents`, any `xp_cmdshell`/linked-server usage, raw-SQL migrations (all idempotent so `Database.Migrate()` is safe). Set `TrustServerCertificate=false`, `Encrypt=true`.
- [ ] **Files**: create Azure Files share `intranet-docs`; `azcopy copy` / Robocopy the NAS folder + `uploads`, `documents`, `archives`, `quotes`, `kb-docs`, `ai-data`. Mount into backend at the same container paths used in compose; set `DocumentsPath=/app/documents`.
- [ ] **Config**: move `appsettings.json` secrets (SQL connection, JWT key, SMTP/IMAP passwords, CarTrack/TFN/SDM keys, `DocumentPasswords`) into Key Vault → Container Apps secrets → env vars (`ConnectionStrings__DefaultConnection`, etc.).
- [ ] **CORS / URLs**: replace `192.168.10.151` / `localhost` origins with the new hostnames; `Portal__PublicUrl`.
- [ ] **AI**: point `Ollama__BaseUrl` / `LocalLlm__BaseUrl` at either Azure OpenAI (preferred, small code shim) or the on-prem GPU box over VPN. If neither is ready, disable AI features via config.
- [ ] **CI/CD**: GitHub Actions on push to `main` → build → push ACR → `az containerapp update`.
- [ ] Smoke-test: login, Finance (PODs, Aging, Remittances scan), Logistics, Sales, portal quote, SignalR notifications, file view/download.

### Phase 2 — cut-over
- [ ] DNS: intranet hostname → Container Apps / Front Door; `portal.rocketfreight.co.za` CNAME.
- [ ] VPN Gateway + site-to-site to the office **if** Sage direct reads, biometrics or TrayApp need LAN. Otherwise repoint TrayApp/biometrics to the public API URL.
- [ ] Decommission `mcp-cloudflared`.
- [ ] Set up Azure SQL automated backups (PITR 7–35 days) + long-term retention; retire `Backup-Database.ps1`.
- [ ] Alerts: backend restarts, 5xx rate, SQL DTU, Files capacity, failed remittance/mailbox scans.

### Phase 3 — cloud-native improvements (optional)
- [ ] Blob Storage instead of Azure Files (refactor `PhysicalFile`/`File.*` usage in PodDocuments, Remittances, Aging, Vault, Logos, uploads → `IFileStorage` abstraction).
- [ ] Azure SignalR Service → allows backend to scale beyond 1 replica.
- [ ] Split hosted services into a dedicated `worker` container (mailbox IDLE monitor, remittance sweep, flow engine, schedulers) with a distributed lock.
- [ ] Entra ID SSO (staff already have M365 accounts); keep JWT for portal.
- [ ] Front Door + WAF.

## 4. Code / config touch points

| Area | File(s) | Change |
|---|---|---|
| Connection string | `Backend/appsettings*.json`, compose env | Azure SQL, `Encrypt=true` |
| File paths | `DocumentsPath`, compose volumes | Azure Files mount paths |
| AI endpoints | `Ollama`, `LocalLlm`, `SearXNG` sections | Azure OpenAI or VPN host |
| CORS | `Cors:AllowedOrigins` | new hostnames |
| Health checks | `Backend/HealthChecks/` | already present — wire to Container Apps probes |
| Background jobs | `Backend/Extensions/ServiceCollectionExtensions.cs` hosted services | single replica or lock |
| Certs | `frontend` nginx, `./certs` | drop — TLS terminates at ingress |

## 5. Gotchas

- **Scale-to-zero kills background jobs** (00:00 remittance sweep, sales IMAP IDLE, flow timers). Keep backend `minReplicas: 1`.
- **>1 backend replica = duplicate sweeps / split SignalR** until Phase 3.
- **Azure SQL Serverless auto-pause** breaks the nightly jobs — turn it off or use provisioned.
- **SMB on Azure Files** is fine for `PhysicalFile`, but latency is higher than the NAS; large PDF listings may feel slower — paginate (PODs/Remittances already do).
- **Time zone**: containers run UTC; scheduled jobs (`RunAt 00:00`) should use `TZ=Africa/Johannesburg` env or convert explicitly.
- **IMAP from Azure**: `mail.promedtechnologies.co.za` must allow connections from Azure IPs (check firewall/fail2ban).
- **Outbound static IP** (for CarTrack/TFN allow-lists): Container Apps needs a NAT Gateway or VNet with fixed egress.

## 6. Estimated monthly cost (ZAR, South Africa North, Nov 2026 pricing — verify)

| Item | Estimate |
|---|---|
| Container Apps (backend always-on + frontend + searxng + mcp) | R2,500 – 4,500 |
| Azure SQL GP 2 vCore | R3,000 – 6,000 |
| Azure Files 1 TB | R1,000 – 2,000 |
| ACR, Key Vault, Log Analytics | R500 – 1,000 |
| VPN Gateway (optional) | R2,000 – 3,000 |
| Azure OpenAI (optional, usage-based) | R500 – 3,000 |
| **Total** | **≈ R7k – 16k / month** (+ GPU VM R15–30k if self-hosting LLM) |

## 7. Decisions needed

1. Azure OpenAI vs keep on-prem GPU over VPN vs pause AI features.
2. VPN to office (Sage direct, biometrics) — yes/no.
3. Azure Files now vs Blob refactor first.
4. Who owns the Azure subscription/billing and the GitHub Actions service principal.
5. Cut-over window (suggest a Friday evening with on-prem kept warm for a week).

## 8. Rollback

On-prem stack stays running during Phase 1–2. Rollback = DNS back to the office + restore any DB delta (Azure SQL export → on-prem container). Keep NAS as source of truth for files until cut-over is confirmed.
