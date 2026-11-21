# Send one message to Welly's session endpoint and print the stream breakdown.
param([Parameter(Mandatory)][string]$Prompt, [string]$Session = "welly-probe-$(Get-Random)")
$login = Invoke-RestMethod -Uri http://localhost:5143/api/auth/login -Method Post -ContentType 'application/json' -Body '{"email":"e2e.test@intranet.local","password":"E2eTest!2026"}' -TimeoutSec 20
$tok = $login.token
$body = @{ prompt = $Prompt; sessionId = $Session } | ConvertTo-Json -Compress
[IO.File]::WriteAllText("$env:TEMP\welly-body.json", $body, [Text.UTF8Encoding]::new($false))
$sw = [Diagnostics.Stopwatch]::StartNew()
cmd /c "curl.exe -s -N --max-time 600 -H ""Authorization: Bearer $tok"" -H ""Content-Type: application/json"" --data-binary @%TEMP%\welly-body.json http://localhost:5143/api/aichat/chat/session > %TEMP%\welly-out.txt 2>&1"
$secs = [int]$sw.Elapsed.TotalSeconds
$content = ''; $think = ''
foreach ($l in (Get-Content "$env:TEMP\welly-out.txt")) {
  if ($l -notlike 'data:*') { continue }
  $d = $l.Substring(5).Trim(); if ($d -eq '[DONE]') { continue }
  try { $j = $d | ConvertFrom-Json } catch { continue }
  if ($j.token) { $content += $j.token }
  if ($j.thinking) { $think += $j.thinking }
  if ($j.status) { "STATUS: $($j.status)" }
  if ($j.action) { "ACTION: $($j.action.type) ok=$($j.action.success) summarized=$($j.action.summarized) len=$($j.action.message.Length)" }
}
"secs=$secs thinkingChars=$($think.Length) contentChars=$($content.Length)"
if ($think) { "--- THINKING (head) ---"; $think.Substring(0, [Math]::Min(400, $think.Length)) }
"--- ANSWER ---"; $content
