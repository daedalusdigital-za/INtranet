# Logistics MCP Connector — Recommended Enhancements

**17 Sept 2026 · @Collette**

## Executive Summary

The Logistics MCP connector exposes 8 read-only tools today, reading directly against `ProjectTrackerDB` via parameterised SQL: vehicles, drivers, active loads, `get_load`, pending invoices, warehouses, POD metadata, and sales history. The full architecture map of the Logistics module shows a much larger surface behind it — 29 backend controllers covering tripsheets (six creation modes, PDF/QR, route optimisation, AI grouping), a full proof-of-delivery lifecycle (upload, view, download, invoice matching), maintenance, fuel (TFN/Puma), requisitions and petty cash, security/night-watch monitoring, six pre-built operational reports, and barcode/QR asset tracking.

Two changes matter more than any single new tool:

1. **Close the gap deliberately, in priority order.** Tripsheets, outstanding PODs, maintenance and driver licence expiry are all things people are likely to ask Claude about — they exist in the app today but have no tool in the connector.
2. **Change how new tools are sourced.** The current pattern is hand-written SQL joins in `tools.ts`. That's fine for simple lookups, but the app's Reports controller already computes several KPIs in C# (delivery performance, POD compliance, fuel consumption, driver performance, route efficiency). New tools for those should call the existing endpoint, or mirror its exact logic in a SQL view — not re-derive the number independently, or the two systems will quietly disagree.

This document sets out a prioritised gap analysis, a data-source strategy, a phased list of roughly 14 new tools, and supporting recommendations for security, data modelling and rollout.

---

## Current State

| Tool | Backing source | What it returns |
|------|----------------|-----------------|
| `list_vehicles` | Vehicles | Registration, make/model, status, last known location |
| `list_drivers` | Drivers | Licence, type, status |
| `list_active_loads` | Loads + Drivers/Vehicles/Warehouses | Status, assignment, schedule |
| `get_load` | Loads + ImportedInvoices | Single load detail, plus linked invoices |
| `list_pending_invoices` | ImportedInvoices | Invoices not yet on a load, filterable by company/province |
| `list_warehouses` | Warehouses | Location, capacity, manager contact |
| `pod_summary` | PodDocuments | Metadata only — driver, date, region, links; no file contents |
| `sales_history_summary` | SalesHistoryRecords | Reconciled totals by company, optionally by month |

**Architecture:** a standalone Node/TypeScript MCP server (Express, Streamable-HTTP `/mcp` endpoint), OAuth 2.1 plus a shared access password (8-hour bearer tokens), reached only through a Cloudflare named tunnel with no open ports, using a pooled `mssql` client that runs parameterised, read-only SELECTs. It has its own Docker container, isolated from Welly and the main API.

---

## Gap Analysis

| Dashboard tab / feature | In the app today | In the connector today | Priority to add |
|-------------------------|------------------|------------------------|-----------------|
| Active Loads | Full CRUD + live tracking | Partial — read-only list/detail | Adequate as is |
| Fleet (vehicles + drivers) | Live CarTrack position, fuel/trip analysis | Partial — static list only | Medium |
| Maintenance | Service/repair records, schedules, attachments | None | **High** |
| Invoices (hidden tab) | Same data surfaced via Tripsheets | Yes (`list_pending_invoices`) | — |
| Tripsheets | 6 creation modes, PDF, Google Maps optimisation, Welly AI grouping | None directly (only visible indirectly once activated into a Load) | **High** |
| Completed / reconciliation | Delivered loads, sales-vs-delivered | Partial (`sales_history_summary` only) | Medium |
| POD Documents | Upload/view/download, invoice-number matching | Partial — metadata only, no file access, no outstanding-POD view | **High** |
| Fuel History | TFN/Puma sync, efficiency, monthly reports | None | Medium |
| Requisitions / Petty Cash | Driver payouts, diesel, sleep-outs | None | Low — sensitive financial data, see Security |
| Controller / Security Monitoring | Night-watch, geofences, live cameras | None | **Do not add** — see Security |
| Reports | Delivery performance, POD report, fuel consumption, driver performance, route efficiency, daily dispatch, incidents | None | **High** — cheapest, highest-value additions, since the KPIs are already computed |
| Asset Tracking (scan) | Barcode/QR resolve, manifest | None | Low |
| Open Map | Live fleet map | None — out of scope, visual/live rather than a lookup | Low |

---

## Data-Source Strategy: Direct SQL vs. Existing API Endpoints

**Option A — keep the direct-SQL pattern.** Simple, matches what's already built, no dependency on the backend API's uptime beyond the database itself. *Risk:* it re-derives business logic (an "on-time" definition, an "outstanding POD" threshold) that already lives in `ReportsController` and `PodDocumentsController`, and that logic can drift out of sync as the app evolves independently of the connector.

