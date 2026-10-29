# Flows — automated business processes

**Route:** `/flows` · **Permission key:** `flows` (designer) · **API:** `api/flows`

A Flow is a small business process: **Trigger → Process/analyse → Decide → Act → Track**.
Every run has a number (`FL-000123`), a status board card, its own task list and an append-only audit trail.

## Levels

| Level | What it means | Template |
|---|---|---|
| 1 · Manual | A person starts it from the Flows page (with a form); people do the steps | Purchase request approval, New starter onboarding |
| 2 · AI-assisted | Welly reads the data, classifies / prioritises / drafts; people decide | Delivery exception triage |
| 3 · Automated | Triggers itself from an event or a schedule; escalates when nobody acts | Missing POD chaser |

## Triggers

* **manual** – button on the Flows page; declared `inputs` become a form (`inputs.key`).
* **event** – published by the system (`shipment.delivered`, `shipment.delivery_failed`, `shipment.collection_failed`, `shipment.booked`, `shipment.cancelled`, `shipment.status_changed`). Optional `filter` expression. `ShipmentLifecycleService` publishes via `IFlowEventPublisher`.
* **schedule** – every `intervalMinutes` the scheduler polls a **data source** (`shipments_missing_pod`, `shipments_overdue`, `open_shipment_exceptions`, `shipments_unplanned`, `overdue_flow_tasks`) and starts one run per matching record (`dedupeByEntity` prevents duplicates while a run is open).

## Steps

`condition` (branch on expression) · `ai_analyze` (Welly returns structured fields) · `task` · `approval` (approved/rejected branches) · `notify` · `email` · `welly_action` (any `[ACTION:…]` Welly can run) · `set` · `wait` · `end`.

Tasks/approvals can be assigned to a **person, a department pool, a role, role-within-department, the starter, the starter's manager, or a variable**. They mirror onto the assignee's dashboard to-do list, push an in-app notification, and **escalate** (`escalateTo`) when `dueInHours` passes.

## Templating & expressions

* Templates: `{{inputs.amount}}`, `{{entity.waybillNo}}`, `{{ai.summary}}`, `{{steps.approve.comment}}`, `{{run.startedBy}}`, `{{vars.x}}`
* Expressions: `inputs.amount > 20000 && ai.priority == "Urgent"`, `entity.status in ["DELIVERY_FAILED"]`, `exists(entity.loadNumber)`, `contains`, `startsWith`, `!`, `||`

## Code map

* Models: `Backend/Models/Flows/FlowModels.cs` · Migration: `20261029120000_AddFlowTables`
* Engine: `Backend/Services/Flows/FlowEngine.cs` (run loop, step executors, escalation, tick)
* Data sources / events / scheduler: `FlowDataSources.cs`, `FlowEvents.cs` · Templates: `FlowTemplates.cs` (seeded + kept current on startup)
* Expression/template engine: `FlowExpressions.cs`
* API: `Backend/Controllers/FlowsController.cs`
* UI: `Frontend/src/app/components/flows/*` (shell, start dialog, task dialog, run dialog, designer)
* Smoke tests: `tools/flows-smoke.ps1`, `tools/flows-ai-smoke.ps1`
