# INtranet Code Audit

**Date:** 8 September 2026
**Scope:** Full stack — .NET 10 backend, Angular 18 frontend, SQL Server, Docker
**Method:** Compile-error scan, mock/placeholder-data search, TODO/FIXME sweep, file-size and obsolete-file analysis, performance red-flag counts.

---

## ✅ The good news first

- **No real compile errors.** The only error flagged is inside `node_modules` (html2canvas's own `tsconfig.json`) — completely benign, ignore it.
- **Backend is clean.** Zero `NotImplementedException`, zero mock-data fallbacks, no stray `TODO`/`HACK` debt. Every "Todo" hit was the **ToDo feature**, not tech debt. The API layer is in good shape.
- **Root folder is tidy.** The loose `.py`/`.json` backfill scripts from earlier are gone. Only docs, compose files, and `start-llm-server.ps1` remain.

---

## 🔴 Critical / high-impact

### 1. `logistics-dashboard.component.ts` is a 1.19 MB, 34,710-line god-component
The single biggest problem in the codebase — larger than the next five files combined. It hurts everywhere:

- Slow to compile, slow to open, slow to change without breaking something.
- Main contributor to a heavy production bundle (slower first load).
- Effectively impossible to unit test.

**Fix:** Split into feature sub-components (fleet, loads, trip-sheets, fuel/TFN, map, incidents) plus a shared logistics service. Multi-session refactor, but pays back massively.

**Largest frontend files (KB):**

| Size | File |
|------|------|
| 1,188 | logistics-dashboard.component.ts |
| 401 | sales-dashboard.component.ts |
| 271 | hba1c-dashboard.component.ts |
| 244 | back-orders-data.ts |
| 191 | stock-management.component.ts |
| 184 | settings.component.ts |
| 178 | people.component.ts |
| 170 | tenders.component.ts |

### 2. Fake / sample data still shipping to users
Three spots silently show **invented data** when the API fails — so a director could be looking at fiction and not know:

- **`loadSampleData()`** — `logistics-dashboard.component.ts` (~L8279): hardcoded loads ("ABC Logistics", "GP 123-456"), fake vehicles, fake stats (12 loads, 15 vehicles).
- **`initializeProjects()`** — `dashboard.component.ts` (~L1138): mock "E-Commerce Platform" projects on API error.
- **SOH placeholder** — `stock-management.component.ts` (~L4704): `// TODO: Replace with a real SOH lookup per warehouse + item.`

**Fix:** Replace these fallbacks with a proper empty/error state ("Couldn't load live data — retry"). Never show fabricated numbers on a management tool.

### 3. `fuelLevel: 50` hardcoded on every vehicle
In `loadVehiclesFromDatabase()` (~L8186) every vehicle is assigned `fuelLevel: 50` regardless of reality. If any UI shows a fuel gauge, it's lying.

**Fix:** Wire it to TFN/CarTrack data, or remove the gauge.

---

## 🟠 Half-finished features ("Coming soon")

Buttons that exist in the UI but do nothing — they read as unfinished to users:

- **Sales dashboard:** "Customer dialog", "Invoice capture dialog", "Import invoices dialog" — all just toast "coming soon" (~L8514, L8576, L8818).
- **Profile:** "Password change" and "Edit profile" — coming soon (~L1010, L1014).
- **Stock:** "Accept & Dispatch" → `alert('Coming soon!')` (~L3987).
- **Board:** "Board editing" and "Board reports" — coming soon (~L1411, L1417).
- **People:** 7× "Coming Soon" panels.

**Recommendation:** For each, either finish it or **hide the button** behind a feature flag. Visible dead buttons are the fastest way to make software feel unfinished.

---

## 🟡 Performance & quality

- **804 `.subscribe()` calls** across the frontend. Manual subscriptions without `takeUntilDestroyed` / `async` pipe are the #1 source of memory leaks in an app this size. Audit the long-lived ones (dashboards, SignalR hubs) for proper unsubscribe.
- **44 legacy `*ngFor` / `*ngIf`** still using the old structural syntax instead of Angular 18's `@for` / `@if`. The new control flow is faster (no `ngForOf` diffing overhead) and you're already on v18. Worth migrating, especially in large lists.
- **32 `console.log` / `console.debug` statements** left in production code (e.g. `books.component.ts` logging full payloads). Strip them or route through the existing `logging.service.ts`.
- **`back-orders-data.ts` is 244 KB** — a static data file bundled into the app. If it's seed/reference data, it should come from the API, not ship in every user's download.

---

## 🗑️ Obsolete / can be deleted

- **`Backend/repair_migrations.sql`** — one-off migration repair, not part of the app. Move to a `/Database` archive or delete.
- **`Database/` folder has 40+ ad-hoc `.sql` scripts** (AddColumn, Backfill, CreateX). Many are already applied via EF migrations. Archive them — they're confusing next to the real migration history and imply the DB isn't fully migration-managed.
- **Dead mock code paths** — the "replaces old mock dashboard" comment in `company-projects.component.ts` suggests removable dead code.

---

## Suggested priority order

| # | Action | Effort | Payoff |
|---|--------|--------|--------|
| 1 | Kill the 3 fake-data fallbacks → real empty states | Low | High (trust) |
| 2 | Hide / flag the "coming soon" buttons | Low | High (polish) |
| 3 | Remove hardcoded `fuelLevel: 50` | Low | Med |
| 4 | Strip console logs + migrate `*ngFor` → `@for` | Low | Med (speed) |
| 5 | Archive stray SQL scripts | Low | Low (tidiness) |
| 6 | Split the 34k-line logistics component | High | Very High |

---

## Recommended next step

Knock out the quick wins (**#1–#4**) in one low-risk pass:

- Convert the fake-data fallbacks to proper empty/error states.
- Hide the dead "coming soon" buttons.
- Fix the hardcoded fuel value.
- Strip the stray console logs.

Tackle the logistics god-component split (**#6**) as its own dedicated session — it's large and delicate.
