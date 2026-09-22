# Logistics Module — Architecture, Page/Tab & API Connectivity Map

**Document owner:** Development / IT
**Last updated:** 16 September 2026
**Applies to:** INtranet Logistics module (Rocket Freight fleet, tripsheet, POD, fuel & delivery operations)

---

## 1. Purpose

This document explains, in one place, **how the Logistics module is wired together**:

- every page and every dashboard tab the user sees,
- the backend API each page/tab talks to,
- how the pieces link to each other and to shared data (invoices, customers, loads, vehicles),
- the external systems the module depends on,
- and **recommendations** for hardening, performance and maintainability.

It is intended for developers onboarding to the module, and for a technical review of data flow and integration risk.

---

## 2. High-level architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          ANGULAR FRONTEND                              │
│                                                                        │
│  /logistics            → LogisticsDashboardComponent (mat-tab-group)   │
│  /logistics/scan       → AssetTrackingComponent (barcode / QR)         │
│  /logistics/open-map   → OpenMapPageComponent (live fleet map)         │
│                                                                        │
│  Sub-components embedded in the dashboard:                             │
│    <app-controller-monitoring>  (Controller / night-watch tab)         │
│    <app-logistics-reports>      (Reports tab)                          │
│    dialogs: drivers, vehicles, puma-garage, open-map, reports          │
│                                                                        │
│  Shared service: AssetTrackingService (barcode/invoice/load resolver)  │
└───────────────┬──────────────────────────────────────────────────────┘
                │  HTTPS  (environment.apiUrl = /api, proxied by nginx)
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     ASP.NET CORE (.NET 10) BACKEND                     │
│                                                                        │
│  ~29 Logistics controllers under Backend/Controllers/Logistics/       │
│  EF Core → SQL Server (ProjectTrackerDB, Docker container)            │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                ▼  External integrations
   ┌───────────────┬──────────────┬───────────────┬────────────────────┐
   │  CarTrack     │  TFN / Puma  │  Google Maps  │  Welly AI (Gemini) │
   │  (GPS/vision) │  (fuel data) │ (geocode/route)│ (excel/address AI) │
   └───────────────┴──────────────┴───────────────┴────────────────────┘
```

**Key facts**

- The frontend uses `environment.apiUrl = '/api'`; nginx proxies `/api` to the backend container.
- There is **no single "logistics service"** on the frontend — the dashboard component calls the controllers directly via `HttpClient`. The only shared service is `AssetTrackingService` (used by the scanner and the Paperless module).
- All logistics controllers are `[Authorize]`; the `logistics` permission gates access to the module in the navigation.
- The main dashboard (`logistics-dashboard.component.ts`) is a **single very large component (~34,700 lines)** hosting a `mat-tab-group` plus many inline dialogs.

---

## 3. Pages & routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/logistics` | `LogisticsDashboardComponent` | Main operations console (all tabs below) |
| `/logistics/scan` | `AssetTrackingComponent` | Barcode / QR scanning → resolve invoice, load, product, vehicle |
| `/logistics/open-map` | `OpenMapPageComponent` | Full-screen live fleet map |

Routes are registered in [Frontend/src/app/core/modules.config.ts](Frontend/src/app/core/modules.config.ts).

---

## 4. Dashboard tabs → API connectivity

The dashboard is a `mat-tab-group`. Tabs below are listed in display order. "Primary APIs" are the controllers/endpoints each tab reads/writes.

### 4.1 Active Loads
- **What it shows:** Loads currently pending / assigned / in-transit, with driver, vehicle, stops and live status.
- **Primary APIs:**
  - `GET /api/logistics/loads` (list, filter by status)
  - `GET /api/logistics/loads/{id}` (detail + stops)
  - `PUT /api/logistics/loads/{id}/status`, `/assign`, `/reassign`
  - `GET /api/tracking/active-loads`, `GET /api/tracking/load/{loadId}/track` (live GPS)
  - `POST /api/logistics/loads/{loadId}/pod` (capture POD)
- **Links to:** Tripsheets (a tripsheet *is* a load), Fleet (vehicle/driver), POD Documents, Controller (live routes).

