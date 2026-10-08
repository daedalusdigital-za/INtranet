# Splits sales-dashboard.component.ts (12.8k lines) into:
#   sales.models.ts                       — shared interfaces + COMPANIES const
#   sales-dashboard-dialogs.component.ts  — PodInvoicesDialog + EmailDetailDialogComponent
#   sales-dashboard.component.ts          — the main component + re-exports
$ErrorActionPreference = 'Stop'
$dir = 'Frontend\src\app\components\sales'
$src = "$dir\sales-dashboard.component.ts"
$lines = Get-Content $src

# Boundaries (1-based lines -> 0-based indices)
$headerEnd   = 41      # lines 1..42  = imports
$modelsStart = 42      # line 43      = COMPANIES const
$modelsEnd   = 234     # line 235     = end of SalesStats block (before blank + @Component at 237)
$mainStart   = 235     # line 236
$mainEnd     = 12620   # line 12621   = end of main class (12622 is the dialog comment)
$dlgStart    = 12621   # line 12622   = "// POD Invoices Dialog Component"

# ---- 1. models ----
$models = $lines[$modelsStart..$modelsEnd] -replace '^interface ', 'export interface ' -replace '^const ', 'export const '
$modelsHeader = @(
  '// ============================================================',
  '// Shared sales domain models — extracted from the former',
  '// 12.8k-line sales-dashboard.component.ts during the split.',
  '// ============================================================',
  ''
)
Set-Content "$dir\sales.models.ts" ($modelsHeader + $models) -Encoding UTF8

# ---- 2. dialog class names ----
$dlgRegion = $lines[$dlgStart..($lines.Count-1)]
$dlgNames = ($dlgRegion | Select-String -Pattern '^export class (\w+)').ForEach({ $_.Matches[0].Groups[1].Value })
Write-Output ("Dialog classes: " + ($dlgNames -join ', '))

# ---- 3. dialogs file ----
$dlgFileHeader = @(
  '// ============================================================',
  '// Sales dialog components — extracted verbatim from the former',
  '// 12.8k-line sales-dashboard.component.ts.',
  '// ============================================================'
)
$modelsImport = "import { Invoice, IncomingOrderEmail } from './sales.models';"
Set-Content "$dir\sales-dashboard-dialogs.component.ts" ($dlgFileHeader + $lines[0..$headerEnd] + @($modelsImport, '') + $dlgRegion) -Encoding UTF8

# ---- 4. new main file ----
$mainModelsImport = "import { COMPANIES, Company, SalesHistoryRow, SalesHistoryLine, SalesHistoryReconcile, CompanySales, Customer, SalesTripSheetLine, SalesTripSheet, Invoice, Order, IncomingOrderEmail, SalesStats } from './sales.models';"
$dlgImport = "import { $($dlgNames -join ', ') } from './sales-dashboard-dialogs.component';"
$reexport = @(
  '',
  '// Backward-compatible re-exports for historical import sites.',
  "export * from './sales-dashboard-dialogs.component';",
  "export * from './sales.models';"
)
Set-Content "$dir\sales-dashboard.component.ts" ($lines[0..$headerEnd] + @($mainModelsImport, $dlgImport, '') + $lines[$mainStart..$mainEnd] + $reexport) -Encoding UTF8

Write-Output "models lines:  $((Get-Content "$dir\sales.models.ts").Count)"
Write-Output "dialogs lines: $((Get-Content "$dir\sales-dashboard-dialogs.component.ts").Count)"
Write-Output "main lines:    $((Get-Content "$dir\sales-dashboard.component.ts").Count)"
