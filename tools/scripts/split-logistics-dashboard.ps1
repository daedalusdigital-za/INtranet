# Splits logistics-dashboard.component.ts (36.5k lines) into:
#   logistics.models.ts                      — shared interfaces
#   logistics-dashboard-dialogs.component.ts — the ~47 dialog components
#   logistics-dashboard.component.ts         — the main component + re-exports
$ErrorActionPreference = 'Stop'
$dir = 'Frontend\src\app\components\logistics'
$src = "$dir\logistics-dashboard.component.ts"
$lines = Get-Content $src

# Region boundaries (1-based lines -> 0-based indices)
$headerEnd   = 44      # lines 1..45   = imports
$modelsStart = 46      # line 47       = first interface
$modelsEnd   = 199     # line 200      = blank before @Component
$mainStart   = 200     # line 201      = main @Component
$mainEnd     = 11132   # line 11133    = end of main class
$dlgStart    = 11133   # line 11134    = first dialog @Component

# ---- 1. models file: export the shared interfaces ----
$models = $lines[$modelsStart..$modelsEnd] -replace '^interface ', 'export interface '
$modelsHeader = @(
  '// ============================================================',
  '// Shared logistics domain models — extracted from the former',
  '// 36k-line logistics-dashboard.component.ts during the split.',
  '// ============================================================',
  ''
)
Set-Content "$dir\logistics.models.ts" ($modelsHeader + $models) -Encoding UTF8

# ---- 2. collect dialog class names for imports/re-exports ----
$dlgRegion = $lines[$dlgStart..($lines.Count-1)]
$dlgNames = ($dlgRegion | Select-String -Pattern '^export class (\w+)').ForEach({ $_.Matches[0].Groups[1].Value })
Write-Output ("Dialog classes: " + $dlgNames.Count)

# ---- 3. dialogs file: header + models import + dialog region ----
$dlgFileHeader = @(
  '// ============================================================',
  '// Logistics dialog components — extracted verbatim from the',
  '// former 36k-line logistics-dashboard.component.ts. Each dialog',
  '// is an independent standalone component opened via MatDialog.',
  '// Shared domain interfaces live in ./logistics.models.',
  '// ============================================================'
)
$modelsImport = "import { DashboardStats, ActiveLoad, Vehicle, ImportedInvoice, MaintenanceRecord, DeliveryRequest, DeliveryRequestSummary } from './logistics.models';"
Set-Content "$dir\logistics-dashboard-dialogs.component.ts" ($dlgFileHeader + $lines[0..$headerEnd] + @($modelsImport, '') + $dlgRegion) -Encoding UTF8

# ---- 4. new main file: header + models import + dialog imports + main region + re-exports ----
$dlgImport = "import { $($dlgNames -join ', ') } from './logistics-dashboard-dialogs.component';"
$reexport = @(
  '',
  '// Backward-compatible re-exports: other modules (e.g. sales-dashboard)',
  '// historically imported dialogs and models from this file.',
  "export * from './logistics-dashboard-dialogs.component';",
  "export * from './logistics.models';"
)
Set-Content "$dir\logistics-dashboard.component.ts" ($lines[0..$headerEnd] + @($modelsImport, $dlgImport, '') + $lines[$mainStart..$mainEnd] + $reexport) -Encoding UTF8

Write-Output "models lines:  $((Get-Content "$dir\logistics.models.ts").Count)"
Write-Output "dialogs lines: $((Get-Content "$dir\logistics-dashboard-dialogs.component.ts").Count)"
Write-Output "main lines:    $((Get-Content "$dir\logistics-dashboard.component.ts").Count)"
