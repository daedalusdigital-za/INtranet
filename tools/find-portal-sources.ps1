# Find deleted client-portal sources in VS Code local history and the Recycle Bin.
$hist = "$env:APPDATA\Code\User\History"
$hits = @()
Get-ChildItem $hist -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $e = Join-Path $_.FullName 'entries.json'
    if (Test-Path $e) {
        $j = Get-Content $e -Raw | ConvertFrom-Json
        if ($j.resource -match 'client-portal') {
            $hits += [pscustomobject]@{ res = ([uri]::UnescapeDataString($j.resource) -replace '^file:///', ''); n = $j.entries.Count; dir = $_.FullName }
        }
    }
}
"history hits: $($hits.Count)"
$hits | Sort-Object res | ForEach-Object { "$($_.n)`t$($_.res)" }
"--- recycle bin:"
$sh = New-Object -ComObject Shell.Application; $rb = $sh.Namespace(10)
$items = @($rb.Items() | Where-Object { $rb.GetDetailsOf($_, 1) -match 'client-portal' })
"count: $($items.Count)"
$items | Select-Object -First 30 | ForEach-Object { "$($_.Name)`t<- $($rb.GetDetailsOf($_,1))`t$($rb.GetDetailsOf($_,2))" }
