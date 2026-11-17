# Approves (deducts stock for) every awaiting load that left on or before -UpTo.
# Dry run by default; pass -Apply to actually approve.
param(
  [datetime]$UpTo = (Get-Date).Date,
  [switch]$Apply,
  [string]$Api = "http://localhost:5143/api",
  [string]$Reason = "Bulk dispatch approval before stock count"
)
$token = (curl.exe -s -X POST "$Api/auth/login" -H "Content-Type: application/json" -d "@$env:TEMP\login.json" | ConvertFrom-Json).token
if (-not $token) { throw "login failed" }
$H = @("-H", "Authorization: Bearer $token", "-H", "Content-Type: application/json")

$state = curl.exe -s "$Api/logistics/stock-movements/load-stock-state" @H | ConvertFrom-Json
$loads = curl.exe -s "$Api/logistics/loads" @H | ConvertFrom-Json
$byId = @{}; foreach ($l in $loads) { $byId[[int]$l.id] = $l }

$cutoff = $UpTo.Date.AddDays(1)
$targets = $state | Where-Object { $_.state -eq 'awaiting' -and [datetime]$_.dispatchDate -lt $cutoff } | Sort-Object dispatchDate
Write-Host "Awaiting loads up to $($UpTo.ToString('dd MMM yyyy')): $($targets.Count)  (mode: $(if ($Apply) {'APPLY'} else {'dry run'}))"

$ok = 0; $fail = 0
foreach ($t in $targets) {
  $l = $byId[[int]$t.loadId]
  if (-not $l) { Write-Host "  #$($t.loadId): not in loads list - skipped"; $fail++; continue }
  $tag = "$($l.loadNumber) ($([datetime]$t.dispatchDate | Get-Date -Format 'dd MMM')) wh=$($l.warehouseId)"
  if (-not $l.warehouseId) { Write-Host "  $tag : no warehouse - skipped"; $fail++; continue }

  if ($Apply) { curl.exe -s -X POST "$Api/logistics/stock-movements/loads/$($l.id)/relink-lines" @H -d "{}" | Out-Null
    $l = (curl.exe -s "$Api/logistics/loads/$($l.id)" @H | ConvertFrom-Json) }

  $lines = @{}
  foreach ($s in @($l.stops)) { foreach ($c in @($s.commodities)) {
    if ($c.commodityId -and $c.quantity -gt 0) { $lines[[int]$c.commodityId] = [decimal]($lines[[int]$c.commodityId]) + [decimal]$c.quantity } } }
  if ($lines.Count -eq 0) { Write-Host "  $tag : no linked stock lines - skipped"; $fail++; continue }

  if (-not $Apply) { Write-Host "  $tag : $($lines.Count) line(s)"; $ok++; continue }

  $payload = @{ loadId = $l.id; skipUnlinked = $true; lines = @($lines.GetEnumerator() | ForEach-Object { @{ commodityId = $_.Key; dispatchedQuantity = $_.Value; reason = $Reason } }) } | ConvertTo-Json -Depth 5 -Compress
  $f = Join-Path $env:TEMP "appr.json"; [IO.File]::WriteAllText($f, $payload)
  $r = curl.exe -s -w "`n%{http_code}" -X POST "$Api/logistics/stock-movements/approve-dispatch" @H -d "@$f"
  $parts = $r -split "`n"; $code = $parts[-1]; $body = ($parts[0..($parts.Length-2)] -join "")
  $msg = try { ($body | ConvertFrom-Json).message } catch { $body }
  if ($code -eq '200') { Write-Host "  OK   $tag : $msg"; $ok++ } else { Write-Host "  FAIL $tag [$code]: $msg"; $fail++ }
}
Write-Host "Done: $ok ok, $fail skipped/failed"
