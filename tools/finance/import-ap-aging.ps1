# Imports every Sage A/P aged payables .xls in a folder into Finance > Creditors > Aging.
param(
  [string]$Folder = "C:\Users\Administrator\Desktop\finance",
  [string]$Api = "http://localhost:5143/api"
)
$token = (curl.exe -s -X POST "$Api/auth/login" -H "Content-Type: application/json" -d "@$env:TEMP\login.json" | ConvertFrom-Json).token
if (-not $token) { throw "login failed" }
Get-ChildItem $Folder -Filter *.xls* | ForEach-Object {
  Write-Host "== $($_.Name)"
  curl.exe -s -X POST "$Api/finance/creditors/aging/import" -H "Authorization: Bearer $token" -F "file=@$($_.FullName)"
  Write-Host ""
}