**Option B — proxy new tools through the existing authenticated GET endpoints** (e.g. `GET /api/logistics/reports/delivery-performance`, `GET /api/poddocuments/summary`) using a dedicated read-only service account. This guarantees the connector's numbers always match what staff see in-app, and keeps KPI maintenance in the one place it already happens. *Cost:* an extra network hop, a dependency on backend API availability and auth, and the route surface is inconsistently namespaced (`api/logistics/...`, `api/fleet`, `api/tracking`, `api/poddocuments`, `api/fuelhistory`, `api/invoices`), so each new tool needs to be checked individually.

**Recommendation — hybrid, decided per tool:**

- **Simple entity lookups** (tripsheet detail, maintenance records, driver licence expiry) — keep as direct parameterised SQL against a view. Cheap, matches the existing pattern.
- **Anything that reproduces a computed KPI** already exposed by Reports or PodDocuments (delivery performance %, POD report, fuel consumption, route efficiency, outstanding-POD ageing) — call the existing endpoint instead of re-deriving it, so there is one source of truth for the number.

---

## Recommended New Tools

### Phase 1 — quick wins (safe, high value, low effort)

> ✅ **Delivered 17 Sep 2026** (v1.1): `driver_licence_expiry`, `list_maintenance`, `outstanding_pods`,
> `list_tripsheets` + `get_tripsheet`, plus a `/health/db` probe. Implemented as direct parameterised
> SQL (views deferred to the security-hardening phase). The optional `get_tripsheet_pdf_link` was
> **not** built (needs the authenticated API proxy + service account).

| Tool | Purpose | Source | Key parameters |
|------|---------|--------|----------------|
| `get_tripsheet` / `list_tripsheets` | Tripsheet detail incl. stops, status, linked load | TripSheet + Loads tables (or `GET /api/logistics/tripsheet`) | tripsheet id, or date range |
| `list_maintenance` | Service/repair records, upcoming or overdue | Maintenance table (or `GET /api/logistics/maintenance/upcoming`) | vehicle id, status |
| `driver_licence_expiry` | Drivers whose licences expire within N days | Drivers table | days ahead |
| `outstanding_pods` | PODs not captured 24h/48h after delivery, by driver | PodDocuments vs. load delivery date (or filtered `GET /api/poddocuments/summary`) | threshold in hours |
| `get_tripsheet_pdf_link` (optional) | A temporary link to the tripsheet PDF, not the file bytes | proxy to `GET /api/logistics/tripsheet/{id}/pdf` | tripsheet id |

### Phase 2 — analytics layer (medium effort; proxy to Reports where possible)

| Tool | Purpose | Source |
|------|---------|--------|
| `delivery_performance_summary` | On-time %, short/failed rates, top failure reasons | `GET /api/logistics/reports/delivery-performance` |
| `fuel_efficiency_summary` | Per-vehicle consumption and outliers | `GET /api/fuelhistory/monthly-report` or `.../tfn/fuel-efficiency` |
| `route_efficiency_summary` | Route/capacity utilisation, optimisation adoption | `GET /api/logistics/reports/route-efficiency` |
| `debtors_unbilled` | Proven (POD-linked) deliveries not yet invoiced, days POD→invoice | PodDocuments ⋈ Invoices, or a new dedicated report endpoint |
| `stock_on_hand_summary` | SOH by warehouse, stock-count variances | Warehouses / Inventory tables |
| `daily_ops_briefing` | Composed: loads dispatched, on-time %, outstanding PODs, top failures for a given day | Aggregates several tools above |

### Phase 3 — investigation and cross-reference (higher effort, high value for support/finance)

| Tool | Purpose | Source |
|------|---------|--------|
| `get_delivery_dispute_bundle` | Given a load or invoice number, return the load, POD, invoice and customer stop together | Loads + PodDocuments + ImportedInvoices + Customers |
| `reconciliation_view` | Unifies sales-vs-delivered, part-delivered and POD status per load | SalesHistory + PartDelivered + PodDocuments |
| `depot_performance_investigate` | Loads, drivers, PODs and sales joined for one warehouse and date range, to answer "why is depot X behind" | Multiple tables |

### Phase 4 — write actions (deliberate, later, out of scope for this round)

Draft/suggest tripsheet groupings (mirroring the existing Welly Suggests logic), flag an invoice for priority delivery, create a maintenance note. Add these one at a time, through the authenticated API rather than raw SQL so existing permission checks and audit logging apply, each with explicit business sign-off before it goes live.

---

## Security & Access Control

The fuller architecture map exposes data classes the current connector never touches — financial data in Requisitions/petty cash, driver PII, and live camera/geofence feeds in Controller monitoring. Recommendations:

