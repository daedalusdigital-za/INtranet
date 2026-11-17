# Imports the full stock count from the STOCK folder (CPT/GP/KZN/PE x company workbooks).
# Dry run by default. -Apply posts the counts; -ZeroUncounted then zeroes everything in each warehouse the sheets didn't list.
param(
  [string]$Root = "C:\Users\Administrator\Desktop\STOCK",
  [switch]$Apply,
  [switch]$ZeroUncounted,
  [string]$Api = "http://localhost:5143/api"
)
$token = (curl.exe -s -X POST "$Api/auth/login" -H "Content-Type: application/json" -d "@$env:TEMP\login.json" | ConvertFrom-Json).token
if (-not $token) { throw "login failed" }
$whOf = @{ CPT = 3; GP = 2; KZN = 1; PE = 4 }
function CompanyOf($name) {
  $n = $name.ToUpper()
  if ($n -match 'ACC?ESS') { return 'ACCESS' }
  if ($n -match 'PHARMA|\bPP\b|PHARMATECH') { return 'PHARMACARE' }
  if ($n -match 'PROMED') { return 'PROMED' }
  if ($n -match 'SEB') { return 'SEBENZANI' }
  return $null
}
$dry = if ($Apply) { "false" } else { "true" }
$since = (Get-Date).Date.ToString("yyyy-MM-dd")
$touched = @{}
foreach ($f in Get-ChildItem $Root -Recurse -Filter *.xlsx) {
  $whKey = ($f.Directory.Name -split ' ')[0].ToUpper()
  $wh = $whOf[$whKey]; $co = CompanyOf $f.BaseName
  if (-not $wh -or -not $co) { Write-Host "SKIP $($f.FullName) (wh=$whKey co=$co)"; continue }
  $r = curl.exe -s -X POST "$Api/logistics/stock-take/import" -H "Authorization: Bearer $token" -F "file=@$($f.FullName)" -F "warehouseId=$wh" -F "company=$co" -F "dryRun=$dry" | ConvertFrom-Json
  if ($r.message) { Write-Host "FAIL $($f.Name): $($r.message)"; continue }
  Write-Host ("{0,-28} wh={1} {2,-10} items={3,4} counted={4,12:N0} matched={5,4} created={6,4} renamed={7,4} adjusted={8,4} confirmed={9,4} shared={10}" -f $f.Name, $wh, $co, $r.items, $r.totalCounted, $r.matched, $r.created, $r.renamed, $r.adjusted, $r.confirmed, ($r.codesSharedWithOtherCompanies -join ','))
  $touched[$wh] = $true
}
if ($ZeroUncounted) {
  foreach ($wh in $touched.Keys) {
    $z = curl.exe -s -X POST "$Api/logistics/stock-take/zero-uncounted?warehouseId=$wh&countedSince=$since&dryRun=$dry" -H "Authorization: Bearer $token" | ConvertFrom-Json
    Write-Host ("ZERO wh={0} {1}: lines={2} totalQty={3}" -f $wh, $z.warehouse, ($z.lines, $z.zeroed -ne $null)[0], $z.totalQty)
  }
}
