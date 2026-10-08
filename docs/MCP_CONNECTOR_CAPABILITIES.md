# Rocket Freight Claude MCP Connector — Capabilities & Access Reference

**Component:** `mcp-logistics/` (Node/TypeScript MCP server, Docker: `projecttracker-mcp-logistics`)
**Public endpoint:** `https://logistics-mcp.axtificial.uk` (Cloudflare tunnel sidecar: `projecttracker-mcp-tunnel`)
**Status:** Live
**Last updated:** 2026-10-05

---

## 1. What this connector is

A remote **Model Context Protocol (MCP)** server that lets Claude (claude.ai web, Claude
Desktop, Claude mobile) connect **into** the INtranet logistics database and answer
questions with live operational data. It is entirely separate from the backend's
server-side Claude API service (`ClaudeAIService` / Welly chat) — this connector works in
the opposite direction: *Claude is the client, our data is the server*.

```
Claude (claude.ai / Desktop)
        │  OAuth2 + PKCE (shared password consent screen)
        ▼
Cloudflare tunnel  ──►  mcp-logistics (Express + MCP Streamable HTTP, port 8080)
                                │  SQL (login: mcp_readonly)
                                ▼
                        SQL Server — vw_mcp_* views ONLY
```

---

## 2. Security model (current)

| Aspect | Value |
| --- | --- |
| Auth flow | OAuth 2.0 authorization-code + PKCE; user types the shared `ACCESS_PASSWORD` on a consent page |
| Password | `MCP_ACCESS_PASSWORD` in root `.env` (currently `welly` — see §6 hardening) |
| Token lifetime | **7 days** (`TOKEN_TTL_SECONDS = 60*60*24*7` in [mcp-logistics/src/server.ts](../mcp-logistics/src/server.ts)) |
| Token storage | In-memory only — a container restart revokes all tokens; everyone re-authorizes |
| DB account | `mcp_readonly` — least privilege, SELECT only on `vw_mcp_*` views |
| Writes | **None possible.** Every tool is a parameterized SELECT. No INSERT/UPDATE/DELETE/DDL, no backend API access, no service account |
| File access | Read-only, restricted to the documents root (`DOCS_ROOT=/app/documents`), path-normalised — used only to serve POD files |
| Transport | HTTPS via Cloudflare tunnel; no inbound firewall ports opened |

---

## 3. What Claude can access — the 36 tools

All tools are defined in [mcp-logistics/src/tools.ts](../mcp-logistics/src/tools.ts).
Everything is **read-only**.

### 3.1 Loads & trip sheets
| Tool | What it returns |
| --- | --- |
| `list_active_loads` | Loads with status, driver/vehicle assignment, pickup/delivery schedule. Filter by status. |
| `get_load` | Full detail for one load incl. all linked invoices with financials. |
| `list_tripsheets` | Trip sheets with status (Draft→Approved), route/warehouse, schedule; date-range filter. |
| `get_tripsheet` | One trip sheet with every delivery line (stop) + sign-off/approval status. |

### 3.2 Proof of delivery
| Tool | What it returns |
| --- | --- |
| `pod_summary` | POD metadata (file name, type, size) filtered by region/date range. |
| `get_pod_file` | **The actual POD file bytes** (PDF/image) as an embedded resource — Claude can read/analyse the scanned document. |
| `outstanding_pods` | Delivered loads with no POD after N hours (default 48) — SOP 3 chase list. |

### 3.3 Fleet, drivers & compliance
| Tool | What it returns |
| --- | --- |
| `list_drivers` | Drivers with licence details and status. |
| `driver_licence_expiry` | Licences expiring in N days (incl. already expired) — SOP 1 compliance. |
| `list_vehicles` | Fleet with registration, make/model, status, last known location. |
| `list_maintenance` | Service records; filter by vehicle/status/upcoming/overdue. |
| `list_vehicle_movements` | CarTrack trips: distance, duration, max speed, idle, harsh braking/cornering/acceleration, geofences. |
| `driving_behaviour_summary` | Per-vehicle behaviour score (100 − penalties) over a date range. |

### 3.4 Fuel (TFN / Puma)
| Tool | What it returns |
| --- | --- |
| `list_fuel_transactions` | Card draws + manual entries: litres, spend, per vehicle/month. |
| `fuel_efficiency_summary` | Per-vehicle litres, spend, avg km/l, anomaly flags (theft/leak indicators). |
| `list_fuel_orders` | TFN orders: allocated vs used litres/amount, remaining balance. |

