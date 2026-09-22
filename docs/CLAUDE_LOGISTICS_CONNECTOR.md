# Claude Logistics Connector — What We Built & What It Unlocks

**Status:** ✅ Live in production
**Public URL:** `https://logistics-mcp.axtificial.uk/mcp`
**Type:** Read-only [Model Context Protocol](https://modelcontextprotocol.io) (MCP) custom connector for **Claude (Team)**
**Owner:** Logistics / Platform
**Last updated:** 17 September 2026

> This connector is **completely separate from Welly** (the in-app assistant). Welly and its
> `ClaudeAIService` were not touched. This is a standalone service that lets your Claude Team
> account read logistics data from home / claude.ai.

---

## 1. What we built

A small, standalone **MCP server** (Node/TypeScript) that exposes **read-only** logistics data
to Claude as a custom connector. It runs as its own Docker container next to the INtranet stack
and is published to the internet through a **Cloudflare named tunnel** — no firewall ports opened.

### Architecture

```
  claude.ai (Claude Team)
        │  HTTPS + OAuth 2.1 (password-gated)
        ▼
  Cloudflare edge  ──  named tunnel "intranet-logistics-mcp"
        │  (logistics-mcp.axtificial.uk)
        ▼
  cloudflared container ──► mcp-logistics container (:8080)
                                   │  parameterised, READ-ONLY SQL
                                   ▼
                          SQL Server (ProjectTrackerDB)
```

### Components

| Piece | Where | Role |
|-------|-------|------|
| MCP server | [mcp-logistics/src/server.ts](../mcp-logistics/src/server.ts) | Express app: OAuth 2.1 endpoints + `/mcp` Streamable-HTTP endpoint |
| Tools | [mcp-logistics/src/tools.ts](../mcp-logistics/src/tools.ts) | The read-only capabilities Claude can call |
| DB access | [mcp-logistics/src/db.ts](../mcp-logistics/src/db.ts) | Pooled `mssql` client, parameterised SELECTs only |
| Container | [mcp-logistics/Dockerfile](../mcp-logistics/Dockerfile) | node:22-alpine build+runtime |
| Wiring | [docker-compose.yml](../docker-compose.yml) | `mcp-logistics` + `mcp-cloudflared` services on `projecttracker-network` |
| Config | [.env](../.env) | Tunnel token, public URL, access password |
| Setup guide | [mcp-logistics/README.md](../mcp-logistics/README.md) | How to run / re-deploy / connect Claude |

### Security model

- **Read-only by design** — every tool runs a `SELECT` with **bound parameters**. No writes,
  no `INSERT`/`UPDATE`/`DELETE`, no DDL, no raw SQL from Claude.
- **Least-privilege DB login** — the connector connects as `mcp_readonly`, which has `SELECT`
  on a set of purpose-built `dbo.vw_mcp_*` views **only** (no base-table access). Verified:
  it is denied `SELECT` on base tables such as `dbo.Users`. See
  [Database/CreateMcpReadonlyViews.sql](../Database/CreateMcpReadonlyViews.sql).
- **OAuth 2.1 + password gate** — Claude must complete an OAuth flow; a human enters a shared
  **access password** on the consent screen before a bearer token is issued (8-hour tokens).
- **No open ports** — traffic reaches the server only via the Cloudflare Tunnel; the origin is
  never directly exposed to the internet.
- **Isolated** — the connector has its own container and only the DB reads it needs; it cannot
  affect the API, Welly, or the app.

### How it was set up (history)

1. Scaffolded the MCP server (package.json, tsconfig, server/tools/db, Dockerfile).
2. Added `mcp-logistics` + `mcp-cloudflared` services to the compose stack.
3. Started with a **trycloudflare Quick Tunnel** for instant testing (random URL).
4. Moved the domain **axtificial.uk** onto Cloudflare (registrar + DNS), created a **named tunnel**,
   and added the public hostname `logistics-mcp.axtificial.uk` → `http://mcp-logistics:8080`.
5. Verified end-to-end: DNS → tunnel → OAuth → MCP → live database (returned real warehouses,
   drivers, etc.).

---

## 2. What the connector gives Claude access to (today)

All tools are **read-only**. Source tables live in `ProjectTrackerDB`.

| Tool | What Claude can ask for | Backed by |
|------|--------------------------|-----------|
| `list_pending_invoices` | Imported delivery invoices **not yet on a load** — filter by source company (PMT/SBT) or province | `ImportedInvoices` |
| `list_active_loads` | Loads with status, assigned driver/vehicle, schedule | `Loads` + `Drivers`/`Vehicles`/`Warehouses` |
| `get_load` | Full detail for one load by load number, plus its linked invoices | `Loads` + `ImportedInvoices` |
| `list_warehouses` | Warehouses: location, capacity, manager contacts | `Warehouses` |
| `list_drivers` | Drivers: licence, type, expiry, status | `Drivers` |
| `list_vehicles` | Fleet: registration, make/model, status, last known location | `Vehicles` |
| `sales_history_summary` | Reconciled sales totals by company (optionally by month) between dates | `SalesHistoryRecords` |
| `pod_summary` | Proof-of-delivery metadata (driver, date, region, links) — **no file contents** | `PodDocuments` |
| `driver_licence_expiry` | Drivers whose licence expires within N days (incl. expired) | `Drivers` |
| `list_maintenance` | Vehicle service/repair records; upcoming/overdue filter | `VehicleMaintenance` + `Vehicles` |
| `outstanding_pods` | Delivered loads with no POD captured after N hours | `Loads` vs `PodDocuments` |
| `list_tripsheets` | Sales trip sheets: status, route, warehouse, schedule, sign-off | `SalesTripSheets` |
| `get_tripsheet` | One sales trip sheet + all delivery lines | `SalesTripSheets` + `SalesTripSheetLines` |
| `list_fuel_transactions` | Fuel card/manual draws: litres, amount, depot; filter by vehicle/month | `FuelTransactions` + `Vehicles` |
| `fuel_efficiency_summary` | Per-vehicle km/l, spend, anomaly counts between dates | `TfnTransactions` |
| `list_fuel_orders` | TFN fuel orders: allocated vs used litres/amount, remaining balance | `TfnOrders` |
| `list_vehicle_movements` | CarTrack trips: distance, speed, idle, harsh braking/cornering/accel | `VehicleMovementHistory` |
| `driving_behaviour_summary` | Per-vehicle computed behaviour score (harsh events + idle per 100km) | `VehicleMovementHistory` |
| `list_customers` | Logistics customers: contact + physical/delivery addresses (geocoded); no credit/balance | `LogisticsCustomers` |
| `customer_delivery_addresses` | Saved geocoded delivery addresses per customer | `CustomerDeliveryAddresses` |

### Example questions it can already answer

- "How many pending **PMT** invoices are there and which provinces are they going to?"
- "List today's **active loads** and who's driving them."
- "Show details for load **L-2026-0012** and what's on it."
- "Which **drivers** have licences expiring soon?"
- "Give me a **sales history** summary by company for August 2026."
- "How many **PODs** were captured in KZN last week?"
- "Which **warehouses** have the least available capacity right now?"

---

## 3. Future features & possibilities this unlocks

The connector is the hard part — the plumbing (secure remote access, auth, DB, deploy) is done.
Adding capability is now just adding a tool in [tools.ts](../mcp-logistics/src/tools.ts).

### A. More read tools (low effort, high value — safe)

- **Fleet compliance view** — licence-disc / permit / CarTrack-link gaps (feeds SOP 1 KPIs).
- **Maintenance & grounded vehicles** — open defects, upcoming services.
- **Fuel efficiency** — per-vehicle consumption + outliers (theft/leak flags, SOP 1 §E).
- **Outstanding PODs** — PODs > 24h/48h not captured, by driver (SOP 3 KPI).
- **Delivery performance** — on-time %, short/failed rates, top reasons (SOP 3 §3.6).
- **Debtors / unbilled** — proven deliveries not yet invoiced, days POD→invoice (SOP 4 KPIs).
- **Stock on hand / variance** — SOH by warehouse, stock-count variances (SOP 4 §D).
- **Route / capacity utilisation** — vehicle fill, optimisation adoption (SOP 2 KPIs).

### B. Analytics & reporting on demand

- Claude becomes a **natural-language BI layer** over logistics: ask a question, get the numbers,
  ask for a chart/table/summary — without building a dashboard for every metric.
- **Daily/weekly ops briefings** — "Summarise yesterday: loads dispatched, on-time %, outstanding
  PODs, top delivery failures" — driven entirely from live data.
- **KPI monitoring** against the SOP targets (see [LOGISTICS_SOP.md](LOGISTICS_SOP.md)) — Claude can
  flag anything off-target (e.g. overdue services, POD backlog, fuel variance > 10%).

### C. Cross-referencing & investigation

- "This customer disputes a delivery — pull the load, the POD, and the invoice and tell me the story."
- "Why is depot X behind this week?" — Claude joins loads, drivers, PODs, and sales to reason about it.
- Reconciliation help: loaded vs delivered vs returned vs billed (SOP 3/4).

### D. Write actions (future, deliberate & guarded)

Currently **read-only on purpose**. If/when the business wants Claude to *do* things, we can add
**scoped, audited write tools** — each one opt-in, permission-checked, and logged. Candidates:

- Draft/suggest tripsheet groupings (echoing the existing **Welly Suggests** logic).
- Flag an invoice for priority delivery.
- Create a maintenance note / defect record.
- Kick off a report or export.

> These would be added one at a time, with explicit approval, and would write via the **authenticated
> API** (not raw SQL), so existing permissions and audit logging apply.

### E. Reach & integration

- **Any MCP-capable client** can use the same server — Claude Desktop, other AI tools, internal
  agents — not just claude.ai.
- **Multi-tenant / role-scoped access** later: different passwords/tokens exposing different tool
  sets (e.g. Finance sees debtors, Dispatch sees loads).
- **Stable, permanent endpoint** means it can back scheduled jobs, alerts, or an "ops copilot".

---

## 4. Operate & maintain

| Task | Command / action |
|------|------------------|
| Public connector URL | `https://logistics-mcp.axtificial.uk/mcp` |
| Health check | `curl https://logistics-mcp.axtificial.uk/health` → `{"status":"ok"}` |
| Rebuild after code change | `docker compose build mcp-logistics; docker compose up -d mcp-logistics` |
| View server logs | `docker compose logs mcp-logistics --tail 50` |
| View tunnel logs | `docker compose logs mcp-cloudflared --tail 50` |
| Change access password | edit `MCP_ACCESS_PASSWORD` in [.env](../.env), then `docker compose up -d mcp-logistics` |
| Add a new tool | edit [mcp-logistics/src/tools.ts](../mcp-logistics/src/tools.ts), rebuild |

**Connect in Claude:** Settings → Connectors → Add custom connector → URL
`https://logistics-mcp.axtificial.uk/mcp` → enter the access password (custom connectors must be
enabled by a Team Owner).

---

*Related: [LOGISTICS_SOP.md](LOGISTICS_SOP.md) (the operational process this data supports),
[mcp-logistics/README.md](../mcp-logistics/README.md) (setup & deploy details).*
