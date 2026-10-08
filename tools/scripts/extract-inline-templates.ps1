# Extracts the inline template/styles of the two main dashboard components
# into external .html/.scss files (standard Angular layout).
$ErrorActionPreference = 'Stop'

function Extract-Inline {
    param(
        [string]$File,        # component .ts path
        [string]$BaseName     # e.g. logistics-dashboard.component
    )
    $dir = Split-Path $File
    $lines = Get-Content $File

    # locate markers
    $tplStart = ($lines | Select-String -Pattern '^\s*template: `$' | Select-Object -First 1).LineNumber - 1
    $stylesStart = ($lines | Select-String -Pattern '^\s*styles: \[`$' | Select-Object -First 1).LineNumber - 1
    # template closes on the line '  `,' immediately before styles
    $tplEnd = $stylesStart - 1
    if ($lines[$tplEnd] -notmatch '^\s*`,\s*$') { throw "template close not found at $tplEnd" }
    # styles close on the line '  `]' followed by '})'
    $stylesEnd = -1
    for ($i = $stylesStart + 1; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*`\]\s*$') { $stylesEnd = $i; break }
    }
    if ($stylesEnd -lt 0) { throw 'styles close not found' }

    $html = $lines[($tplStart + 1)..($tplEnd - 1)]
    $scss = $lines[($stylesStart + 1)..($stylesEnd - 1)]

    Set-Content "$dir\$BaseName.html" $html -Encoding UTF8
    Set-Content "$dir\$BaseName.scss" $scss -Encoding UTF8

    # rebuild the .ts: replace template block with templateUrl, styles block with styleUrls
    $before = $lines[0..($tplStart - 1)]
    $after = $lines[($stylesEnd + 1)..($lines.Count - 1)]
    $replacement = @(
        "  templateUrl: './$BaseName.html',",
        "  styleUrls: ['./$BaseName.scss']"
    )
    Set-Content $File ($before + $replacement + $after) -Encoding UTF8

    Write-Output ("{0}: html {1} lines, scss {2} lines, ts now {3} lines" -f $BaseName, $html.Count, $scss.Count, ($before.Count + 2 + $after.Count))
}

Extract-Inline 'Frontend\src\app\components\logistics\logistics-dashboard.component.ts' 'logistics-dashboard.component'
Extract-Inline 'Frontend\src\app\components\sales\sales-dashboard.component.ts' 'sales-dashboard.component'