### 3.5 Customers & sales ⚠️ (commercially sensitive)
| Tool | What it returns |
| --- | --- |
| `list_customers` | Contacts, geocoded addresses, **payment terms, credit limits, VAT/company reg numbers**. |
| `get_customer` | Full bundle: details + addresses + recent invoices **with cost/margin/GP** + linked loads. |
| `customer_delivery_addresses` | Saved geocoded addresses with instructions and usage counts. |
| `list_pending_invoices` | Unallocated invoices with **full financials: sales, returns, net sales, cost of sales, margin %, gross profit**. |
| `sales_history_summary` | Reconciled sales totals by company and month. |

### 3.6 Analytics & operations
| Tool | What it returns |
| --- | --- |
| `delivery_performance_summary` | On-time vs late KPIs, avg delay, per-warehouse breakdown. |
| `route_efficiency_summary` | Estimated vs actual distance/cost, capacity per load, routing drift. |
| `stock_on_hand_summary` | Stock per commodity per warehouse, reorder levels, below-reorder flags. |
| `daily_ops_briefing` | Composed one-day snapshot: scheduled/delivered, on-time %, pending, outstanding PODs. |
| `list_warehouses` | Warehouses with capacity and manager contacts. |

### 3.6a Composed lookups & scorecards (added 2026-10-05)
| Tool | What it returns |
| --- | --- |
| `where_is_vehicle` | Last known CarTrack position + most recent trip + active load with scheduled next delivery (ETA proxy). |
| `load_timeline` | One load end-to-end: load, invoices, originating trip sheet, CarTrack trips during the load, PODs with turnaround hours. |
| `customer_scorecard` | On-time %, avg POD turnaround, monthly sales trend, recent sales vs credit limit, pending value. |
| `driver_scorecard` | Licence status, on-time %, missing PODs, TFN fuel efficiency, harsh events on vehicles driven. |
| `cost_per_km` | Per-vehicle fuel + maintenance cost ÷ CarTrack distance (tolls/expenses not in this DB yet). |
| `exceptions_today` | One call: late loads, missing PODs, fuel anomalies (7d), licences ≤30d, overdue services, below-reorder stock, trip sheets awaiting signature/approval. |
| `incident_history` | LogisticsIncidents (speeding, curfew movement, geofence exits) per vehicle/driver + harsh-event totals for the same period. Backed by new view `vw_mcp_incidents`. |
| `driver_availability` | Free/busy/unavailable per driver for a date (busy = load booked; leave is not in this DB — noted in output). |
| `search_sop` | Full-text search over .md/.txt documents in the document share, with context snippets, so Claude can quote the exact rule. |
| `compare_periods` | Any key figure (loads/sales/fuel/distance) this period vs the previous period or an explicit comparison range, with % change. |

### 3.6b Built-in prompts (one click in Claude)
| Prompt | Workflow |
| --- | --- |
| `morning_briefing` | Yesterday's performance + prioritised action list for today. |
| `weekly_fleet_review` | 7-day delivery/behaviour/fuel/incident review with late-delivery cause analysis (idle, off-route, late departure) and week-on-week comparison. |
| `month_end_fuel_audit` | Spend, km/l, anomalies cross-checked against CarTrack for theft indicators (fill-up where the truck wasn't). |
| `customer_dispute_pack` | Scorecard + load timeline + POD scan check (signature/date/quantities vs invoice) + chronological assessment. |
| `compliance_sweep` | Licences, services, PODs, incidents — output as a compliance register with SOP quotes via `search_sop`. |
| `driver_performance_review` | Structured, fair review for one driver vs fleet averages. |

### 3.7 What Claude can do with this
Because Claude is the reasoning layer, the connector effectively enables:
- Natural-language ops Q&A: *"Which loads are late this week and why?"*
- Cross-tool analysis: fuel anomalies × CarTrack behaviour × driver
- Document reading: open a POD scan and check the signature/quantities
- Daily/weekly briefings composed from multiple tools
- Compliance chasing: expiring licences, overdue services, missing PODs
- Customer support lookups: full dispute bundle in one call

### 3.8 What Claude can pull from the internet
The **connector itself has zero internet access** — it only queries our SQL views and
reads POD files. However, **Claude the client** can combine our data with its own
capabilities in the same conversation:
- **Claude's web search** (if enabled in the user's Claude settings): e.g. look up fuel
  price announcements, public holiday calendars, weather on a delivery route, customer
  company registrations (CIPC), and correlate with our data.
- **Claude's own knowledge**: SA geography/distances, industry benchmarks for km/l,
  logistics best practice.
- Other connectors the user has attached (Google Drive, email, etc.) can be mixed with
  ours in one chat.

