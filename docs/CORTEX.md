# Cortex — what it is, what's built, what's open

_Last updated: 3 Nov 2026 · branch `stock/ledger-integrity` · commits dcf97f9 → 3854c48 → 54404ab → ea2219a → 83cdb2e → a1433a9 → a35b92c → 449a97f → cf16a15 → (tender hand-off)_

## 1. What Cortex is (one paragraph)

Cortex is the company's knowledge graph, shown as the **Cortex tab inside Flows** (`/flows`). It answers "how does work actually move through this company, who does it, and what do we know about it". Everything on it is one of three kinds:

| Provenance | Meaning | Who can change it |
|---|---|---|
| **derived** | Read from live data (Users, Departments, EmpRegistrations, FlowDefinitions, FlowTasks, KnowledgeBase…). Rebuilt on demand. | Nobody by hand. A rebuild replaces it. |
| **curated** | A person wrote it down (responsibilities, department knowledge, authority limits, workflow notes). Has an owner and a review date. | Owner, their department head, or a Flows designer/admin. Never overwritten by a rebuild. |
| **inferred** | Welly worked it out from patterns and is asking. Nothing is fact until someone confirms. | Anyone allowed to curate the parent node can Confirm or Reject (reject needs a reason). |

**Blank is shown, not hidden.** Every employee has an empty "responsibilities" slot, every department an empty "knowledge" slot, every role an empty "authority limits" slot. 166 of those are blank today — that is the honest state, not a bug.

---

## 2. What was built (in order)

### Step 1 — Storage (commit dcf97f9)
- Tables: `CortexNodeTypes`, `CortexNodes`, `CortexEdges`, `CortexChanges`
  - Migration [Backend/Migrations/20261102180000_AddCortexGraph.cs](../Backend/Migrations/20261102180000_AddCortexGraph.cs) — applied automatically on backend start.
  - Models: [Backend/Models/Cortex/CortexModels.cs](../Backend/Models/Cortex/CortexModels.cs)
- Every node has: key, type, label, parent, provenance, source (which table), owner, permission, review date, status, DataJson.
- Every edge has: from, to, relation, hand-off class (`automatic` / `manual` / `read` / `gap`), code reference, and **measured wait** (dwell avg/median/p90 hours, open queue).
- `CortexChanges` is an append-only log of every create/update/deactivate/curate/accept/reject with who and when.

### Step 2 — The builder (dcf97f9, extended in 3854c48, 54404ab)
[Backend/Services/Cortex/CortexGraphBuilder.cs](../Backend/Services/Cortex/CortexGraphBuilder.cs) · `RebuildAsync()` · ~2–4 s

What it derives, and from where:

| Layer | Nodes | Source |
|---|---|---|
| Core | group, 9 companies, Welly, 4 agents (Analyse/Suggest/Fix/Assistant) | OperatingCompanies, static agent registry |
| Organisation | 16 departments, 138 employees (`emp:` from register, `user:` for accounts not on it), roles | Departments, EmpRegistrations, Users |
| Work | 19 processes → 19 workflows → 187 steps / 6 approvals, linked the way the engine really walks them (next / true / false / approved / rejected) | FlowDefinitions.GraphJson |
| Technology | 13 modules, 7 external sources, 24 coded hand-offs between them | static tables mirroring `cortex-model.ts` + code references |
| Knowledge | 11 KB documents, 5 management reports | KnowledgeBaseDocuments, ManagementController |
| Metrics | dwell + queue on every hand-off into a human step, last 180 days | FlowTasks (created → completed) |
| Gaps | 30 derived gaps (see §4) | computed from the graph |
| Inferred | "X works on Y" when someone completes ≥3 tasks in a process they don't own in another department; Welly findings (see below) | FlowTasks |

Rules the upsert enforces:
- Derived nodes that vanish from the data are **deactivated**, not deleted (history survives).
- Curated nodes are never touched by a rebuild.
- Inferred nodes keep refreshing their evidence while `pending`; once accepted/rejected they freeze.
- A hand-off class set by hand (`HandoffCurated`) survives rebuilds.