### 4.2 Fleet
- **What it shows:** Vehicles + drivers, live position, status (Available / In Use / Maintenance), fuel/trip analysis.
- **Primary APIs:**
  - `GET /api/fleet/vehicles`, `GET /api/fleet/vehicles/live`
  - `GET /api/fleet/drivers`, `POST/PUT/DELETE /api/fleet/drivers/{id}`
  - `POST /api/fleet/vehicles`, `PUT /api/fleet/vehicles/{id}`, `.../link-cartrack`, `.../unlink-cartrack`
  - `POST /api/fleet/sync/cartrack`, `POST /api/fleet/sync-from-cartrack` (import vehicles from CarTrack)
  - `GET /api/fleet/vehicles/{registration}/fuel-analysis`, `.../trip-history`, `.../km-summary`
- **External:** CarTrack (position, vision cameras, movement history).
- **Links to:** Maintenance (per vehicle), Fuel History, Active Loads.

### 4.3 Maintenance
- **What it shows:** Service/repair records per vehicle, upcoming/overdue schedules, attachments.
- **Primary APIs:**
  - `GET /api/logistics/maintenance`, `GET .../{id}`, `GET .../upcoming`
  - `POST /api/logistics/maintenance`, `PUT .../{id}`, `POST .../{id}/complete`
  - `GET/POST/DELETE /api/logistics/maintenance-attachments/...` (invoice/quote docs)
- **Links to:** Fleet (vehicle), Requisitions (payment for repairs).

### 4.4 Invoices *(hidden in UI, code preserved)*
- **What it shows:** Imported sales invoices used to build tripsheets. Hidden behind `*ngIf="false"` — the data is surfaced through Tripsheets instead.
- **Primary APIs:** `GET /api/logistics/importedinvoices`, `.../summary`, `.../priority-dashboard`.

### 4.5 Tripsheets
- **What it shows:** Creation and management of tripsheets (delivery runs). Six creation modes via the chooser:
  1. **Import** – parse an Excel tripsheet (`POST /api/logistics/tripsheet/preview-import` → `/import`)
  2. **Pad Tripsheet** – import as-is, no DB matching (`preview-import?skipMatching=true`)
  3. **Manual** – build a load from scratch
  4. **Transfer** – internal stock transfer between warehouses
  5. **Welly (AI)** – `POST /api/logistics/tripsheet/welly-analyze-excel` → `/welly-create-tripsheet`
  6. **Welly Suggests** – `GET /api/logistics/importedinvoices/welly-suggest-tripsheets`
- **Primary APIs:**
  - `GET /api/logistics/tripsheet` (list), `GET .../{loadId}`, `GET .../{loadId}/pdf`
  - `POST /api/logistics/tripsheet/create-from-invoices`
  - `PUT .../{tripSheetId}/assign`, `POST .../{tripSheetId}/activate`, `PUT .../{tripSheetId}/status`
  - `GET .../pending-invoices`, `POST .../{loadId}/email`, `.../email-warehouse-manager`
  - Route optimization: `POST /api/logistics/googlemaps/optimize-load/{loadId}`, `.../optimize-invoices`, `GET .../suggest-optimized-loads`
- **External:** Google Maps (geocoding, distance matrix, route optimization), Welly AI (Gemini), iText (PDF), QRCoder (QR on the sheet).
- **Links to:** Imported Invoices (source rows), Customers (delivery addresses), Fleet (driver/vehicle), Active Loads (once activated), POD.

### 4.6 Completed
- **What it shows:** Delivered / closed loads and their reconciliation.
- **Primary APIs:** `GET /api/logistics/loads?status=Delivered`, `GET /api/logistics/saleshistory/reconcile`, `GET /api/logistics/part-delivered/...`.
- **Links to:** POD Documents, Sales History reconciliation.

### 4.7 POD Documents
- **What it shows:** Proof-of-delivery documents — upload, scan storage, link to loads/invoices, chase outstanding PODs.
- **Primary APIs:**
  - `GET /api/poddocuments`, `GET .../summary`, `GET .../drivers`
  - `POST .../upload`, `.../upload-with-invoices`, `.../scan-storage`, `.../bulk-import`
  - `PUT .../{id}/link`, `.../link-invoices`, `.../delink`, `POST .../match-invoice-numbers`
  - `GET .../{id}/view`, `GET .../{id}/download`
- **Links to:** Loads, Imported Invoices (invoice-number matching), Reports (POD report).

