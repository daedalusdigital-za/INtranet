# Rocket Freight — Logistics Standard Operating Procedures (SOP)

**Company:** Rocket Freight (Logistics Division)
**Document type:** Standard Operating Procedure manual
**Version:** 1.0 (Draft for review)
**Effective date:** __________
**Owner:** Logistics Manager
**Review cycle:** Every 6 months
**System of record:** INtranet Logistics module (`/logistics`)

---

## How to use this manual

This manual contains **four linked SOPs** that follow the full life of a delivery, from making sure a truck is legal and loaded, to getting the money in the bank:

1. **SOP 1 — Fleet Readiness & Compliance**
2. **SOP 2 — Trip Sheet & Dispatch Process**
3. **SOP 3 — Delivery & POD Reconciliation**
4. **SOP 4 — Invoicing, Debtors & Stock Control**

Every SOP states: **purpose, scope, roles, the step-by-step procedure, the exact INtranet screen used, the records kept, and the KPIs measured.** A section of **open questions** to be resolved with management is included at the end.

Roles referenced throughout:

| Role | Responsibility in short |
|------|-------------------------|
| Logistics Manager | Owns the process, approves exceptions, reviews KPIs |
| Controller (Night-watch) | Live monitoring of vehicles & routes |
| Dispatch Clerk | Builds and issues trip sheets |
| Driver | Executes deliveries, captures PODs |
| Warehouse Manager | Confirms stock picked & loaded |
| Fleet/Workshop | Vehicle compliance & maintenance |
| Finance / Debtors Clerk | POD-to-invoice matching, billing, collections |

---

# SOP 1 — Fleet Readiness & Compliance

### 1.1 Purpose
To ensure every vehicle that leaves the yard is **road-legal, safe, tracked and fit for the load**, and that all compliance documents and maintenance are current.

### 1.2 Scope
All Rocket Freight vehicles and drivers, all licence/permit documents, all telematics (CarTrack) units, and all planned & reactive maintenance.

### 1.3 Roles
Fleet/Workshop (primary), Driver, Controller, Logistics Manager.

### 1.4 Procedure

**A. Vehicle master data (do once, keep current)**
1. Every vehicle is captured in **Fleet tab** (`api/fleet/vehicles`) with registration, type, capacity, licence-disc expiry and assigned driver.
2. Each vehicle is **linked to its CarTrack unit** (Fleet → *Link CarTrack*, `api/fleet/vehicles/{id}/link-cartrack`). New units are pulled in with *Sync from CarTrack* (`api/fleet/sync-from-cartrack`).
3. A vehicle with no CarTrack link **may not be dispatched** — it cannot be tracked by the Controller.

**B. Daily pre-trip check (per vehicle, before dispatch)**
4. Driver completes a pre-trip inspection (tyres, lights, brakes, load-securing, fire extinguisher, first-aid).
5. Any defect is logged as a **Maintenance record** (Maintenance tab, `api/logistics/maintenance`) with photos attached (`maintenance-attachments`).
6. Vehicles with an **open safety-critical defect are grounded** until signed off by Workshop.

**C. Compliance monitoring (weekly)**
7. Fleet reviews licence-disc and permit expiries; renewals are actioned **14 days before expiry**.
8. Driver licence / PrDP validity is confirmed in **Drivers** (`api/logistics/drivers`).

**D. Planned & reactive maintenance**
9. Services are scheduled by km/date; *upcoming* services appear on the Maintenance tab.
10. A repair invoice/quote is attached to the maintenance record; payment is raised as a **Requisition** (SOP 4) or supplier invoice.
11. On completion the record is marked **Complete** (`.../{id}/complete`) and the vehicle returns to **Available**.

**E. Fuel discipline**
12. Fuel is drawn on TFN/Puma cards; transactions sync to **Fuel History** (`api/fuelhistory/sync-from-tfn`).
13. Fleet reviews **fuel efficiency per vehicle** (`api/logistics/tfn/fuel-efficiency`) weekly and flags outliers (possible theft/leak).

### 1.5 Records
Vehicle master, CarTrack link status, maintenance records + attachments, licence/permit register, fuel transactions.

### 1.6 KPIs
- % fleet with valid licence disc & CarTrack link (target 100%)
- Overdue services (target 0)
- Fuel efficiency variance vs baseline (flag > 10%)
- Vehicles grounded for defects (trend down)

---

# SOP 2 — Trip Sheet & Dispatch Process

### 2.1 Purpose
To convert confirmed sales orders/invoices into an **optimised, assigned, printed trip sheet**, load the correct stock, and dispatch the vehicle — with a full audit trail.

### 2.2 Scope
From receipt of imported sales invoices / delivery requests through to a vehicle leaving the yard with an active load.

### 2.3 Roles
Dispatch Clerk (primary), Warehouse Manager, Driver, Controller.

### 2.4 Procedure

**A. Gather what must be delivered**
1. Sales invoices are imported into **Imported Invoices** (`api/logistics/importedinvoices/import`). Priorities are calculated (`.../priority-dashboard`).
2. Sales-raised delivery requests appear via `api/logistics/delivery-requests`.

