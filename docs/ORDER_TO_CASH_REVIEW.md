# Order-to-Cash Review: Sales, Stock & Logistics

**Date:** 21 October 2026
**Scope:** How the three modules support the business flow and where the weak links are.

---

## 1. The business flow

```
Order placed
   ↓
Stock checked
   ↓
Order invoiced
   ↓
Trip sheet created
   ↓
Items delivered
   ↓
POD returned
   ↓
Finance collects from institution
```

Each arrow is a hand-off. The review below checks whether each hand-off is actually recorded in the system, using live data from the database.

---

## 2. Health of each link (from live data)

| # | Link | What the data shows | Status |
|---|------|---------------------|--------|
| 1 | **Order placed** | 3,298 back-order lines loaded today (Promed 1,796 · Access 1,161 · Sebenzani 219 · Pharmacare 122). Snapshot only – no history, no ageing. | 🟡 Partial |
| 2 | **Stock check** | 83% of back-order item codes match a product. **1,838 lines worth R 75.9m could be fulfilled from stock on hand today** – but no screen shows this. Pharmacare matches 0% (its item codes are not in the product master). | 🔴 Missing |
| 3 | **Order → Invoice** | Invoices carry no order number. 0 back-order order numbers appear anywhere downstream. | 🔴 No link |
| 4 | **Invoice → Trip sheet** | 1,215 of 1,593 trip-sheet stops (76%) reference a real invoice number. The sign/check/approve trip-sheet workflow exists but has **never been used (0 rows)**. | 🟡 Partial |
| 5 | **Trip sheet → Stock deduction** | Stock ledger has **0 movements**. 1,958 of 2,757 trip-sheet lines are not mapped to a product, so they cannot deduct stock. | 🔴 Not happening |
| 6 | **Delivery → POD** | 873 POD documents, 4,429 invoice links. But **220 of 437 "Delivered" loads have no POD at all**. Partial-delivery and electronic POD tables are empty. | 🟡 Half |
| 7 | **POD → Finance** | **0 payments recorded**. Debtors "outstanding" equals total sales ever, because nothing is ever marked paid. | 🔴 Not started |
| 8 | **Invoice status hygiene** | 16,181 invoices are "Pending" with no load. **13,951 of them are over 90 days old (R 417m)** – almost certainly delivered through the old process. The Pending queue cannot be trusted. | 🔴 Untrusted |

**Data-quality issue found:** ~7,700 invoice rows have a contract code (e.g. RT14003000, NDOH35017) in the *Transaction Type* field instead of IN/CR. The import is mapping the wrong column for some companies.

---

## 3. The core problem

Each module is an **island fed by its own Excel import**:

- Back orders → Sales
- Invoices → Sales / Logistics
- Stock on hand → Stock
- Trip sheets → Logistics
- PODs → Logistics

Nothing carries an identifier from one step to the next. No module can answer *"where is order X right now?"* The modules do not hand off to each other – each one receives a fresh photograph of the ERP and nothing connects the photographs.

---

## 4. Recommendations by module

### 4.1 Sales – turn back orders into an actionable queue

| Recommendation | Why |
|----------------|-----|
| **Add a stock-availability column to every back-order line** showing *Can fulfil / Partial / No stock* and which warehouse holds it. | R 75.9m of back orders can be released against existing stock today and nobody can see it. |
| **Load the Pharmacare product master.** | Pharmacare item codes (e.g. `M-HP0-001`) don't exist in the product table, so 0% of their back orders can be stock-checked. |
| **Add a "Release to invoice" action** that records order number, lines, quantity, warehouse, user and date. | This is the first hand-off in the chain and it is currently not recorded anywhere. |
| **Keep back-order history instead of overwriting it.** | Lets Sales see new / cleared / aged > 30 days between imports. |
| **Surface order cancellation on the back-order line.** | The cancellation workflow exists but is unused (0 rows); dead orders just age. |
| **Fix the invoice import mapping** so Transaction Type = IN/CR and contract code goes into its own field. | Finance and reporting depend on this field. |

### 4.2 Stock – make it the single source of truth for availability