### 4.8 Fuel History
- **What it shows:** Fuel transactions per vehicle/period, efficiency, monthly reports; imported from TFN/Puma.
- **Primary APIs:**
  - `GET /api/fuelhistory/transactions`, `.../vehicle/{vehicleId}`, `.../monthly-report`, `.../periods`, `.../by-assignment`
  - `POST /api/fuelhistory/import`, `POST /api/fuelhistory/sync-from-tfn`
  - TFN: `GET /api/logistics/tfn/transactions`, `.../fuel-efficiency`, `.../balances`, `.../orders`, `POST .../sync/transactions`
  - Puma orders: `GET/POST /api/logistics/pumagarageorders`, `.../import`
- **External:** TFN / Puma fuel network.
- **Links to:** Fleet (vehicle assignment), Requisitions (diesel portion), Reports (fuel consumption).

### 4.9 Requisitions / Petty Cash
- **What it shows:** E-wallet / petty-cash requisitions (driver payouts, diesel), by period, with finance status.
- **Primary APIs:** `GET /api/logistics/requisitions`, `.../periods`, `.../summary`; `POST`, `PUT/{id}`, `DELETE/{id}`.
- **Related:** Sleep-outs `GET/POST /api/logistics/sleepouts`, `.../{id}/approve`, `.../{id}/mark-paid`, `.../{id}/pdf`.
- **Links to:** Finance module (payment workflow), Maintenance/Fuel (reasons).

### 4.10 Controller (Security Monitoring) — `<app-controller-monitoring>`
- **What it shows:** Night-watch console — live vehicle positions, geofences, movement history, camera livestream.
- **Primary APIs:**
  - `GET /api/logistics/controller/night-watch`, `.../movement-history`, `.../active-load-routes`
  - `GET/POST/PUT/DELETE /api/logistics/controller/geofences`
  - `GET /api/logistics/controller/cameras/vehicles`, `POST .../cameras/livestream/{registration}`
- **External:** CarTrack (positions + Vision cameras).
- **Links to:** Fleet, Active Loads (route overlay).

### 4.11 Reports — `<app-logistics-reports>`
- **What it shows:** Operational reports & daily security incident log.
- **Primary APIs:**
  - `GET /api/logistics/reports/delivery-performance`, `.../pod-report`, `.../fuel-consumption`, `.../driver-performance`, `.../route-efficiency`
  - `GET /api/logistics/reports/daily-dispatch` (+ `/export`)
  - `GET /api/logistics/reports/incidents` (+ `/dates`, `/export`)
- **Links to:** Almost every other tab (aggregates their data).

### 4.12 Standalone: Asset Tracking (`/logistics/scan`)
- **What it shows:** Scan a barcode/QR to resolve an invoice, load, product or vehicle; log scans against a load manifest.
- **Primary APIs:**
  - `GET /api/logistics/assettag/resolve/{code}`, `GET .../manifest/{loadId}`, `.../manifest/by-code/{code}`
  - `POST /api/logistics/assettag/scan`, `GET .../scans`, `GET .../load/{loadId}`
- **Shared service:** `AssetTrackingService`.

### 4.13 Standalone: Open Map (`/logistics/open-map`)
- **What it shows:** Full-screen live fleet map.
- **Primary APIs:** `GET /api/fleet/vehicles/live`, `GET /api/tracking/fleet-status`, `GET /api/logistics/customers/map-points`.
- **External:** Google Maps JS + CarTrack positions.

---

## 5. Backend controller reference (routes)