**B. Build the trip sheet** (Tripsheets tab → choose a mode)
3. Choose the appropriate creation mode:
   - **Import Excel** — parse an existing tripsheet (`preview-import` → `import`).
   - **DN Tripsheet** — mixed invoices &amp; delivery notes; invoices are linked where found, the rest imported as-is (`preview-import?skipMatching=true`).
   - **Manual** — build a load stop-by-stop.
   - **Transfer** — internal stock move between warehouses.
   - **Welly (AI)** — AI reads the Excel and drafts the sheet (`welly-analyze-excel` → `welly-create-tripsheet`).
   - **Welly Suggests** — AI groups pending invoices into efficient loads (`welly-suggest-tripsheets`).
4. Confirm each **stop address** is geocoded. Bad addresses are corrected using the address-fix suggestions (`api/logistics/googlemaps` / Welly) and saved back to the customer (`api/logistics/customers/delivery-addresses`).

**C. Optimise the route**
5. Run **route optimisation** (`api/logistics/googlemaps/optimize-load/{loadId}`). Review the suggested stop order; the Dispatch Clerk may override with local knowledge.

**D. Assign resources**
6. Assign **driver + vehicle** (`.../tripsheet/{id}/assign`). The system prevents assigning an unavailable/grounded vehicle.
7. Confirm the vehicle is compliant per **SOP 1** and has capacity for the load.

**E. Pick, load & verify**
8. Warehouse picks stock against the trip sheet; **stock availability** is checked (`api/stock-fulfillment`).
9. Items are **scanned onto the load** at loading (`/logistics/scan`, `api/logistics/assettag/scan`) and verified against the manifest (`.../manifest/{loadId}`).
10. Warehouse Manager confirms the load is complete; a notification can be emailed (`.../email-warehouse-manager`).

**F. Issue & activate**
11. Generate the **trip sheet PDF** (with QR code) (`.../tripsheet/{loadId}/pdf`) and email it to the relevant parties (`.../email`).
12. **Activate** the load (`.../tripsheet/{id}/activate`) — it now appears on **Active Loads** and on the **Controller** live map.

**G. Hand-over to monitoring**
13. The Controller (SOP link) tracks the vehicle live (`api/logistics/controller/night-watch`, `active-load-routes`); geofence/route deviations are actioned per the monitoring SOP.

### 2.5 Records
Imported invoices, trip sheet (PDF + record), route-optimisation result, driver/vehicle assignment, loading scan log, dispatch email trail.

### 2.6 KPIs
- Trip sheets issued vs planned per day
- Route-optimisation adoption %
- Loading accuracy (scanned vs planned items)
- Time from invoice-ready → dispatched
- Vehicle fill / capacity utilisation

---

# SOP 3 — Delivery & POD Reconciliation

### 3.1 Purpose
To confirm every stop is **delivered, proven with a POD, and reconciled** against what was loaded — with clear handling of short/failed/partial deliveries.

### 3.2 Scope
From vehicle departure to every load stop being closed with a POD (or a documented exception).

### 3.3 Roles
Driver (primary), Controller, Dispatch Clerk, Finance/Debtors Clerk.

### 3.4 Procedure

**A. In transit**
1. The Controller monitors live position, route adherence and stops (`api/logistics/controller/*`, cameras `.../cameras/livestream/{reg}`).
2. Deviations, long stops or panic events are logged and escalated.

**B. At each delivery**
3. Driver marks the stop status (`api/logistics/loads/{id}/status`).
4. Driver captures the **POD** — signed delivery note / photo (`api/logistics/loads/{loadId}/pod` or uploaded later to **POD Documents** `api/poddocuments/upload`).
5. For a **short/partial delivery**, the driver records what was actually delivered; this creates a **Part-Delivered** record (`api/logistics/part-delivered`).
6. For a **failed delivery** (customer closed/refused), the reason is captured and the stock is returned to the yard and re-booked.

**C. POD capture & filing (back at base)**
7. Paper PODs are scanned/bulk-imported (`api/poddocuments/scan-storage`, `.../bulk-import`).
8. Each POD is **matched to its invoice number** (`api/poddocuments/match-invoice-numbers`) and **linked to the load/invoice** (`.../link-invoices`).
9. Outstanding PODs are chased using the **POD summary** (`api/poddocuments/summary`, by driver `.../drivers`).

**D. Reconciliation**
10. The team reconciles **loaded vs delivered vs returned** using Completed tab + Sales History (`api/logistics/saleshistory/reconcile`) and Part-Delivered.
11. A load may **only be closed** when every stop is either POD-proven or has a documented exception. *(See open question O3.)*

**E. Incidents**
12. Any accident, theft, damage or security event is logged and appears in **Reports → Incidents** (`api/logistics/reports/incidents`).

### 3.5 Records
Stop statuses, PODs (image + link), part-delivered records, return notes, incident log.

