Add-Type -AssemblyName System.Drawing
$d = Join-Path $PSScriptRoot 'public\logos'
foreach ($n in 'access','pharmatech','promed','sebenzani') {
  $src = [System.Drawing.Image]::FromFile("$d\$n.png")
  [double]$s = [Math]::Min(1.0, 640.0 / $src.Width)
  [int]$w = [Math]::Round($src.Width * $s)
  [int]$h = [Math]::Round($src.Height * $s)
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose(); $src.Dispose()
  $bmp.Save("$d\$n-wide.png", [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  '{0}-wide.png {1}x{2} {3}KB' -f $n, $w, $h, [int]((Get-Item "$d\$n-wide.png").Length / 1KB)
}
