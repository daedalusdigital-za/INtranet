# INtranet Logistics — MCP Connector for Claude

A small, **read-only** [Model Context Protocol](https://modelcontextprotocol.io) server that lets your
**Claude (Team)** account read logistics data from the INtranet database — from home, without a VPN.

It talks **directly to the SQL Server** container on the Docker network (read-only, parameterised
queries only) and is published to the internet through a **Cloudflare Tunnel**, so no firewall ports
are opened. Access is protected by OAuth 2.1 + a shared password, so only people who know the
password can connect Claude.

> This is completely separate from **Welly** (the in-app assistant). Welly is untouched.

---

## What Claude can see (tools)

All tools are **read-only**:

| Tool | Description |
|------|-------------|
| `list_pending_invoices` | Imported invoices not yet allocated to a load (filter by company / province) |
| `list_active_loads` | Loads with status, driver, vehicle, schedule |
| `get_load` | Full detail for one load + its invoices |
| `list_warehouses` | Warehouses, capacity, manager contacts |
| `list_drivers` | Drivers, licence details, status |
| `list_vehicles` | Fleet vehicles, status, last known location |
| `sales_history_summary` | Reconciled sales totals by company / month |
| `pod_summary` | Proof-of-delivery metadata incl. file name/type/size |
| `get_pod_file` | The actual POD PDF/image bytes for a POD Id (embedded resource) |
| `driver_licence_expiry` | Drivers whose licence expires within N days (compliance) |
| `list_maintenance` | Vehicle service/repair records; upcoming/overdue filter |
| `outstanding_pods` | Delivered loads with no POD captured after N hours |
| `list_tripsheets` | Sales trip sheets with status/route/schedule |
| `get_tripsheet` | One sales trip sheet + its delivery lines |
| `list_fuel_transactions` | Fuel card/manual draws: litres, amount, depot, by vehicle/month |
| `fuel_efficiency_summary` | Per-vehicle km/l, spend and anomaly counts between dates |
| `list_fuel_orders` | TFN fuel orders: allocated vs used litres/amount, remaining balance |
| `list_vehicle_movements` | CarTrack trips: distance, speed, idle, harsh braking/cornering/accel events |
| `driving_behaviour_summary` | Per-vehicle behaviour score from movement history (harsh events + idle) |
| `list_customers` | Logistics customers: contact + physical/delivery addresses (geocoded) |
| `customer_delivery_addresses` | Saved geocoded delivery addresses per customer |
| `get_customer` | Full bundle for one customer: details + addresses + recent invoices + related loads |
| `delivery_performance_summary` | On-time vs late KPI over a date range (Actual vs Scheduled delivery), optional per-warehouse |
| `route_efficiency_summary` | Estimated vs actual distance/cost, avg utilisation over a date range |
| `stock_on_hand_summary` | Warehouse stock on hand by commodity, reorder levels + below-reorder flag |
| `daily_ops_briefing` | Composed one-day snapshot: loads scheduled/delivered, on-time %, outstanding PODs |

To add or change tools, edit [src/tools.ts](src/tools.ts) and rebuild.

## Health checks

- `GET /health` → `{"status":"ok"}` (process alive)
- `GET /health/db` → `{"status":"ok","database":true}` (SQL pool can reach ProjectTrackerDB)

## Changelog

- **v1.8** (18 Sep 2026) — Full financial + document exposure: invoices now include SalesAmount,
  SalesReturns, CostOfSales, MarginPercent and GrossProfit; sales history adds TotalCost/margin/
  reconciliation; customers expose PaymentTerms, CreditLimit, VAT & registration numbers. Added
  `get_pod_file` returning the actual POD PDF/image bytes (nas-documents mounted read-only into the
  container). 26 tools total.
- **v1.7** (18 Sep 2026) — Phase 2 analytics/KPI tools: `delivery_performance_summary`,
  `route_efficiency_summary`, `stock_on_hand_summary` (new `vw_mcp_stock_on_hand` view) and the
  composed `daily_ops_briefing`. Derived from the same load/POD data the app uses (no separate
  Reports API exists to proxy). 25 tools total. Note: Loads carry no failure-reason field, so
  delivery performance covers on-time/late/pending only.
- **v1.6** (18 Sep 2026) — Added `get_customer` bundle tool (customer + delivery addresses +
  recent invoices matched by name + related loads). Search ranks exact/prefix matches first.
  21 tools total.
- **v1.5** (18 Sep 2026) — Added customer tools: `list_customers` and `customer_delivery_addresses`
  (operational + geocoded address fields; financial credit later exposed in v1.8). 20 tools total.
- **v1.4** (18 Sep 2026) — Added movement/behaviour tools: `list_vehicle_movements` and
  `driving_behaviour_summary` (computed fuel/driver-behaviour score from CarTrack harsh-event
  and idle data). Exposed `FuelType`/`AverageFuelConsumption` on vehicles. 18 tools total.
- **v1.3** (18 Sep 2026) — Added fuel tools: `list_fuel_transactions`, `fuel_efficiency_summary`,
  `list_fuel_orders` (3 new `vw_mcp_*` views). 16 tools total. `fuel_efficiency_summary` falls
  back to `FuelTransactions` (litres/spend) when TFN card data is empty for the period.
- **v1.2** (17 Sep 2026) — Security hardening: connector now connects as a least-privilege
  `mcp_readonly` login with `SELECT` on `dbo.vw_mcp_*` views only (no base-table access).
  All tools repointed to the views. See `Database/CreateMcpReadonlyViews.sql`.
- **v1.1** (17 Sep 2026) — Added Phase 1 tools: `driver_licence_expiry`, `list_maintenance`,
  `outstanding_pods`, `list_tripsheets`, `get_tripsheet`. Added `/health/db` probe.
- **v1.0** — Initial 8 read-only tools + OAuth 2.1 + Cloudflare named tunnel.

> Note: Claude caches a connector's tool schemas per session. After changing what a tool
> returns (not just adding one), reconnect the connector to pick up the new schema.

---

## 1. Configure

```powershell
cd mcp-logistics
copy .env.example .env
```

Edit `.env` (or set these in the root `.env` used by docker-compose):

- `MCP_ACCESS_PASSWORD` — a long random password (people type this once when connecting Claude).
- `MCP_PUBLIC_URL` — the public HTTPS URL from step 3, e.g. `https://logistics-mcp.yourdomain.com`.
- `MCP_TUNNEL_TOKEN` — the Cloudflare Tunnel token from step 3.

(The compose file reads `MCP_ACCESS_PASSWORD`, `MCP_PUBLIC_URL`, `MCP_TUNNEL_TOKEN`.)

---

## 2. Build & run

From the repo root:

```powershell
docker compose build mcp-logistics
docker compose up -d mcp-logistics mcp-cloudflared
```

Check it's healthy:

```powershell
docker compose logs -f mcp-logistics
```

You should see `Logistics MCP server listening on :8080`.

---

## 3. Cloudflare Tunnel (free, no port-forwarding)

### Option A — Quick Tunnel (trycloudflare) — for testing, no account needed

The `mcp-cloudflared` service is configured for a **Quick Tunnel** out of the box.
Just start it and read the random URL from the logs:

```powershell
docker compose up -d mcp-logistics mcp-cloudflared
docker compose logs mcp-cloudflared | Select-String "trycloudflare.com"
```

You'll get a URL like `https://nil-zus-campaign-reduction.trycloudflare.com`.
The server auto-detects this host from the request headers, so **no config is needed** —
leave `MCP_PUBLIC_URL` blank. Use `https://<that-host>/mcp` in Claude (step 4).

> Note: the Quick Tunnel URL **changes every time the tunnel restarts**. Fine for testing;
> for something permanent use Option B.

### Option B — Named Tunnel (stable URL) — for production

You need a free Cloudflare account with a domain.

1. **Zero Trust → Networks → Tunnels → Create a tunnel** (type *Cloudflared*).
2. Copy the **tunnel token**. In [docker-compose.yml](../docker-compose.yml), change the
   `mcp-cloudflared` command back to `tunnel --no-autoupdate run` and add
   `environment: - TUNNEL_TOKEN=${MCP_TUNNEL_TOKEN}`.
3. Add a **Public Hostname**: `logistics-mcp.yourdomain.com` → service `http://mcp-logistics:8080`.
4. Set `MCP_PUBLIC_URL=https://logistics-mcp.yourdomain.com` and `MCP_TUNNEL_TOKEN=...` in `.env`.
5. `docker compose up -d mcp-logistics mcp-cloudflared`.

Verify from anywhere:

```
https://<your-host>/health   ->  {"status":"ok"}
```

---

## 4. Add the connector in Claude (at home)

Custom connectors on **Claude Team** must be enabled by an **Owner/Primary Owner**:

1. In claude.ai: **Settings → Connectors → Add custom connector**.
2. **Name**: `Rocket Freight Logistics`
3. **URL**: `https://<your-host>/mcp`  (the trycloudflare or named-tunnel host + `/mcp`)
4. Save. Claude will open the authorization page — enter your `MCP_ACCESS_PASSWORD`.
5. Back in a chat, enable the connector and ask e.g.
   *"Using the logistics connector, how many pending PMT invoices are there and where are they going?"*

---

## Security notes

- **Read-only**: every query is a `SELECT` with bound parameters. No writes, no DDL.
- **Password-gated OAuth**: Claude gets a bearer token only after someone enters the shared password.
- **No open ports**: traffic reaches the server only via the Cloudflare Tunnel.
- Rotate `MCP_ACCESS_PASSWORD` any time and re-authorize the connector in Claude.
- To grant write actions later, add tools deliberately in [src/tools.ts](src/tools.ts) — none exist today.

---

## Local development

```powershell
cd mcp-logistics
npm install
npm run build
$env:PUBLIC_URL="http://localhost:8080"; $env:ACCESS_PASSWORD="dev"; $env:DB_SERVER="localhost"; $env:DB_PORT="1435"; npm start
```

(`localhost:1435` is the host-mapped SQL port from the root compose file.)