### 3.6 KPIs
- On-time delivery %
- POD capture rate within 24h (target ≥ 98%)
- Outstanding PODs > 48h (target 0)
- Short/failed delivery rate & top reasons
- Incidents per 1,000 deliveries

---

# SOP 4 — Invoicing, Debtors & Stock Control

### 4.1 Purpose
To ensure every proven delivery is **billed accurately and promptly**, debtors are collected, driver/fuel costs are controlled, and stock records stay accurate.

### 4.2 Scope
From POD-confirmed deliveries through freight invoicing, collections, cost requisitions, and stock/inventory reconciliation.

### 4.3 Roles
Finance/Debtors Clerk (primary), Logistics Manager, Warehouse Manager, Dispatch Clerk.

### 4.4 Procedure

**A. Billing (only what is proven)**
1. Freight/delivery invoices are raised only against **POD-proven** deliveries (`api/invoices`), linked back to the load and customer.
2. Part-delivered loads are billed on the **actual delivered quantity** (from SOP 3), not the loaded quantity.
3. Invoice + payment status is tracked on the invoice record.

**B. Debtors / collections**
4. Outstanding invoices are worked from an ageing view; PODs are attached as delivery proof for any query.
5. Disputes are resolved by producing the linked POD (`api/poddocuments/{id}/view`).

**C. Cost control — requisitions, fuel & sleep-outs**
6. Driver payouts, diesel and incidentals are raised as **Requisitions** (`api/logistics/requisitions`) per period; they follow the **Finance approval workflow**.
7. **Sleep-out** allowances are captured, approved and marked paid (`api/logistics/sleepouts/{id}/approve`, `.../mark-paid`, PDF `.../pdf`).
8. **Fuel** costs are reconciled from Fuel History / TFN (SOP 1) and allocated to the correct vehicle/route.

**D. Stock control**
9. Stock-on-hand is imported/updated (`api/imports` SOH) and held in **Warehouses / Inventory** (`api/warehouses`, `api/inventory`).
10. Every dispatch decrements stock via the fulfilment flow (`api/stock-fulfillment`); returns from failed/partial deliveries **increment it back**.
11. **Stock transfers** between warehouses are recorded (Transfer trip-sheet mode / `api/warehouses/stock-transfers`).
12. Periodic **stock counts** reconcile physical vs system; variances are investigated and adjusted (`api/inventory/adjustments`), with scrap/write-offs on `api/logistics/scrap`.

**E. Management reporting**
13. Finance & the Logistics Manager review **Reports** monthly: delivery performance, POD, fuel consumption, driver performance, route efficiency (`api/logistics/reports/*`).

### 4.5 Records
Freight invoices + payment status, debtors ageing, requisitions & sleep-out approvals, fuel reconciliation, SOH imports, stock movements/adjustments, scrap register.

### 4.6 KPIs
- Days from POD → invoice (target ≤ 2)
- Debtor days (DSO)
- Unbilled proven deliveries (target 0)
- Fuel cost per km / per delivery
- Stock count variance % (target < 1%)

---

## Cross-SOP process flow (the whole picture)

```
SOP 1  Fleet ready & compliant ─┐
                                ▼
SOP 2  Invoice → Trip sheet → optimise → assign → load(scan) → dispatch
                                ▼
SOP 3  Track → deliver → capture POD → match to invoice → reconcile
                                ▼
SOP 4  Bill proven deliveries → collect debtors → control cost & stock → report
```

---

## Open questions to resolve with management

These must be confirmed before the SOP is finalised and signed off:

1. **O1 — CarTrack rule:** Is "no CarTrack link = no dispatch" an absolute rule, or are there approved exceptions (e.g. hired vehicles)?
2. **O2 — Loading verification:** Is barcode/QR scanning at loading mandatory for **all** loads, or only above a value/quantity threshold?
3. **O3 — Load closure:** Can a load be closed with an outstanding POD if an exception reason is captured, and who may approve that? What is the maximum POD-outstanding window?
4. **O4 — Partial-delivery billing:** Confirm the rule — always bill delivered quantity, or bill full and credit the shortfall?
5. **O5 — Requisition limits:** What are the approval thresholds/tiers for petty-cash/diesel requisitions before they route to a senior approver?
6. **O6 — Fuel variance action:** At what efficiency variance % do we trigger an investigation, and who owns it?
7. **O7 — Stock count cadence:** Weekly cycle counts vs monthly full count — which, and what variance triggers a formal investigation?
8. **O8 — After-hours monitoring:** Controller coverage hours, escalation contacts, and response SLAs for route deviations/panic events.
9. **O9 — Document retention:** How long are PODs, trip sheets and incident reports retained, and where (NAS path / archive)?
10. **O10 — Roles vs people:** Confirm the named person accountable for each role above at each depot (CPT / GP / KZN).

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Logistics Manager | | | |
| Finance Manager | | | |
| Operations Director | | | |

---

*This SOP maps directly onto the INtranet Logistics module. For the technical page/tab and API detail behind each step, see [docs/LOGISTICS_MODULE_ARCHITECTURE.md](LOGISTICS_MODULE_ARCHITECTURE.md).*