- **Do not expose Controller / Security Monitoring through this connector at all.** Night-watch positions, geofences and camera livestreams are a different risk class from read-only operational lookups; a leaked or over-shared token would expose live surveillance data. If a genuine use case emerges, build a separate, tightly-scoped connector with its own password and audience.
- **Role-scoped tool sets,** as the original connector roadmap already proposed: separate passwords/tokens exposing different tool subsets — a Finance token for `debtors_unbilled`, requisitions summaries and sales history; a Dispatch token for loads, tripsheets, fleet and maintenance; a general ops token for the current 8 tools plus the Phase 1 additions. Avoids granting everything to everyone on day one.
- **Audit logging of every tool call** — who authenticated, which tool, what filters, when — stored separately from `ProjectTrackerDB` so the trail survives even after a token is revoked for misuse.
- **Shorter token lifetime for higher-sensitivity scopes.** Keep 8-hour tokens for general ops; consider a shorter window for a Finance-scoped token.
- **Least-privilege database access.** Replace ad hoc SELECTs against base tables with a dedicated read-only SQL login granted SELECT only on a set of purpose-built views (see Data Modelling). That makes a database-level permission review possible without reading `tools.ts`.
- **Per-token rate limiting,** to protect the production database from an accidental tight polling loop.

---

## Data Modelling & Query Recommendations

- **One SQL view per new tool** — `vw_mcp_outstanding_pods`, `vw_mcp_tripsheet_detail`, `vw_mcp_driver_licence_expiry`, and so on — rather than embedding multi-table joins directly in `tools.ts`. The database grant becomes SELECT on the view alone, and the view's definition is a single place to check against the app's own logic.
- **Cross-check every KPI-shaped view against its controller** at implementation time, and again whenever that controller changes. The threshold for "outstanding," the definition of "on-time," and what counts as "unbilled" all already exist in `PodDocumentsController`, `ReportsController` and `PartDeliveredController` — without this check, the connector's numbers will silently diverge from what staff see in the dashboard.
- **Match date and time-zone boundaries to the app.** "Delivered yesterday" should use the same day boundary the Reports controller uses, not a default UTC midnight.
- **Document any tool that proxies the API** instead of using a view, directly in `tools.ts`, so a future maintainer understands why that one tool breaks from the SQL pattern.

---

## Phased Implementation Plan

| Phase | Scope | Rough effort | Depends on |
|-------|-------|--------------|------------|
| Security hardening | Role-scoped tokens, audit logging, view-only DB login | Parallel to Phase 1 | Should land alongside Phase 1, not after |
| 1 | Tripsheet detail, maintenance, licence expiry, outstanding PODs | 1–2 weeks | New SQL views; no API changes |
| 2 | Delivery performance, fuel efficiency, route efficiency, debtors, stock-on-hand, daily briefing | 2–4 weeks | Per-tool decision (view vs. API proxy); a read-only service account for API calls |
| 3 | Dispute bundle, reconciliation view, depot investigation | 2–3 weeks | Phase 1 and 2 tools as building blocks; more complex joins |
| 4 (later, optional) | Scoped write actions | Not yet scheduled | Explicit business sign-off per action |

---

## Testing & Rollout

- **Automated contract tests for each new tool** — assert schema and a known-good row for a fixed test load, vehicle and driver. This matches the architecture review's own housekeeping recommendation to test the top endpoints the dashboard depends on.
- **A second hostname and tunnel** (e.g. `logistics-mcp-staging.axtificial.uk`) with its own password, so new tools can be verified against real data before they're added to the production connector's tool list.
- **A short changelog of tool additions and changes** in the connector's README. Claude clients cache a connector's tool schemas per session, so a silent change in what a tool means (not just its name) can confuse a session that connected before the change; a version note helps anyone debugging a mismatch.
- **Extend the health check.** Keep `/health` returning `{"status":"ok"}`, and add a lightweight `/health/db` check confirming the SQL pool can reach `ProjectTrackerDB`, so a broken database connection is visible before Claude reports a confusing tool error.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| A new tool's numbers disagree with the in-app dashboard | Cross-check view SQL against controller logic at build time; prefer proxying to existing Reports endpoints for KPIs |
| Expanded scope increases the blast radius of a leaked token | Role-scoped tokens/passwords per audience; least-privilege DB views; shorter lifetime for sensitive scopes |
| Camera/geofence data exposed via a general-purpose AI connector | Exclude Controller / Security Monitoring entirely from this connector |
| Raw SQL joins duplicate business logic and drift over time | One view per tool, plus a periodic cross-check against the controller code |
| Production database load from an unbounded polling client | Per-token rate limiting |
| A tool schema change silently breaks a connected session's assumptions | Changelog, plus a staging tunnel for verification before promoting |
| Requisitions/petty-cash data treated too casually given it's financial | Its own access tier (Finance-only token), never bundled into the general ops tool set |

---

*Related: [CLAUDE_LOGISTICS_CONNECTOR.md](CLAUDE_LOGISTICS_CONNECTOR.md) (what's live today), [LOGISTICS_MODULE_ARCHITECTURE.md](LOGISTICS_MODULE_ARCHITECTURE.md) (full module surface), [LOGISTICS_SOP.md](LOGISTICS_SOP.md) (operational process).*
