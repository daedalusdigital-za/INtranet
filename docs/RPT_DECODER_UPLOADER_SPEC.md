# Crystal Report Decoder & Template Uploader — Developer Specification

**Project:** INtranet — Sage Document Reconstruction
**Component:** `RptBridge` (Windows companion tool)
**Audience:** Developer team
**Status:** Draft for build
**Last updated:** 2026-09-29

---

## 1. Why this tool exists

The intranet finance module reconstructs Sage 300 print layouts (Tax Invoices, Delivery
Notes, Quotes) so we can view and generate documents that look identical to Sage — but
served from our own data (`ImportedInvoices`) and rendered by iText7 inside the backend
container.

The problem: **Sage's `.rpt` (Crystal Report) files are a proprietary, compressed binary.**
When we extract strings from an uploaded `.rpt` we get essentially nothing (0 readable
layout strings). Today the only usable input is a **rendered sample PDF** of each report,
which we reverse-engineer by hand.

Crystal Reports can only be decoded by the **Crystal Reports runtime / SDK, which is
Windows-only** and cannot run inside our Linux backend container. Therefore we need a
small **Windows companion tool** that:

1. Opens a `.rpt` on a Windows machine using the Crystal SDK.
2. Extracts the real layout — sections, fields, positions (twips), fonts, lines, boxes,
   images, formulas, database field bindings.
