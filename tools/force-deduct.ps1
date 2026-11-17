# Pre-count sweep: deduct every line on every live load except the excluded load numbers.
param(
  [string[]]$Exclude = @(),
  [switch]$Apply,
  [string]$Api = "http://localhost:5143/api"
)
$token = (curl.exe -s -X POST "$Api/auth/login" -H "Content-Type: application/json" -d "@$env:TEMP\login.json" | ConvertFrom-Json).token
if (-not $token) { throw "login failed" }
$f = Join-Path $env:TEMP "force.json"
[IO.File]::WriteAllText($f, (@{ excludeLoadNumbers = @($Exclude) } | ConvertTo-Json -Compress))
$dry = if ($Apply) { "false" } else { "true" }
$r = curl.exe -s -X POST "$Api/logistics/stock-movements/loads/force-deduct?dryRun=$dry" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "@$f" | ConvertFrom-Json
$r | Select-Object dryRun, loadsConsidered, loadsTouched, movements, stockItemsCreated, wentNegative, baselineSkipped, excluded | Format-List
$r.results | Where-Object { $_.ok -eq $false } | Format-Table -AutoSize
"Loads: " + (($r.results | ForEach-Object { "$($_.loadNumber)($($_.lines))" }) -join ' ')