| Controller | Route base | Responsibility |
|------------|-----------|----------------|
| `LoadsController` | `api/logistics/loads` | Loads, stops, assignment, POD capture, stop-address fixing |
| `TripSheetController` | `api/logistics/tripsheet` | Tripsheet build/import, PDF, email, Welly AI |
| `ImportedInvoicesController` | `api/logistics/importedinvoices` | Imported sales invoices, priorities, suggestions |
| `DeliveryRequestsController` | `api/logistics/delivery-requests` | Sales-raised delivery requests |
| `PartDeliveredController` | `api/logistics/part-delivered` | Partial-delivery tracking |
| `SalesHistoryController` | `api/logistics/saleshistory` | Sales vs delivered reconciliation |
| `CustomersController` | `api/logistics/customers` | Customers, delivery addresses, geocoding, AI fixes |
| `DriversController` | `api/logistics/drivers` | Drivers + stats |
| `FleetController` | `api/fleet` | Vehicles, drivers, CarTrack sync, fuel/trip analysis |
| `TrackingController` | `api/tracking` | Live fleet status, per-vehicle/per-load tracking |
| `CarTrackController` | `api/cartrack` | CarTrack unlinked vehicles |
| `ControllerMonitoringController` | `api/logistics/controller` | Night-watch, geofences, cameras, routes |
| `MaintenanceController` | `api/logistics/maintenance` | Service/repair records |
| `MaintenanceAttachmentsController` | `api/logistics/maintenance-attachments` | Repair invoices/quotes |
| `FuelHistoryController` | `api/fuelhistory` | Fuel transactions, monthly reports, imports |
| `TfnController` | `api/logistics/tfn` | TFN/Puma fuel sync & analytics |
| `PumaGarageOrdersController` | `api/logistics/pumagarageorders` | Puma garage orders import |
| `RequisitionsController` | `api/logistics/requisitions` | Petty-cash / e-wallet requisitions |
| `SleepOutsController` | `api/logistics/sleepouts` | Driver sleep-out allowances |
| `ScrapController` | `api/logistics/scrap` | Scrap/write-off records |
| `PodDocumentsController` | `api/poddocuments` | POD upload/scan/link/match |
| `WarehousesController` | `api/warehouses` | Warehouses, inventory, transfers, backorders, 3D view |
| `InventoryController` | `api/inventory` | Building-level inventory, movements, transfers |
| `StockFulfillmentController` | `api/stock-fulfillment` | Availability, reserve, dispatch |
| `SohImportController` | `api/imports` (soh) | Stock-on-hand imports |
| `AssetTagController` | `api/logistics/assettag` | Barcode/QR resolve, scans, manifest |
| `GoogleMapsController` | `api/logistics/googlemaps` | Geocoding, routing, optimization, AI address fixes |
| `InvoicesController` | `api/invoices` | Freight invoices + payments |
| `ReportsController` | `api/logistics/reports` | Operational + incident reporting |

---

## 6. Data-flow: how everything is linked

The **Load** entity is the hub. The end-to-end chain:

```
Sales invoice (imported)  ──►  ImportedInvoice
        │                          │
        │ (group by warehouse/route, optimise)
        ▼                          ▼
   DeliveryRequest ───────►  Load / TripSheet ───► assign Driver + Vehicle (Fleet)
                                   │
             ┌─────────────────────┼─────────────────────┐
             ▼                     ▼                     ▼
        Route optimise        Live tracking          POD capture
        (Google Maps)         (CarTrack)             (PodDocuments)
             │                     │                     │
             └─────────────────────┴─────────────────────┘
                                   ▼
                   Sales-vs-Delivered reconciliation (SalesHistory / PartDelivered)
                                   ▼
        Rocket Freight invoicing (Invoices) + Requisitions/Fuel cost allocation
                                   ▼
                     Reports (delivery, POD, fuel, driver, incidents)
```

Cross-links worth noting:

- **Invoice ↔ POD:** PODs are matched to invoices by invoice number (`match-invoice-numbers`), so a delivery can be proven per invoice line.
- **Vehicle ↔ CarTrack:** vehicles are linked to CarTrack units (`link-cartrack`); live position, movement history and vision cameras all key off that link.
- **Vehicle ↔ Fuel:** fuel transactions from TFN/Puma are assigned to vehicles by registration/assignment; the diesel portion can flow to a Requisition.
- **Customer ↔ Address ↔ Stop:** delivery addresses are geocoded once and reused as load stops; AI ("Welly") suggests fixes for bad addresses.

---

## 7. External integrations

| System | Used by | Purpose | Failure impact |
|--------|---------|---------|----------------|
| **CarTrack** | Fleet, Tracking, Controller, Open Map | Live GPS, movement history, Vision cameras | Live map/tracking blank; historical data still available |
| **TFN / Puma** | Fuel History, TFN, Puma orders | Fuel transactions & balances | Fuel data stale until next sync |
| **Google Maps** | Tripsheets, Customers, Open Map, GoogleMaps ctrl | Geocoding, distance matrix, route optimisation | Manual addresses/route ordering still work |
| **Welly AI (Gemini)** | Tripsheets, Customers, GoogleMaps ctrl | Excel analysis, address/invoice fix suggestions, tripsheet grouping | AI helpers unavailable; manual flows unaffected |
| **iText / QRCoder / ClosedXML** | TripSheet PDF/Excel | Generate tripsheet PDFs & QR, parse Excel imports | Import/PDF generation blocked |
| **Email service** | TripSheet, SleepOuts | Send tripsheets / warehouse notices / PDFs | Notifications not sent |

Keys/credentials live in `Backend/appsettings*.json` (Google Maps, CarTrack, TFN). These must **not** be committed with real values.

