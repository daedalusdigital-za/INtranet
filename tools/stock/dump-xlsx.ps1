param([string]$Path = "C:\Users\Administrator\Desktop\finance\CASHFLOW TEMPLATE.xlsx")
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($Path)
try {
  $ss = @()
  $e = $zip.GetEntry('xl/sharedStrings.xml')
  if ($e) { $sr = New-Object IO.StreamReader($e.Open()); [xml]$x = $sr.ReadToEnd(); $sr.Close(); $ss = @($x.sst.si | ForEach-Object { ($_.InnerText) }) }
  $wbE = $zip.GetEntry('xl/workbook.xml'); $sr = New-Object IO.StreamReader($wbE.Open()); [xml]$wb = $sr.ReadToEnd(); $sr.Close()
  $relE = $zip.GetEntry('xl/_rels/workbook.xml.rels'); $sr = New-Object IO.StreamReader($relE.Open()); [xml]$rels = $sr.ReadToEnd(); $sr.Close()
  foreach ($sh in $wb.workbook.sheets.sheet) {
    $rid = $sh.GetAttribute('r:id'); if (-not $rid) { $rid = $sh.Attributes | Where-Object { $_.LocalName -eq 'id' } | Select-Object -First 1 -ExpandProperty Value }
    $target = ($rels.Relationships.Relationship | Where-Object { $_.Id -eq $rid }).Target -replace '^/?xl/', ''
    "===== SHEET: $($sh.name)  ($target) ====="
    $se = $zip.GetEntry("xl/$target"); $sr = New-Object IO.StreamReader($se.Open()); [xml]$s = $sr.ReadToEnd(); $sr.Close()
    $n = 0
    foreach ($row in $s.worksheet.sheetData.row) {
      $cells = @()
      foreach ($c in $row.c) {
        $v = $null
        if ($c.f) { $v = "=" + $c.f.InnerText }
        elseif ($c.t -eq 's') { $v = $ss[[int]$c.v] }
        elseif ($c.t -eq 'inlineStr') { $v = $c.is.InnerText }
        else { $v = $c.v }
        if ($v -ne $null -and "$v" -ne '') { $cells += "$($c.r)=$v" }
      }
      if ($cells.Count) { "r$($row.r): " + ($cells -join ' | '); $n++ }
      if ($n -ge 120) { "... (truncated)"; break }
    }
    if ($s.worksheet.mergeCells) { "merges: " + (($s.worksheet.mergeCells.mergeCell | ForEach-Object { $_.ref }) -join ', ') }
  }
} finally { $zip.Dispose() }
