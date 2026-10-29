$p = Get-Content "$env:TEMP\props.json" -Raw | ConvertFrom-Json
$t = [string]$p.chat_template
$out = "len=$($t.Length)`n"
foreach ($kw in 'enable_thinking','thought','<|think|>','channel') {
  $i = $t.IndexOf($kw)
  $out += "== $kw idx=$i`n"
  if ($i -ge 0) { $out += $t.Substring([Math]::Max(0,$i-250), [Math]::Min(600, $t.Length - [Math]::Max(0,$i-250))) + "`n`n" }
}
[IO.File]::WriteAllText("$env:TEMP\tpl.txt", $out)