| Recommendation | Why |
|----------------|-----|
| **Mandatory product mapping on invoice / trip-sheet import**, with an "Unmapped products" queue and one-click create/alias. Block dispatch approval while a load has unmapped lines. | 1,958 trip-sheet lines and ~2,450 invoice lines cannot deduct stock because they aren't mapped. |
| **Reserve on invoice, deduct on dispatch.** Add a *Reserved* quantity per stock line. Available = On hand − Reserved. | Stops two salespeople promising the same stock. |
| **Daily dispatch-approval discipline** – KPI showing "Awaiting deduction: N loads, oldest M days". | 170 post-count loads are still un-deducted. |
| **Automatic returns from POD.** When a POD shows a short delivery or rejection, raise a Return movement. | Today this relies on someone remembering to do a manual adjustment. |
| **Re-order signals to Sales/Procurement.** Items below re-order level *and* on back order should be flagged. | Re-order level exists in the data but is never used. |

### 4.3 Logistics – close the loop on every load

| Recommendation | Why |
|----------------|-----|
| **Build loads from invoices, not spreadsheets.** Trip-sheet creation should pick invoices with status *Invoiced & stock approved*, so the link is a proper foreign key, not a typed string. | Only 76% of stops match an invoice; the trip-sheet approval workflow has never been used. |
| **POD mandatory to close a load.** Status should move `Delivered (unconfirmed)` → `POD received` only when every invoice on the load has a linked POD. Add a "Delivered without POD" ageing list. | 220 delivered loads have no POD. This is money that cannot be billed or collected. |
| **Capture partial deliveries** – delivered quantity per line at POD-link time. | Lets Stock book the return and Sales see the residual back order. |
| **Driver POD capture at delivery** (photo + signature on mobile). | Replaces the batch scan-and-OCR process that produces unlinked PODs. |

---

## 5. How the modules should work hand in hand

### 5.1 One order record, one status timeline

Introduce a single **Sales Order Line** record keyed on *Order Number + Item Code*. Every import attaches to it:

| Stage | Module | What gets attached |
|-------|--------|--------------------|
| Back order | Sales | Open quantity |
| Invoice | Sales | Invoice number |
| Trip sheet | Logistics | Load / stop |
| POD | Logistics | POD document |
| Collection | Finance | Payment |

Each module writes its stage; every module can read the whole timeline.

### 5.2 Enforced status lifecycle

```
Backordered → Stock Reserved → Invoiced → On Trip Sheet → Dispatched (stock deducted)
            → Delivered → POD Received → Paid
```

Each transition triggers its side-effect automatically (reserve, deduct, release, mark receivable due).

### 5.3 Finance connects at the end

- Debtors currently equals total sales because 0 payments have ever been recorded.
- *POD received* date should start the payment clock.
- Record payments **per invoice**, not per customer, to get real age analysis and "delivered but unpaid > 60 days" per institution.

### 5.4 One cross-module dashboard

Five numbers that are your weak links – today each is either hidden or zero because the step isn't recorded:

1. Back orders coverable from stock
2. Invoiced but not on a trip sheet
3. Dispatched but stock not deducted
4. Delivered but no POD
5. POD received but unpaid

---

## 6. Suggested order of attack

| Priority | Work item | Effort | Value |
|----------|-----------|--------|-------|
| 1 | Stock-availability column on back orders + unmapped-product queue | Low | High – unlocks R 75.9m of fulfilable orders |
| 2 | POD mandatory to close a load + "Delivered without POD" list | Low | High – 220 loads unbillable |
| 3 | Trip-sheet creation from invoices (FK link) + reserve-on-invoice | Medium | High |
| 4 | Per-invoice collections in Finance; one-off sync to retire 13,951 stale "Pending" invoices | Medium | High |
| 5 | Sales Order Line spine + enforced lifecycle | High | Very high – ties everything together |

---

## Appendix – Key figures used

| Measure | Value |
|---------|-------|
| Back-order lines (today's import) | 3,298 |
| Back-order lines fully coverable from stock | 1,838 (R 75.9m) |
| Back-order item codes matching a product | 83% (Pharmacare 0%) |
| Trip-sheet stops matching an invoice | 1,215 / 1,593 (76%) |
| Trip-sheet lines not mapped to a product | 1,958 / 2,757 |
| Stock ledger movements | 0 |
| Trip-sheet approval workflow usage | 0 |
| Delivered loads | 437 |
| Delivered loads with no POD | 220 |
| POD documents / invoice links | 873 / 4,429 |
| "Pending" invoices with no load | 16,181 |
| …of which > 90 days old | 13,951 (R 417m) |
| Payments recorded in Finance | 0 |
