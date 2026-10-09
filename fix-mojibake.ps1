# Scans (and optionally fixes) UTF-8 mojibake in source files.
# Mojibake = UTF-8 bytes that were decoded as Windows-1252 then re-saved as UTF-8
# e.g. em-dash "—" became "â€”", "✅" became "âœ…", "→" became "â†’".
param(
    [switch]$Fix
)

$root = "C:\Users\Administrator\Documents\GitHub\INtranet\Frontend\src"
$exts = @('*.ts', '*.html', '*.scss', '*.css')

$utf8 = [System.Text.UTF8Encoding]::new($false)
$win1252 = [System.Text.Encoding]::GetEncoding(1252)

# Marker chars that indicate mojibake (â Ã Â ð followed by continuation garbage)
$markerPattern = '[\u00E2\u00C3\u00C2\u00F0][\u0080-\u00BF\u20AC\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178\u00A0-\u00FF]'

$files = Get-ChildItem -Path $root -Recurse -Include $exts
$totalFixed = 0
foreach ($f in $files) {
    $text = [System.IO.File]::ReadAllText($f.FullName, $utf8)
    if (-not [regex]::IsMatch($text, $markerPattern)) { continue }

    $count = ([regex]::Matches($text, $markerPattern)).Count
    Write-Output ("{0}  ({1} suspect sequences)" -f $f.FullName.Substring($root.Length + 1), $count)

    if ($Fix) {
        # Reverse the mojibake: encode current text back to Windows-1252 bytes,
        # then decode those bytes as UTF-8. Only apply if round-trip is safe
        # (every char must be representable in 1252) - do it per-line to avoid
        # corrupting lines that contain genuine non-1252 chars.
        $lines = $text -split "(\r?\n)"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            if (-not [regex]::IsMatch($line, $markerPattern)) { continue }
            try {
                $bytes = $win1252.GetBytes($line)
                $roundtrip = $win1252.GetString($bytes)
                if ($roundtrip -ne $line) { continue }  # lossy -> skip
                $decoded = $utf8.GetString($bytes)
                # Only accept if it reduced mojibake markers and produced no replacement chars
                if ($decoded -notmatch "\uFFFD" -and ([regex]::Matches($decoded, $markerPattern)).Count -lt ([regex]::Matches($line, $markerPattern)).Count) {
                    $lines[$i] = $decoded
                    $totalFixed++
                }
            } catch { }
        }
        $newText = -join $lines
        if ($newText -ne $text) {
            [System.IO.File]::WriteAllText($f.FullName, $newText, $utf8)
            Write-Output "  -> fixed"
        }
    }
}
if ($Fix) { Write-Output "Total lines fixed: $totalFixed" }
