# Cortex — what it is, what's built, what's open

_Last updated: 2 Nov 2026 · branch `stock/ledger-integrity` · commits dcf97f9 → 3854c48 → 54404ab_

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

---

## 3. Current numbers (after last rebuild)

668 nodes · 815 edges · 501 derived · 0 curated written · **166 blank slots** · 1 inferred to confirm · 30 gaps · hand-offs: 142 manual / 104 automatic / 9 read / 3 not built.

No Welly findings fire yet — there is almost no task history (flow 5 has 3 approvals, all cleared in 0 h). They will appear as real work passes through Flows.

---

## 4. Issues found (these are real; Cortex surfaced them)

| # | Issue | Where it shows | Needs |
|---|---|---|---|
| 1 | **Duplicate departments**: Finance / Finance Department, Sales / Sales Department, Marketing / Marketing Department | gap `deptdup:*` | **Your decision** — which record survives. Then one SQL to re-point Users, EmpRegistrations, FlowDefinitions. |
| 2 | **Two accounts have a corrupted Permissions string** (list saved a second time letter-by-letter, e.g. user 84) | gap `perms:*` | Re-save from Settings → Users, or one SQL fix. |
| 3 | Marketing and Training have people but no process | gap `uncaptured:*` | Someone in those teams maps their day (New human flow). |
| 4 | Nobody non-admin holds HR / Management / Tenders permission | gap `noowner:module:*` | Grant the module to the people who actually do that work. |
| 5 | Three hand-offs not built in code: tenders → sales, finance → logistics (debtors don't wait for POD), hr → finance (leave → payroll) | gap `handoff:*` | Product decisions; each is a feature. |
| 6 | 12 enabled processes have never run | gap `noevents:*` | Either start using them or disable them so coverage is honest. |
| 7 | 166 knowledge slots blank | Knowledge strip | People write. Start with department heads (16 "knowledge" slots) and role authority limits (3). |

Not a Cortex problem but worth knowing: `tools/mint_token.py` mints a 15-minute JWT from the container secret so I could verify the API without your password. Delete it if you prefer.

---

## 5. What is NOT done yet

| Item | Why it matters | Size |
|---|---|---|
| **Welly Fix** — apply an accepted suggestion (update step escalation, set owner) | Today accept only marks it curated; nothing changes in Flows | medium |
| **Customers / suppliers / products / tenders layers** | Node types exist (commercial layer) but the builder doesn't derive them | medium |
| **Time replay UI** (`asOf`) | API supports it; no slider on the map | small |
| **Review reminders** — notify an owner when curated knowledge passes its review date | Overdue is counted and shown; nobody is told | small |
| **Scheduled rebuild** (e.g. nightly) | Currently rebuilds on first load if empty, or on the button | small |
| **Finding/suggestion → Flows task** | A finding should become someone's to-do, not just a card | small |
| Department merge + permissions repair (§4 #1, #2) | Data hygiene; blocked on your choice | small |

Suggested order: §4 #1–2 (you decide, I run SQL) → review reminders → scheduled rebuild → Welly Fix → commercial layers.

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
- First graph build happens on first `GET /api/cortex/graph` if the table is empty, or `POST /api/cortex/rebuild`.
