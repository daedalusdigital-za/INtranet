# Provisions the client-portal hosting described in docs/PORTAL_HOSTING.md.
# Idempotent: safe to re-run. Writes the GitHub secrets/vars to tools/portal-azure-output.local.txt (gitignored).
$ErrorActionPreference = 'Stop'
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

$rg       = 'rg-rocket-portal'
$locApp   = 'southafricanorth'
$locSwa   = 'westus2'   # SWA is served globally; region only hosts metadata. westeurope refused new customers on this subscription.
$swa      = 'swa-rocket-portal'
$plan     = 'asp-rocket-portal-edge'
$app      = 'app-rocket-portal-edge'
$relayNs  = 'relay-rocket-portal'
$hyco     = 'sage-svr-5143'
$upstreamHost = 'sage-svr'
$upstreamPort = 5143

function Az { param([Parameter(ValueFromRemainingArguments)]$a) $ErrorActionPreference = 'Continue'; $out = & $az @a 2>&1; if ($LASTEXITCODE -ne 0) { throw "az $($a -join ' ') failed:`n$out" }; $out }
function AzExists { param([Parameter(ValueFromRemainingArguments)]$a) $ErrorActionPreference = 'Continue'; $null = & $az @a --output none 2>&1; return ($LASTEXITCODE -eq 0) }

# Read the edge key from .env
$envFile = Join-Path $PSScriptRoot '..\.env'
$edgeKey = (Get-Content $envFile | Where-Object { $_ -match '^PORTAL_EDGE_KEY=' }) -replace '^PORTAL_EDGE_KEY=', ''
if (-not $edgeKey) { throw 'PORTAL_EDGE_KEY missing from .env' }

Write-Host "== Providers"
Az provider register --namespace Microsoft.Web | Out-Null
Az provider register --namespace Microsoft.Relay | Out-Null

Write-Host "== Resource group"
Az group create --name $rg --location $locApp --output none

Write-Host "== Static Web App ($swa, Free, $locSwa)"
if (-not (AzExists staticwebapp show --name $swa --resource-group $rg)) {
    Az staticwebapp create --name $swa --resource-group $rg --location $locSwa --sku Free --output none
}
$swaHost  = (Az staticwebapp show --name $swa --resource-group $rg --query defaultHostname --output tsv).Trim()
$swaToken = (Az staticwebapp secrets list --name $swa --resource-group $rg --query properties.apiKey --output tsv).Trim()

Write-Host "== App Service plan + web app ($app, B1 Windows .NET 10)"
# Hybrid Connections need a Windows plan. If an earlier run made a Linux plan, replace it.
if (AzExists appservice plan show --name $plan --resource-group $rg) {
    $kind = "$(Az appservice plan show --name $plan --resource-group $rg --query kind --output tsv)"
    if ($kind -match 'linux') { Az appservice plan delete --name $plan --resource-group $rg --yes --output none }
}
Az appservice plan create --name $plan --resource-group $rg --location $locApp --sku B1 --is-linux false --output none
if (-not (AzExists webapp show --name $app --resource-group $rg)) {
    Az webapp create --name $app --resource-group $rg --plan $plan --runtime 'dotnet:10' --output none
}
Az webapp update --name $app --resource-group $rg --https-only true --output none
Az webapp config set --name $app --resource-group $rg --min-tls-version 1.2 --ftps-state Disabled --always-on true --output none
$edgeHost = (Az webapp show --name $app --resource-group $rg --query defaultHostName --output tsv).Trim()

Write-Host "== Relay namespace + hybrid connection ($relayNs / $hyco -> ${upstreamHost}:$upstreamPort)"
Az relay namespace create --name $relayNs --resource-group $rg --location $locApp --output none
# The HCM requires real JSON (double quotes) in userMetadata; az.cmd strips quotes from arguments, so set it via az rest + body file.
$subId = (Az account show --query id --output tsv).Trim()
$hycoUrl = "https://management.azure.com/subscriptions/$subId/resourceGroups/$rg/providers/Microsoft.Relay/namespaces/$relayNs/hybridConnections/${hyco}?api-version=2024-01-01"
$bodyFile = Join-Path $env:TEMP 'hyco-body.json'
[IO.File]::WriteAllText($bodyFile, (@{ properties = @{ requiresClientAuthorization = $true; userMetadata = "[{`"key`":`"endpoint`",`"value`":`"${upstreamHost}:$upstreamPort`"}]" } } | ConvertTo-Json -Compress -Depth 5))
Az rest --method put --url $hycoUrl --body "@$bodyFile" --output none
# Listener key for the on-prem Hybrid Connection Manager
if (-not (AzExists relay hyco authorization-rule show --name defaultListener --resource-group $rg --namespace-name $relayNs --hybrid-connection-name $hyco)) {
    Az relay hyco authorization-rule create --name defaultListener --resource-group $rg --namespace-name $relayNs --hybrid-connection-name $hyco --rights Listen --output none
}
$listenerCs = (Az relay hyco authorization-rule keys list --name defaultListener --resource-group $rg --namespace-name $relayNs --hybrid-connection-name $hyco --query primaryConnectionString --output tsv).Trim()
Az webapp hybrid-connection add --name $app --resource-group $rg --namespace $relayNs --hybrid-connection $hyco --output none

Write-Host "== App settings"
$origins = "https://$swaHost"
Az webapp config appsettings set --name $app --resource-group $rg --output none --settings `
    "PORTAL_EDGE_KEY=$edgeKey" `
    "UPSTREAM=http://${upstreamHost}:$upstreamPort" `
    "ALLOWED_ORIGINS=$origins" `
    "RATE_PER_MINUTE=120" `
    "AUTH_RATE_PER_MINUTE=10" `
    "WEBSITE_RUN_FROM_PACKAGE=1"

Write-Host "== Publish profile"
$pubProfile = (Az webapp deployment list-publishing-profiles --name $app --resource-group $rg --xml) -join "`n"

$outFile = Join-Path $PSScriptRoot 'portal-azure-output.local.txt'
@"
# Generated $(Get-Date -Format s). DO NOT COMMIT.
SWA hostname            : https://$swaHost
Edge hostname           : https://$edgeHost
Relay namespace / hyco  : $relayNs / $hyco  (endpoint ${upstreamHost}:$upstreamPort)

--- GitHub repository VARIABLES ---
PORTAL_API_BASE                 = https://$edgeHost/api/portal
PORTAL_EDGE_APP_NAME            = $app
PORTAL_GOOGLE_MAPS_KEY          = <your key>

--- GitHub repository SECRETS ---
AZURE_STATIC_WEB_APPS_API_TOKEN_PORTAL = $swaToken
AZURE_WEBAPP_PUBLISH_PROFILE_PORTAL_EDGE =
$pubProfile

--- .env on SAGE-SVR ---
PORTAL_ORIGIN_2=https://$swaHost

--- Hybrid Connection Manager on SAGE-SVR (one-off) ---
& "C:\Program Files (x86)\HybridConnectionManager\CLI\hcm.exe" add "$listenerCs"
"@ | Set-Content $outFile -Encoding UTF8

Write-Host ""
Write-Host "SWA : https://$swaHost"
Write-Host "Edge: https://$edgeHost"
Write-Host "Secrets/vars written to $outFile"