> Privacy note: any data a tool returns becomes part of the Claude conversation and is
> processed by Anthropic under their consumer/API terms. Only expose what you're
> comfortable leaving the premises.

---

## 4. What Claude can NOT do (by design)

- ❌ No writes of any kind — cannot create/edit loads, tripsheets, invoices, anything.
- ❌ No access to tables outside the `vw_mcp_*` views (HR, payroll, users, finance books,
  messaging, documents other than PODs).
- ❌ No backend API calls — no JWT, no service account, no intranet endpoints.
- ❌ No user impersonation — one shared read-only identity for all connected users.
- ❌ No internet fetching from the server side.
- ❌ No file access outside `/app/documents` (path traversal is normalised away).

---

## 5. Possible future additions

### 5.1 More read-only data (low risk — just new views + tools)
| Candidate | Value |
| --- | --- |
| **Requisitions / petty cash** | Spend queries against fuel/route cost analysis. |
| **Freight invoices + payments** (`InvoicesController` data) | Revenue-side KPIs, unpaid-invoice chasing. |
| **Expense tracker + tolls** | Completes `cost_per_km` (currently fuel + maintenance only). |
| **HR-lite: driver leave** | Completes `driver_availability` (currently load-bookings only). |
| **Imported stock / SOH detail** | Product-level availability for delivery planning. |
| **CarTrack live positions** | True live GPS for `where_is_vehicle` (currently last-sync position). |

### 5.2 Action tools (write access — needs careful gating)
If ever allowed, writes should be **narrow, auditable, and confirm-first**:
| Candidate | Guard rails |
| --- | --- |
| Flag a POD as disputed / add a note | Append-only note table, author = "claude-mcp", audit row. |
| Create a draft load from pending invoices | Draft status only; human approves in the UI. |
| Schedule a maintenance booking request | Request queue, not direct booking. |
| Send a "missing POD" chaser email | Template-only, rate-limited, logged. |

Prerequisites before any write tool: per-user auth (not shared password), an audit table,
and tool-level allow-lists.

### 5.3 Platform/infra improvements
- **Per-user credentials** instead of one shared password (map consent to intranet users).
- **Scoped tokens** — e.g. a "driver" scope that excludes customer financials.
- **Redis/DB token store** so restarts don't log everyone out.
- **Rate limiting + request logging** on the public endpoint (it is internet-exposed).
- **Prompt resources** — ship canned MCP prompts ("daily briefing", "fuel audit") so users
  get one-click workflows.
- **Second MCP server for Sales/Finance** (separate password + views) rather than widening
  this one — keeps the blast radius per connector small.

---

## 6. Hardening recommendations (current state)

1. **Password strength:** `welly` is short and guessable for a public endpoint. Prefer
   `welly-<random>` (e.g. `welly-K3p9vTqX`). Rotate via `.env` → `docker compose up -d mcp-logistics`.
2. **Customer financials exposure:** margins, cost of sales and credit limits are visible
   to anyone with the password. Consider a scoped view set if non-managers get access.
3. **Token revocation:** restart the container to revoke all tokens instantly.
4. **Monitor:** `docker logs projecttracker-mcp-logistics` shows consent attempts; failed
   password entries are a brute-force signal.

---

## 7. Quick ops reference

| Task | Command |
| --- | --- |
| Change password | Edit `MCP_ACCESS_PASSWORD` in `.env`, then `docker compose up -d mcp-logistics` |
| Change token TTL | Edit `TOKEN_TTL_SECONDS` in `src/server.ts`, rebuild: `docker compose build mcp-logistics && docker compose up -d mcp-logistics` |
| Revoke all tokens | `docker restart projecttracker-mcp-logistics` |
| Check status | `docker ps --filter name=mcp` |
| View logs | `docker logs projecttracker-mcp-logistics --tail 50` |
| Connect from Claude | Settings → Connectors → Add custom connector → `https://logistics-mcp.axtificial.uk` → enter password |

See also: [CLAUDE_LOGISTICS_CONNECTOR.md](CLAUDE_LOGISTICS_CONNECTOR.md) (setup guide) and
[mcp-logistics/README.md](../mcp-logistics/README.md) (developer docs).

---

## 8. Changelog

- **Oct 2026:** Sales-rep vehicles added to the fleet and visible via `list_vehicles` /
  `list_vehicle_movements`: Lindani (DJ 76 VF ZN), Stanley (DJ 76 VW ZN, CarTrack unit
  DJ78VWZN), Deon (DJ 76 WC ZN). All three have live CarTrack positions and persisted
  movement history (`VehicleMovementHistory`).