---

## 8. Observations & risks

1. **Monolithic dashboard component.** `logistics-dashboard.component.ts` is ~34,700 lines and embeds most dialogs and business logic. This hurts build time, testability, lazy-loading and merge-safety.
2. **No shared logistics API service.** HTTP calls are scattered inline through the component, so endpoint changes require hunting across thousands of lines, and there's duplication of headers/error handling.
3. **Inconsistent route conventions.** Some controllers sit under `api/logistics/...`, others under `api/fleet`, `api/tracking`, `api/inventory`, `api/warehouses`, `api/poddocuments`, `api/fuelhistory`, `api/invoices`. This makes the surface harder to reason about and to secure uniformly.
4. **External-dependency coupling.** Live map/tracking degrade hard when CarTrack/Google are unreachable; there is limited visible fallback/caching messaging to the user.
5. **Reconciliation is spread across tabs.** "Sales vs Delivered", PartDelivered, POD matching and SalesHistory all contribute to the same business question but live in different places.
6. **Hidden-but-present code.** The Invoices tab is disabled with `*ngIf="false"` rather than removed, which can confuse future maintainers.

---

## 9. Recommendations

**Frontend structure**
- Extract each tab into its own lazy-loaded child component (e.g. `ActiveLoadsTabComponent`, `FleetTabComponent`, `TripsheetsTabComponent`…). Target: no single component over ~1,500 lines.
- Introduce a `LogisticsApiService` (or feature-specific services: `LoadsService`, `FleetService`, `FuelService`, `PodService`) that own all HTTP calls, headers and error handling. Components should never call `HttpClient` directly.
- Move inline dialogs into their own files.

**API surface**
- Standardise routes under a single `api/logistics/...` prefix (or document the exceptions explicitly). Add a versioned route convention doc (there is already `Backend/ROUTE_CONVENTIONS.md` — extend it for logistics).
- Add consistent pagination + filtering contracts across list endpoints.

**Resilience**
- Cache the last-known CarTrack fleet snapshot and show "last updated X min ago" when live calls fail.
- Wrap Google Maps/Welly calls with graceful fallbacks and user-visible "AI unavailable, continue manually" states (some already exist — make them uniform).
- Add health checks/status badges for CarTrack, TFN and Google in an admin/diagnostics view.

**Data integrity & reconciliation**
- Create one **Reconciliation view** that unifies Sales-vs-Delivered, PartDelivered, POD status and outstanding PODs per load, so controllers/finance have a single source of truth.
- Enforce that a load cannot be marked **Delivered/Closed** until a POD is linked (or an explicit exception reason is captured).

**Performance**
- Lazy-load tab data on first activation (some tabs already do — apply consistently) and virtualize large tables (loads, invoices, fuel transactions).
- Add server-side indexing review for the highest-traffic queries (loads by status, invoices pending, fuel by period).

**Housekeeping**
- Remove the permanently-hidden Invoices tab or gate it behind a feature flag with a comment explaining why.
- Add automated API contract tests for the top 10 endpoints used by the dashboard.

---

## 10. Quick reference — tab → main endpoints

| Tab / Page | Main endpoints |
|------------|----------------|
| Active Loads | `api/logistics/loads`, `api/tracking/active-loads`, `.../loads/{id}/status` |
| Fleet | `api/fleet/vehicles`, `.../vehicles/live`, `.../drivers`, `.../sync-from-cartrack` |
| Maintenance | `api/logistics/maintenance`, `.../maintenance-attachments` |
| Tripsheets | `api/logistics/tripsheet/*`, `api/logistics/importedinvoices/*`, `api/logistics/googlemaps/optimize-*` |
| Completed | `api/logistics/loads?status=Delivered`, `api/logistics/saleshistory/reconcile` |
| POD Documents | `api/poddocuments/*` |
| Fuel History | `api/fuelhistory/*`, `api/logistics/tfn/*`, `api/logistics/pumagarageorders` |
| Requisitions | `api/logistics/requisitions/*`, `api/logistics/sleepouts/*` |
| Controller | `api/logistics/controller/*` |
| Reports | `api/logistics/reports/*` |
| Scan (`/logistics/scan`) | `api/logistics/assettag/*` |
| Open Map (`/logistics/open-map`) | `api/fleet/vehicles/live`, `api/tracking/fleet-status`, `api/logistics/customers/map-points` |

---

*End of document.*
