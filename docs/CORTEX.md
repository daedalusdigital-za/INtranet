# Cortex — what it is, what's built, what's open

_Last updated: 2 Nov 2026 · branch `stock/ledger-integrity` · commits dcf97f9 → 3854c48 → 54404ab → ea2219a_

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
- **Sales merged** 15 → 30 via [Database/MergeDepartmentsNov2026.sql](../Database/MergeDepartmentsNov2026.sql) (re-points 26 tables, carries manager). Finance and Marketing blocks are in the same script, commented, pending decision.
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

---

## 3. Current numbers (after last rebuild)

664 nodes · 818 edges · 497 derived · 0 curated written · **166 blank slots** · 1 inferred to confirm · 27 gaps · hand-offs: 142 manual / 104 automatic / 9 read / 3 not built.

No Welly findings fire yet — there is almost no task history (flow 5 has 3 approvals, all cleared in 0 h). They will appear as real work passes through Flows.

---

## 4. Issues found (these are real; Cortex surfaced them)

| # | Issue | Where it shows | Needs |
|---|---|---|---|
| 1 | **Duplicate departments**: ~~Sales~~ (merged into 30) · Finance / Finance Department · Marketing / Marketing Department | gap `deptdup:*` | **Confirm** merge into the short names — the long records hold most links (Finance Department: 1 user / 7 employees / 8 flows / manager Robert Brown; Marketing Department: 1 flow / manager John Smith). Script ready. |
| 2 | ~~Two accounts have a corrupted Permissions string~~ | — | Fixed (users 46, 84); save-time validation added; rescan clean. |
| 3 | Marketing and Training have people but no process | gap `uncaptured:*` | Someone in those teams maps their day (New human flow). |
| 4 | Nobody non-admin holds HR / Management / Tenders permission | gap `noowner:module:*` | Grant the module to the people who actually do that work. |
| 5 | Three hand-offs not built in code: tenders → sales, finance → logistics (debtors don't wait for POD), hr → finance (leave → payroll) | gap `handoff:*` | Product decisions; each is a feature. |
| 6 | **17** enabled processes have never run: Accounts · Invoice to payment; Colene · Debtors day; Finance · Month-end close; Joulene · Creditors & payments; Mamo · Debtors control day; Mbali · PODs day; Nduduzo · Creditors cycle; Peggy · Debtors day; Sne · PODs & debtors day; HR · Staff request handling; IT · Support request; Logistics · Delivery operations; Marketing · Campaign & announcement; Production · Work order; Reception · Visitors & deliveries; Sales · Enquiry to order; Stock · Goods receiving | gap `noevents:*` | Say which to disable; disabled ones drop out of coverage immediately. |
| 7 | 166 knowledge slots blank | Knowledge strip | People write. Start with department heads (16 "knowledge" slots) and role authority limits (3). |

---

## 5. What is NOT done yet

| Item | Why it matters | Size |
|---|---|---|
| **Finance → Logistics hand-off** (debtors wait for POD) | POD scan / dispatch advances the matching Finance step and notifies the debtors clerk | S–M, ~1 day — **next** |
| **HR → Finance hand-off** (leave / starter / leaver → payroll input with cut-off) | needs the payroll calendar defined | M, ~1.5 days |
| **Tenders → Sales hand-off** (won tender starts Enquiry-to-order pre-filled) | tender lines → sales context mapping | M, ~1.5–2 days |
| **Customers / suppliers / products / tenders layers** | Node types exist (commercial layer) but the builder doesn't derive them | medium |
| **Time replay UI** (`asOf`) | API supports it; no slider on the map | small |
| Finance / Marketing merge (§4 #1) | Blocked on your confirmation | 2 min |

Agreed order: Finance → Logistics → HR → Finance → Tenders → Sales → commercial layers.

---

## 6. How to use it today

1. Open `/flows` → **Cortex** tab. Press **Rebuild** (designers) if numbers look stale.
2. Zoom **Departments**, click a department → right panel. Click **Write it** on its knowledge slot and type what the team actually does. Pick an owner and a review period. Save.
3. Zoom **People**, hover people to see their reach; click a dim person to create their flow.
4. Idle panel → **Welly thinks** → Confirm or Reject (with reason).
5. Gaps list = the to-do list for the company's operating model.

## 7. Deploy notes

- Frontend image copies a pre-built `dist`, so always: `cd Frontend; npm run build -- --configuration=production` **then** `docker compose build backend frontend; docker compose up -d --no-build backend frontend`.
- Migration runs automatically on backend start (`Database:MigrateOnStartup`).
- First graph build happens on first `GET /api/cortex/graph` if the table is empty, on `POST /api/cortex/rebuild`, or nightly after 02:15 by the maintenance service.
- `JWT_SECRET_KEY` lives in `.env` (gitignored); rotating it signs everyone out.
