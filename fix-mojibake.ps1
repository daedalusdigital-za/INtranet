# Finds source files whose text contains UTF-8 double-encoded ("mojibake") sequences. Pass -Fix to repair them in place.
param([switch]$Fix)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pattern = [regex]('(' + [string]::Join('|', @("\u00E2\u20AC\u201D", "\u00E2\u20AC\u00A6", "\u00C2\u00B7", "\u00E2\u2020\u2019", "\u00C3\u00A9", "\u00E2\u20AC\u0153", "\u00E2\u20AC\u2122", "\uFFFD")) + ')')
$cp1252 = [Text.Encoding]::GetEncoding(1252)
$utf8 = New-Object Text.UTF8Encoding $false
$hits = Get-ChildItem -Recurse -Include *.ts,*.cs,*.html,*.scss,*.json,*.md -Path "$root\Frontend\src","$root\Backend" |
  Where-Object { $_.FullName -notmatch '\\(bin|obj|node_modules|publish|dist)\\' } |
  Where-Object { $pattern.IsMatch([IO.File]::ReadAllText($_.FullName, [Text.Encoding]::UTF8)) }
foreach ($f in $hits) {
  Write-Output $f.FullName.Substring($root.Length + 1)
  if ($Fix) {
    $s = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
    $fixed = [Text.Encoding]::UTF8.GetString($cp1252.GetBytes($s))
    [IO.File]::WriteAllText($f.FullName, $fixed, $utf8)
  }
}
Write-Output "files affected: $($hits.Count)$(if ($Fix) { ' (repaired)' })"
