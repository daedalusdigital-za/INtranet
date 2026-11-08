# One-off: deploy the last known-good prebuilt portal bundle (dist from 28 Oct) to the SWA,
# with apiBase patched to the Azure edge. Use until the full portal source is recovered and the
# GitHub workflow can build again.
$ErrorActionPreference = 'Stop'
$src = "C:\Users\Administrator\Desktop\client-portal 2\dist\client-portal\browser"
$repo = Split-Path $PSScriptRoot -Parent
$stage = Join-Path $env:TEMP 'portal-prebuilt'
$edge = 'https://app-rocket-portal-edge.azurewebsites.net/api/portal'

$outTxt = Get-Content (Join-Path $PSScriptRoot 'portal-azure-output.local.txt') -Raw
$token = ([regex]::Match($outTxt, 'AZURE_STATIC_WEB_APPS_API_TOKEN_PORTAL\s*=\s*(\S+)')).Groups[1].Value
if (-not $token) { throw 'SWA token missing' }

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item $stage -ItemType Directory | Out-Null
Copy-Item "$src\*" $stage -Recurse
Copy-Item (Join-Path $repo 'client-portal\public\staticwebapp.config.json') $stage

$patched = 0
Get-ChildItem $stage -Filter *.js | ForEach-Object {
    $t = Get-Content $_.FullName -Raw
    if ($t -match 'apiBase:"/api/portal"') {
        [IO.File]::WriteAllText($_.FullName, $t.Replace('apiBase:"/api/portal"', "apiBase:`"$edge`""))
        $patched++
    }
}
"patched apiBase in $patched file(s)"

Push-Location $stage
try {
    npx --yes @azure/static-web-apps-cli@latest deploy . --deployment-token $token --env production --no-use-keychain 2>&1 | Select-Object -Last 15
} finally { Pop-Location }