### Step 3 — API (dcf97f9)
[Backend/Controllers/CortexController.cs](../Backend/Controllers/CortexController.cs) · `/api/cortex` · all `[Authorize]`

| Call | What | Who |
|---|---|---|
| `GET graph?layers=&root=&asOf=` | whole graph, permission-scoped (a node with a module permission you lack is omitted) | anyone |
| `GET nodes/{key}` | node + children + edges + neighbours + history | anyone with access |
| `GET gaps?status=open` | gaps + overdue reviews, owner, priority | anyone |
| `GET changes?since=&key=` | the change log | anyone |
| `GET search?q=` | find a node | anyone |
| `POST rebuild` | re-derive | designer/admin |
| `PUT nodes/{key}/curate` | write summary / owner / review date → becomes curated | owner, parent-chain owner, designer |
| `POST nodes/{key}/accept` / `reject` | decide an inferred item (reject needs a reason) | same |
| `PUT edges/{id}/handoff` | override a hand-off class by hand (flagged curated) | designer |

### Step 4 — UI (dcf97f9, 3854c48, 54404ab)
Files: `Frontend/src/app/components/flows/flow-cortex.component.{ts,html,scss}`, [flows.service.ts](../Frontend/src/app/services/flows.service.ts)

- **Knowledge strip** under the gauges: From data · Written · Still blank · To confirm · Overdue review · Gaps, plus **Rebuild** (designers).
- **Zoom**: Company (sources + modules) · Departments · **People** (selected department's people fan out on an arc; hover a person to see which modules they can reach; click to open/create their flow).
- **Inspector** on any node: provenance badge, owner, review date, attached knowledge slots with **Write it / Update**, Welly items with **Confirm / Reject**, measured waits per step, gaps on that node.
- **Inline editor** (no browser prompts): text, owner picker, review period 3/6/12 months. Reject form requires a reason.
- **Idle panel**: "Welly thinks · to confirm" queue, then suggestions merged from the static model + server gaps.

### Step 5 — Welly Analyse / Suggest (54404ab)
Three detectors produce a `finding` (evidence) with a `suggestion` child (fix + payload Welly Fix could apply later). Both inferred/pending:
1. **Slow step** — median wait > 16 h, ≥3 samples → add escalation / move to pool.
2. **One person clears every X** — pool step, ≥5 completions, all by one account → write procedure, name backup. (Framed at the step, never as blame.)
3. **Process without an owner** but with runs → name an owner (suggests the department head).

### Step 6 — Hygiene, reminders, nightly rebuild (ea2219a)
- **Departments**: `IsActive` + `MergedIntoDepartmentId` + computed `NameKey` with a filtered unique index. Create/rename rejects a clash (409) and treats "X" and "X Department" as the same name. Delete is a soft-deactivate, refused while users remain. Builder only reads active departments. Migration [20261102200000_DepartmentsSoftDeleteAndUniqueName.cs](../Backend/Migrations/20261102200000_DepartmentsSoftDeleteAndUniqueName.cs).
- **Sales merged** 15 → 30 via [Database/MergeDepartmentsNov2026.sql](../Database/MergeDepartmentsNov2026.sql) (re-points 26 tables, carries manager). **Marketing merged into IT** (3 Nov: 13 and 34 → IT Department 14 — there is no Marketing department; the Campaign & announcement flow now sits under IT). **Finance merged** (3 Nov: 17 → 35, manager Robert Brown carried; 1 user / 9 employees / 8 flows now on "Finance"). All duplicates resolved.
- **Permissions**: users 46 and 84 repaired ([tools/repair_permissions.py](../tools/repair_permissions.py)); `PUT users/{id}` now validates every key (`^[a-z][a-z0-9_.\-]*$`, distinct, trimmed) → 400.
- **Module owner** is derived from permission holders on each rebuild: one non-admin holder → that person; several → "Dept (n of m holders)". Granting a module changes the owner next rebuild.
- **Coverage** ignores disabled processes (gap scan and the Cortex "live" counter).
- [CortexMaintenanceService.cs](../Backend/Services/Cortex/CortexMaintenanceService.cs) (hosted, hourly tick):
  - nightly rebuild after 02:15 local, logged as `CortexChanges` kind `rebuild`;
  - review reminders: curated + owned nodes due within 14 days or overdue get a Flows to-do (Category "Cortex", link to the node), repeated weekly (`reminded`);
  - findings → tasks: every pending finding/inference with an owner becomes a to-do due in 7 days, once (`tasked`). Marking the node reviewed completes the to-do.
- JWT secret moved out of compose into the gitignored `.env` (`JWT_SECRET_KEY`) and rotated; `tools/mint_token.py` removed.

### Step 7 — Welly Fix with before/after
[CortexFixService.cs](../Backend/Services/Cortex/CortexFixService.cs) · `POST /api/cortex/nodes/{suggestionKey}/apply` · button **Let Welly fix it** on a finding (inspector and idle panel).
- `update_step` — edits the step in `FlowDefinitions.GraphJson`: `dueInHours` ≤ 24, `escalateTo` = department manager if none, and `assignTo` = department pool when the finding was "one named person". Version bumped; existing runs keep their own graph copy.
- `set_owner` — sets `OwnerUserId/OwnerName` on the process (suggested head resolved by exact name; otherwise the UI asks you to pick). The map node follows immediately.
- `curate_step` — refused with a message: a person has to write the procedure.
- Receipt on the suggestion node (`data.fix`): who / when / change / **before** (median, p90, avg, queue, samples over 180 d). Status `applied`, provenance curated, parent finding accepted, the to-do completed. `CortexChanges` kinds `applied` and `fixed`.
- **After**: 14 days later the maintenance service measures the same step over tasks created since the change, writes `data.fix.after`, logs `measured`, and sends the owner a to-do with the verdict (better / worse / not enough tasks). Shown under the finding as "Median wait X h → Y h".
- Nothing is applied on a schedule; the person who pressed the button is recorded.

### Step 8 — Logistics → Finance hand-off (PODs)
[PodHandoffService.cs](../Backend/Services/Flows/PodHandoffService.cs) · fire-and-forget, hooked into every place a POD lands: tripsheet POD (`POST loads/{id}/proof-of-delivery`, `POST loads/{id}/pod`), scanned POD (`POST PodDocuments/upload-with-invoices`), later linking (`PUT PodDocuments/{id}/link`, `/link-invoices`).
- Finds every open Flows task that is **waiting on a POD**: `config.awaits = "pod"`, or by convention a human step about PODs that is assigned to or escalates to Logistics (which is how all the debtors' flows and *Accounts · Invoice to payment* are written).
- Writes the POD (invoice numbers, load, POD number, customer, who, when) into the run context (`pods[]`, `lastPod`) + audit line `pod.received`, and notifies the assignees with the invoice numbers.
- If the run is pinned to those invoices (`inputs.invoiceNo`, `invoiceNumbers`, entity `invoice`) and the POD covers them all, the task is **closed automatically** and the run advances. Verified end-to-end: IN146545 → "POD needed for invoice IN146545" closed by Logistics, run moved on.
- Publishes the `pod.received` flow event (listed in the designer) so anyone can trigger a flow on it.
- Cortex: `logistics → finance` now has two edges (requisitions manual, PODs automatic); hand-off gap closed. Also fixed on the way: `FindLoadIdByInvoiceTextAsync` EF translation error that made `link-invoices` 500 for invoices without a tripsheet; cancelled runs no longer count as process usage; pending Welly items whose evidence disappears are retired on rebuild.

### Step 9 — HR → Finance hand-off (payroll inputs)
[PayrollHandoffService.cs](../Backend/Services/Flows/PayrollHandoffService.cs) · fire-and-forget, hooked into: leave **approved** (`PUT leave-requests/{id}/review`), **new starter** created Active in HR (`POST hr/employees`, imports excluded), **status change** to Terminated / Serving Notice / Suspended / On Leave or a contract end date set (`PUT hr/employees/{id}`).
- Each event raises one **Payroll to-do** (Category `Payroll`, title `Payroll input: …`, deduped with a `[payroll:key]` marker so re-saving the same record doesn't duplicate), due on the **next payroll cut-off**, High priority if the cut-off is ≤ 2 days away. Assignee + notification go to the payroll person.
- Payroll person: SystemSettings `Payroll.UserId` → else the Finance department's manager → else the first active user with the finance/books permission. Cut-off: `Payroll.CutoffDay` (default **20**, 1–28; weekend rolls back to Friday; past → next month).
- [PayrollController.cs](../Backend/Controllers/PayrollController.cs): `GET/PUT api/payroll/settings` (cutoffDay, payrollUserId; PUT = finance module / Admin / HR), `GET api/payroll/inputs` (open payroll to-dos).
- Publishes the `hr.payroll_input` flow event (in the designer list).
- Verified end-to-end: submitted + approved a leave request → to-do "Payroll input: Leave · … · Annual 10 Nov–12 Nov (3 d)" due Fri 20 Nov, assigned to Finance (fallback chain, no `Payroll.UserId` set yet). Test data removed.
- Also fixed on the way: `POST leave-requests` 500'd (`DBNull` passed to `ExecuteSqlRawAsync` has no EF type mapping) — the leave-request form never worked; now uses explicit `SqlParameter`s. Cortex: `hr → finance` hand-off is now Automatic; only `tenders → sales` remains not built.

### Step 10 — Work view (cf16a15)
The map only showed detail when you clicked the right node. **Map | Work** toggle in the bar: Work lays everything out as lists — gaps grouped by kind (expandable, "never ran" collapsed), every module hand-off with how it is carried + code file + measured wait, Welly to-confirm and "Fixed by Welly" with before → after, all blank knowledge slots (department heads first), and the `CortexChanges` feed. Each row jumps back to the node on the map.

**Plain-words layer** (same day): every gap group has a **What does this mean?** button that opens three boxes — *What it is* / *What you do* / *What changes* — and every row carries the button that fixes it: never-run process → **Open** / **Start it now** / **Switch off** (designers; toggles `IsEnabled`, reversible, triggers rebuild); team not captured → **Map their day** (opens the human-flow dialog for that department); duplicate data → **Departments** link. Blank slots have **Write it** directly. Each card opens with a one-paragraph intro saying what it is for.

### Step 11 — Tenders → Sales hand-off
[TenderHandoffService.cs](../Backend/Services/Flows/TenderHandoffService.cs) · fire-and-forget on `PUT Tenders/{id}/status` when status becomes **Awarded** (first time only).
- Starts the Sales process (`SystemSettings Tenders.SalesFlowId`, default: first enabled flow named `Sales…`) with `inputs` pre-filled from the tender: `customer` = issuing department, `customerEmail` / `contactPerson` / `contactPhone`, `enquiry` = tender number, title, awarded value, award date, BOQ lines, award notes; plus a full `tender` object (lines as JSON) for later steps. Run is pinned `entityType=tender`, title "<customer> · tender <no>". One run per tender (cancelled runs don't count).
- Writes a `HandedToSales` tender activity with the run id, notifies the Sales department, publishes `tender.awarded`.
- Verified: awarding W11573 → run FL-000007 "Department of Water and Sanitation · tender W11573", task "Quote for Department of Water and Sanitation" open with Sales. Test reverted.
- Cortex: `tenders → sales` now Automatic. **All three planned hand-offs are built.**

---

## 3. Current numbers (after last rebuild)

663 nodes · 818 edges · 496 derived · 0 curated written · **166 blank slots** · 1 inferred to confirm · **18 gaps** (17 no-events, 1 uncaptured) · hand-offs: 142 manual / 107 automatic / 9 read / **0 not built**.

No Welly findings fire yet — there is almost no task history (flow 5 has 3 approvals, all cleared in 0 h). They will appear as real work passes through Flows.

---

## 4. Issues found (these are real; Cortex surfaced them)

| # | Issue | Where it shows | Needs |
|---|---|---|---|
| 1 | ~~Duplicate departments~~: Sales (→ 30), Marketing / Marketing Department (→ IT 14), Finance Department (→ Finance 35) | — | All merged by 3 Nov. |
| 2 | ~~Two accounts have a corrupted Permissions string~~ | — | Fixed (users 46, 84); save-time validation added; rescan clean. |
| 3 | Training has people but no process (~~Marketing~~ now under IT, which has flows) | gap `uncaptured:*` | Someone in that team maps their day (New human flow). |
| 4 | ~~Nobody non-admin holds HR / Management / Tenders permission~~ | — | Resolved: Duran Govender now holds HR and Tenders; owners derived on rebuild. |
| 5 | ~~Hand-offs not built in code~~ — all three built: finance → logistics (Step 8), hr → finance (Step 9), tenders → sales (Step 11). | — | — |
| 6 | **17** enabled processes have never run: Accounts · Invoice to payment; Colene · Debtors day; Finance · Month-end close; Joulene · Creditors & payments; Mamo · Debtors control day; Mbali · PODs day; Nduduzo · Creditors cycle; Peggy · Debtors day; Sne · PODs & debtors day; HR · Staff request handling; IT · Support request; Logistics · Delivery operations; Marketing · Campaign & announcement; Production · Work order; Reception · Visitors & deliveries; Sales · Enquiry to order; Stock · Goods receiving | gap `noevents:*` | In Cortex → Work → "Process never ran": press **Switch off** on the ones nobody does this way, **Start it now** on the ones that are real. |
| 7 | 166 knowledge slots blank | Knowledge strip | People write. Start with department heads (16 "knowledge" slots) and role authority limits (3). |

---

## 5. What is NOT done yet

| Item | Why it matters | Size |
|---|---|---|
| **Customers / suppliers / products / tenders layers** | Node types exist (commercial layer) but the builder doesn't derive them | medium — **next** |
| Payroll settings UI (cut-off day, payroll person) | API exists (`/api/payroll/settings`); no screen yet — set via API or SystemSettings | S, ~0.5 day |
| **Time replay UI** (`asOf`) | API supports it; no slider on the map | small |

Agreed order: ~~HR → Finance~~ → ~~Tenders → Sales~~ → commercial layers.

---

## 6. How to use it today

1. Open `/flows` → **Cortex** tab. Press **Work** to see everything as lists; **Map** for the picture. Press **Rebuild** (designers) if numbers look stale.
2. Zoom **Departments**, click a department → right panel. Click **Write it** on its knowledge slot and type what the team actually does. Pick an owner and a review period. Save.
3. Zoom **People**, hover people to see their reach; click a dim person to create their flow.
4. Idle panel → **Welly thinks** → Confirm or Reject (with reason).
5. Gaps list = the to-do list for the company's operating model.

## 7. Deploy notes

- Frontend image copies a pre-built `dist`, so always: `cd Frontend; npm run build -- --configuration=production` **then** `docker compose build backend frontend; docker compose up -d --no-build backend frontend`.
- Migration runs automatically on backend start (`Database:MigrateOnStartup`).
- First graph build happens on first `GET /api/cortex/graph` if the table is empty, on `POST /api/cortex/rebuild`, or nightly after 02:15 by the maintenance service.
- `JWT_SECRET_KEY` lives in `.env` (gitignored); rotating it signs everyone out.