3. Normalises that into a clean **Template Definition JSON** (our own schema, not Crystal's).
4. **Uploads it to the intranet** over HTTPS as an authenticated "information uploader",
   which the backend stores against the correct company + document type and uses to
   auto-generate a high-fidelity HTML template.

The Linux backend keeps doing all live PDF generation with iText7. `RptBridge` is an
**offline/desktop ingestion tool** — it decodes on Windows, then feeds structured data
into the intranet. It is not part of the runtime request path.

> **✅ Validated by spike.** A binary analysis of the real PMT invoice report
> (`20230405 oeinv01.rpt`) confirms this premise and refines it — see
> [§1a Spike findings](#1a-spike-findings-real-pmt-invoice-rpt). Key outcomes: the SDK is
> genuinely mandatory for the **field list**, but the **embedded images are extractable by
> direct binary parsing without the SDK**, and the Sage datasource driver is confirmed.

```
┌────────────────────┐        decode          ┌─────────────────────┐
│  Windows machine   │  .rpt ─────────────▶   │  RptBridge (this)   │
│  (Crystal runtime) │                        │  console / WPF app  │
└────────────────────┘                        └──────────┬──────────┘
                                                          │ HTTPS + JWT
                                                          │ TemplateDefinition JSON
                                                          ▼
                                          ┌───────────────────────────────┐
                                          │  INtranet backend (.NET 10)    │
                                          │  DocumentTemplatesController    │
                                          │  → /app/documents + DB          │
                                          └───────────────────────────────┘
                                                          │
                                                          ▼
                                          Admin → Settings → Document Templates
```

---

## 1a. Spike findings (real PMT invoice `.rpt`)

A pure binary analysis (no Crystal SDK) of the first real report validated the approach and
sharpened three assumptions. Spike scripts persisted at `tools/spike-*.ps1`; extracted
images at `spike-images/`.

### 1a.1 File identity
| Property | Value |
| --- | --- |
| File | `20230405 oeinv01.rpt` (PMT / invoice) |
| Format | OLE2 compound file (`D0 CF 11 E0 A1 B1 1A E1`) |
| Size | 1,392,128 bytes (~1.36 MB) |
| Authored | 2023-04-03 22:32 |
| SHA256 | `F7D118DC1D528723DE4E42513F0F2F78DB0E4F28C79E5CE4C1C4BC37D890719B` |

### 1a.2 Internal structure (60 OLE entries)
- **`Contents` (18,389 B)** — the main report definition (fields, sections, fonts,
  positions). **Binary/compressed — unreadable without the SDK.** This is the single reason
  the Crystal SDK (or `RptToXml`) is mandatory for the field list.
- `SummaryInformation` (441 B) + `ReportInfo` (128 B) — metadata streams.
- `QESession` / `PromptManager` — query engine + parameter-prompt data.
- **9 subreports** — `Subdocument 2, 3, 5, 6, 7, 8, 9, 13, 14`. The decoder must walk
  subreports (`ReportDocument.Subreports`) — not just the main report.
- **4 embedded images** (2 unique × 2 copies) as OLE `Embedding` objects.

### 1a.3 Text mining is a dead end (SDK mandatory)
57 Unicode strings, **0 usable field names, 0 fonts, 0 real formulas**. The only meaningful
literals were: `Picture (Device Independent Bitmap)`, `StaticDib` (image markers),
`u2lcapw.dll` (datasource driver), `pwFormatDate` (a date formula). Everything else is
compressed. → confirms §1/§4: the SDK is required for the field/section/font list.

### 1a.4 Images extracted directly (no SDK)
| Asset | Dimensions | Format | Content |
| --- | --- | --- | --- |
| Logo | 340×189 | 32bpp DIB | PROMED Technologies logo |
| Banner | 456×202 | 32bpp DIB | Product brands (PROCARE, Pro-TECT, SurgiPRO, ProSoft, ExamPRO, ProWipe) |

Pulled straight from the binary by parsing DIB headers → drives the raw-DIB extractor in
§5.5. (Note: the 456×202 embedded banner differs from the 2371×482 banner previously lifted
from the rendered PDF — the embedded original is lower-res; decide per-asset which source
gives the better print result.)

### 1a.5 Brand palette (for template fidelity)
- PROMED logo: primary blue `#0090D8`, dark navy `#001830`, white.
- Banner: `#1890D8`, `#303090`, `#F00090`, `#30A8D8`, `#F01860`, `#601860`.
- Background ~70% white/transparent.

### 1a.6 Datasource confirmed
`u2lcapw.dll` = the Crystal → **Sage 300 / ACCPAC native** connection; at least one date
formula (`pwFormatDate`). Confirms these reports bind directly to Sage tables — the field
names the SDK yields will be Sage/ACCPAC schema names, which §6.1's `field-map.json` maps to
our merge tokens.

### 1a.7 Go/no-go signal
⚠️ The **field list still requires SAP CR for VS on a Windows box** (the `Contents` stream is
opaque). But everything else — images, structure, datasource, palette — is obtainable now.
**Next steps this unlocks:**
- **A.** Promote the spike DIB extractor into a proper `IReportDecoder` image path in
  `RptBridge.Crystal` (automatic logo/banner PNGs, no operator selection).
- **B.** Collect the remaining companies'/types' `.rpt` files, hash them, and diff the
  `Contents`/subreport structure to count **distinct** layouts — the real go/no-go gate
  (if many companies share one layout, far less template work).

---

## 2. Scope

### In scope
- Windows console tool (`RptBridge.Cli`) — the priority deliverable.
- Optional thin WPF wrapper (`RptBridge.App`) for non-developer operators (finance/admin).
- Decoding `.rpt` → `TemplateDefinition` JSON.
- Extracting embedded images (logo, ISO banner) as PNG.
- Authenticating to the intranet and uploading the definition + assets.
- A new backend ingestion endpoint that accepts the definition and generates/updates the
  HTML template.

### Out of scope
- Running Crystal on the server / in Docker (impossible — Windows-only runtime).
- Replacing iText7 as the live renderer.
- Editing templates (that stays in the existing Admin UI).

---

## 3. Environment & prerequisites (Windows build machine)

| Requirement | Detail |
| --- | --- |
| OS | Windows 10/11 or Windows Server 2019+ (x64) |
| .NET SDK | .NET Framework 4.8 **or** .NET 8 (see §4 for the runtime choice) |
| Crystal runtime | **SAP Crystal Reports runtime for .NET** (the same version Sage 300 uses — confirm with the Sage admin; typically CR for VS 2010 SP / 13.0.x). Install the x64 redistributable. |
| Network | HTTPS reachability to the intranet host (same box that serves `https://<intranet-host>/api`). |
| Credentials | A dedicated service account in the intranet with the Finance/Admin permission (see §8). |

> **Version pinning is critical.** The `.rpt` files were authored by a specific Crystal
> version. Decode with a runtime **equal to or newer than** the authoring version. If
> `ReportDocument.Load` throws a load error, it is almost always a version/redistributable
> mismatch — install the matching CR runtime.

---

## 4. Technology choice for the decoder

There are two viable decode paths. **Recommended: Option A.**

### Option A — `CrystalDecisions` SDK (recommended)
Use the `CrystalDecisions.CrystalReports.Engine.ReportDocument` object model directly.
This gives the richest access: `ReportDefinition.Sections`, `ReportObjects`, field
positions (in **twips**, 1440/inch), fonts, borders, line/box objects, subreports, and
formula fields.

- **Runtime:** Easiest on **.NET Framework 4.8** (the CrystalDecisions assemblies are
  most stable there). A .NET 8 build is possible with the newer SAP packages but is less
  battle-tested — default to 4.8 for the CLI unless the team already standardises on .NET 8.
- **NuGet / assemblies:** `CrystalDecisions.CrystalReports.Engine`,
  `CrystalDecisions.Shared`, `CrystalDecisions.ReportAppServer.*` (come with the runtime).

### Option B — `RptToXml` (fallback / cross-check)
The open-source `RptToXml` utility (wraps the same SDK) dumps a `.rpt` to a big XML file.
Useful as a **verification cross-check** or if we want a quick dump without writing SDK
code. It still requires the Crystal runtime. Treat as secondary.

> **Datasource note (spike-confirmed):** these reports use the `u2lcapw.dll` native Sage
> 300 / ACCPAC driver, so the `dataField` names the SDK returns will be **Sage/ACCPAC schema
> names** (e.g. ACCPAC OE tables), not friendly labels. `field-map.json` (§6.1) must key on
> those real names — capture them exactly as the SDK reports them. The decoder must also
> traverse the **9 subreports** found in the spike.

**Decision:** Build Option A. Keep Option B as a debugging aid.

---

## 5. What to extract from the `.rpt`

Walk `ReportDocument.ReportDefinition` and produce our own normalised model. Extract:

### 5.1 Page / report level
- Page size + orientation (`PrintOptions.PaperSize`, `PaperOrientation`).
- Margins (`PageMargins` in twips).
- Report title / summary info.

### 5.2 Sections (in order)
`ReportHeader`, `PageHeader`, `GroupHeader[n]`, `Details`, `GroupFooter[n]`, `PageFooter`,
`ReportFooter`. For each section capture: name, height (twips), suppressed flag.

### 5.3 Report objects (per section)
For every `ReportObject` capture the common geometry then type-specific detail:

| Common | Source |
| --- | --- |
| `name` | `ReportObject.Name` |
| `kind` | `ReportObject.Kind` (Text, Field, Line, Box, Picture, Subreport) |
| `left/top/width/height` | twips |

Type-specific:
- **TextObject** — literal text, `Font` (name, size, bold/italic), colour, alignment.
- **FieldObject** — the bound data field name (`DataSource`, e.g. `{Customer.Name}` or a
  formula `{@Total}`), format string, font, alignment. **This is the key mapping to our
  data** (see §6).
- **LineObject** — start/end, thickness, style.
- **BoxObject** — bounds, border, fill.
- **PictureObject** — export the embedded image bytes → PNG (logo, ISO banner).

### 5.4 Formulas & mapping hints
Capture formula field text (`FormulaFieldDefinitions`) so we can see how Sage computes
totals/VAT — informs our merge fields.

### 5.5 Images — extractable directly from the `.rpt` (spike-confirmed)
The report stores its pictures as embedded **StaticDib** bitmaps inside OLE `Embedding`
streams. The spike (§1a) pulled them out by **parsing the DIB headers directly — no Crystal
SDK required**. So `RptBridge.Crystal` should have **two image paths**:

1. **Preferred — raw-DIB extractor** (works even without the SDK loaded): scan OLE
   `Embedding` streams for `StaticDib` markers, read the `BITMAPINFOHEADER`, convert to PNG.
   This is the fallback that makes embedded logos/banners come out automatically.
2. **SDK `PictureObject`** — when the SDK is available, also read `PictureObject` bytes so
   image *placement* (left/top/width/height in twips) ties to the geometry model.

Classify heuristically (smallest = logo, widest = banner) — matches the existing backend
convention. For the PMT report the spike extracted a **340×189 logo** and a **456×202 brand
banner** straight from the binary (see §1a.4).

> **Correction to earlier assumption:** we previously assumed images had to be lifted from
> rendered PDFs because the SDK might not expose bytes. The spike disproves that for this
> report — the bytes are in the `.rpt` and directly extractable. Keep the PDF path only as a
> last-resort fallback for reports that reference external (non-embedded) images.

---

## 6. TemplateDefinition JSON schema (the contract)

This is the **stable contract** between `RptBridge` and the backend. Keep it Crystal-agnostic
so we could later feed it from other sources.

```jsonc
{
  "schemaVersion": 1,
  "companyCode": "PMT",            // one of PMT|ACM|PHT|SBT|SAW|KOG
  "documentType": "invoice",       // invoice|delivery-note|quote
  "source": {
    "rptFileName": "OEINV01.rpt",
    "crystalVersion": "13.0.20",
    "decodedAtUtc": "2026-09-29T10:00:00Z",
    "decodedBy": "rptbridge/1.0"
  },
  "page": {
    "widthTwips": 11906,           // A4 portrait
    "heightTwips": 16838,
    "orientation": "portrait",
    "marginsTwips": { "top": 720, "right": 720, "bottom": 720, "left": 720 }
  },
  "sections": [
    {
      "name": "PageHeader",
      "heightTwips": 2880,
      "objects": [
        {
          "name": "CompanyLogo",
          "kind": "picture",
          "leftTwips": 360, "topTwips": 180,
          "widthTwips": 3400, "heightTwips": 1890,
          "assetFile": "assets/logo.png"
        },
        {
          "name": "Field_CustomerName",
          "kind": "field",
          "leftTwips": 7200, "topTwips": 1440,
          "widthTwips": 3600, "heightTwips": 260,
          "dataField": "{Customer.Name}",
          "mergeField": "CustomerName",   // mapped to our merge token (see §6.1)
          "font": { "name": "Arial", "sizePt": 9, "bold": false },
          "align": "left",
          "format": null
        }
      ]
    }
  ],
  "assets": [
    { "file": "assets/logo.png",   "role": "logo",   "widthPx": 340,  "heightPx": 189 },
    { "file": "assets/banner.png", "role": "banner", "widthPx": 2371, "heightPx": 482 }
  ],
  "formulas": [
    { "name": "Total", "text": "Sum({OrderLine.Extended})" }
  ]
}
```

### 6.1 Merge-field mapping table
`RptBridge` should map recognised Crystal `dataField` names to the **existing backend merge
tokens** so the generated template plugs straight into `MergeTemplate()` in
`DocumentTemplatesController.cs`. Provide this as an editable mapping file
(`field-map.json`) shipped with the tool:

| Crystal field (examples) | Intranet merge token |
| --- | --- |
| `{Customer.Name}`, `{@SoldToName}` | `CustomerName` |
| `{Customer.Number}`, `{@CustNo}` | `CustomerNumber` |
| `{OrderHeader.InvoiceNumber}` | `InvoiceNumber` |
| `{OrderHeader.InvoiceDate}` | `InvoiceDate` |
| `{@SubTotal}` | `SubTotal` |
| `{@TaxTotal}` / VAT | `VatAmount` |
| `{@InvoiceTotal}` | `Total` |
| `{OrderLine.ItemNo}` | `Lines[].ProductCode` |
| `{OrderLine.Description}` | `Lines[].ProductDescription` |
| `{OrderLine.QtyShipped}` | `Lines[].Quantity` |
| `{OrderLine.UnitPrice}` | `Lines[].UnitPrice` |
| `{OrderLine.Extended}` | `Lines[].LineAmount` |
| embedded logo image | `Logo` (base64 data URI) |
| embedded ISO banner | `Banner` (base64 data URI) |

Unmapped fields are still emitted (with `mergeField: null`) so an admin can wire them later
in the Template editor. The tool must **not silently drop** anything.

---

## 7. RptBridge application design

### 7.1 Projects (solution `RptBridge.sln`)
```
RptBridge.sln
├── RptBridge.Core        // netstandard2.0 — schema models, mapping, JSON, http client
├── RptBridge.Crystal     // net48 — CrystalDecisions decode (references runtime)
├── RptBridge.Cli         // net48 — console entry point (priority deliverable)
└── RptBridge.App         // net48 WPF — optional operator GUI (phase 2)
```
Keep the Crystal dependency isolated in `RptBridge.Crystal` behind an interface
`IReportDecoder` so `Core` and tests stay runtime-independent.

### 7.2 CLI contract
```
rptbridge decode  --in "OEINV01.rpt" --company PMT --type invoice --out ".\out"
rptbridge upload  --def ".\out\template-definition.json" --assets ".\out\assets" \
                  --host https://intranet.local --user svc@promed --password ****
rptbridge push    --in "OEINV01.rpt" --company PMT --type invoice \
                  --host https://intranet.local --user svc@promed --password ****
   # push = decode + upload in one shot
```
- Exit code `0` success, non-zero on failure. Log to console + `rptbridge.log`.
- `--password` may be read from env var `RPTBRIDGE_PASSWORD` or Windows Credential Manager
  to avoid it in shell history.
- `--dry-run` prints what would be uploaded without calling the API.

### 7.3 Core flow (`push`)
1. Load `.rpt` via `RptBridge.Crystal.CrystalReportDecoder`.
2. Build `TemplateDefinition` + export assets to a temp folder.
3. Validate against schema (§6) and the company/type allow-lists.
4. `POST /api/auth/login` → capture JWT (see §8).
5. `POST /api/document-templates/import-definition` (multipart) with the JSON + asset PNGs
   (see §9). Attach `Authorization: Bearer <jwt>`.
6. Report the backend response (created/updated, template regenerated).

---

## 8. Authentication to the intranet

The tool authenticates exactly like the web app — there is **no separate API key system**;
it uses the JWT bearer flow.

### 8.1 Login
```
POST {host}/api/auth/login
Content-Type: application/json

{ "email": "svc-rptbridge@promedtechnologies.co.za", "password": "••••••" }
```
Response (200) contains the token + user. Read the `token` field and send it as
`Authorization: Bearer <token>` on every subsequent call. (The Angular
`authInterceptor` does the same; login/register are the only unauthenticated routes.)

> **Important:** Native/browser requests (iframe, `window.open`) do **not** carry the JWT —
> that caused blank previews earlier. Your HTTP client must set the header explicitly on
> every request. Use `HttpClient` with a `DefaultRequestHeaders.Authorization` value.

### 8.2 Service account
Create a dedicated user (not a person's login) with the Finance/Admin permission required
by `DocumentTemplatesController` (`[Authorize]`). Do **not** reuse the hardcoded finance
company passwords — those are being removed. Store the service credential in Windows
Credential Manager on the build machine.

### 8.3 Token refresh
The backend exposes `POST /api/auth/refresh`. For a short-lived console run you normally
won't need it; the initial token lives long enough for one decode+upload. If a long batch
(all 6 companies × 3 types) exceeds token lifetime, re-login per company.

---

## 9. New backend endpoint (server-side work)

Add one endpoint to `Backend/Controllers/DocumentTemplatesController.cs`. It accepts the
`TemplateDefinition` + assets and (a) stores them and (b) regenerates the HTML template
from the definition instead of the hand-built starter.

```
POST /api/document-templates/import-definition
[Authorize]  Content-Type: multipart/form-data

Fields:
  companyCode   (string)   PMT|ACM|PHT|SBT|SAW|KOG
  documentType  (string)   invoice|delivery-note|quote
  definition    (file)     template-definition.json  (schema §6)
  assets        (file[])   logo.png, banner.png, ... (optional; may already be in JSON)
```

Server behaviour (mirrors the existing `Upload` conventions):
1. Validate `companyCode` / `documentType` against the existing `Companies` / `DocTypes`
   dictionaries.
2. Save definition to `{DocumentsPath}/document-templates/{COMPANY}/{TYPE}/definition.json`.
   (`DocumentsPath` = `/app/documents`, **not** `/app/uploads`.)
3. Save assets into the existing `assets/` subfolder (reuse the logo/banner convention so
   `LogoDataUri` / `BannerDataUri` keep working).
4. **Generate `template.html` from the definition** via a new `RenderTemplateFromDefinition`
   method: translate twips → CSS `pt` (twips ÷ 20), sections → positioned blocks, fields →
   the existing merge tokens (`{{CustomerName}}`, `{{#Lines}}…{{/Lines}}`, etc.). Preserve
   the current merge-token contract so `MergeTemplate()` / `generate/{txn}` work unchanged.
5. Update `meta.json` (`TemplateMeta`): add `DefinitionFileName`, `DefinitionImportedAt`,
   `Source = "rptbridge"`.
6. Return `{ message, companyCode, documentType, templateRegenerated: true, fieldCount, unmappedFields[] }`.

The existing `generate/{transactionNumber}` (iText7 → PDF) and the Admin editor need **no
change** — they already read `template.html`. The imported definition simply produces a
far more accurate `template.html` than the hand-built starter.

### 9.1 Optional: persist a DB row
If you want template imports auditable in the DB (recommended for admin visibility), add a
lightweight table:

```
DocumentTemplateImports
  Id (PK)
  CompanyCode        nvarchar(8)
  DocumentType       nvarchar(32)
  RptFileName        nvarchar(256)
  DefinitionJson     nvarchar(max)   -- the uploaded definition
  FieldCount         int
  UnmappedFields     nvarchar(max)   -- JSON array
  ImportedByUserId   int  (FK Users)
  ImportedAtUtc      datetime2
```
Populate it in the import endpoint. Surface in Admin → Settings → Document Templates as an
"Import history" panel. This is the "feed to admin / DB" part of the requirement.

---

## 10. End-to-end workflow (operator's view)

1. Operator runs `RptBridge.App` (or CLI) on a Windows machine with Crystal installed.
2. Picks a `.rpt`, selects company + document type, clicks **Decode**.
3. Tool decodes, shows a preview of extracted fields + images.
4. Operator clicks **Upload to Intranet** → tool logs in and posts the definition.
5. Backend regenerates `template.html`, stores the definition + assets + DB audit row.
6. Admin opens **Settings → Document Templates → {Company} → {Type}**, sees the new template,
   picks a real imported invoice, and previews/generates a Sage-identical PDF.

Repeat for all 6 companies × 3 document types.

---

## 11. Testing & acceptance

### 11.1 Unit
- `RptBridge.Core`: schema serialisation round-trip; twips→pt conversion; field-map lookup;
  unmapped-field passthrough.
- Mock `IReportDecoder` so Core tests don't need the Crystal runtime.

### 11.2 Integration (Windows box with Crystal)
- Decode each real `.rpt`; assert section count, that logo + banner images export, and that
  key fields (`InvoiceNumber`, line item fields, totals) are present and mapped.
- Cross-check against `RptToXml` output (Option B) for a couple of reports.

### 11.3 End-to-end
- `push` one report to a **staging** intranet; confirm `template.html` regenerates and that
  `GET /api/document-templates/{company}/{type}/generate/{txn}` produces a PDF that visually
  matches the Sage sample PDF (overlay comparison).

### 11.4 Acceptance criteria
- [ ] All 6 companies' invoice `.rpt`s decode without runtime errors.
- [ ] Logo + ISO banner extracted as PNG for each.
- [ ] Generated intranet PDF matches the Sage sample within acceptable tolerance
      (column positions, totals block, banking block, fonts).
- [ ] Import creates an audit row visible in Admin.
- [ ] No unmapped **critical** field (invoice number, customer, line fields, totals).

---

## 12. Security & operational notes

- **Least privilege:** service account gets only the template-import permission, nothing else.
- **Transport:** HTTPS only. If staging uses a self-signed cert, allow an explicit
  `--insecure` flag for dev **only** (never default).
- **Secrets:** never log the password/token. Redact `Authorization` in `rptbridge.log`.
- **File limits:** the existing upload path allows 60 MB (`[RequestSizeLimit(60_000_000)]`);
  keep the import endpoint consistent.
- **Idempotency:** re-importing the same company/type overwrites `definition.json` +
  `template.html` and adds a new audit row (history, not silent replace).
- **Runtime boundary:** reiterate for the team — Crystal decoding happens **only** on the
  Windows tool. The Linux backend never touches Crystal; it only consumes our JSON.

---

## 13. Deliverables checklist

- [ ] `RptBridge.sln` (Core / Crystal / Cli, + optional App).
- [ ] **Raw-DIB image extractor** in `RptBridge.Crystal` (promote the spike script — §5.5/§1a.4).
- [ ] Subreport traversal in the decoder (9 subreports seen in the spike — §1a.2).
- [ ] `field-map.json` default mapping (§6.1), keyed on real Sage/ACCPAC field names.
- [ ] `.rpt` inventory + hash/structure diff across all companies (go/no-go gate — §1a.7 B).
- [ ] `TemplateDefinition` schema doc + example (this file, §6).
- [ ] Backend `import-definition` endpoint + `RenderTemplateFromDefinition` (§9).
- [ ] Optional `DocumentTemplateImports` table + Admin history panel (§9.1).
- [ ] README with install steps for the Crystal runtime + service-account setup.
- [ ] Test suite (§11).

---

## 14. Reference: existing intranet contract (do not break)

The backend already exposes (all under `[Authorize]`, base `api/document-templates`):

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/` | Catalogue: `{ companies, documentTypes, items[] }` |
| POST | `/upload` | Form: `companyCode`, `documentType`, `rptFile?`, `sampleFile?` |
| GET | `/{company}/{type}/file/{kind}` | `kind` = `rpt` \| `sample` |
| GET/PUT | `/{company}/{type}/html` | Read/save reconstructed template |
| GET | `/{company}/invoices` | Imported invoices grouped by `TransactionNumber` |
| GET | `/{company}/{type}/generate/{txn}` | Render PDF via iText7 |
| GET | `/{company}/{type}/preview/{txn}` | Merged HTML preview |

Merge tokens honoured by `MergeTemplate()`: `{{Logo}}`, `{{Banner}}`, `{{CustomerName}}`,
`{{CustomerNumber}}`, `{{InvoiceNumber}}`, `{{InvoiceDate}}`, `{{SubTotal}}`,
`{{VatAmount}}` (15%), `{{Total}}`, and the line loop `{{#Lines}} … {{ProductCode}}
{{ProductDescription}} {{Quantity}} {{UnitPrice}} {{LineAmount}} … {{/Lines}}`.

`RptBridge` must emit templates using **exactly these tokens** so the existing generation
pipeline works with zero renderer changes.

- Companies: `PMT` Promed Technologies · `ACM` Acess Medical · `PHT` Promed Pharmatech ·
  `SBT` Sebenzani Trading · `SAW` SA Wellness · `KOG` Kog Trading.
- Document types: `invoice`, `delivery-note`, `quote`.
- Storage root: `{DocumentsPath}/document-templates/{COMPANY}/{TYPE}/`
  (`DocumentsPath` = `/app/documents`).
