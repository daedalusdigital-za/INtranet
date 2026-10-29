# Probe: does llama-server emit reasoning_content when given our full system prompt?
param([string]$Prompt = 'Which is bigger, 9.11 or 9.9? explain briefly', [switch]$NoSystem, [int]$Lines = 0, [string]$SystemText = '')
$root = Split-Path $PSScriptRoot -Parent
$sys = [IO.File]::ReadAllText("$root\ai-data\prompts\system.txt")
if ($Lines -gt 0) { $sys = (($sys -split "`n") | Select-Object -First $Lines) -join "`n" }
if ($SystemText) { $sys = $SystemText }
$msgs = New-Object System.Collections.ArrayList
if (-not $NoSystem) { [void]$msgs.Add(@{ role = 'system'; content = $sys }) }
[void]$msgs.Add(@{ role = 'user'; content = $Prompt })
if ($env:PROBE_PREFILL) { [void]$msgs.Add(@{ role = 'assistant'; content = $env:PROBE_PREFILL }) }
$body = @{
  model = 'x'; stream = $false; max_tokens = 600; temperature = 0.5
  messages = $msgs.ToArray()
  chat_template_kwargs = @{ enable_thinking = $true }
  reasoning_format = 'deepseek'
} | ConvertTo-Json -Depth 6 -Compress
[IO.File]::WriteAllText("$env:TEMP\probe.json", $body, [Text.UTF8Encoding]::new($false))
cmd /c "curl.exe -s --max-time 240 -H ""Content-Type: application/json"" --data-binary @%TEMP%\probe.json http://localhost:8090/v1/chat/completions > %TEMP%\probe-out.json 2>&1"
$o = [IO.File]::ReadAllText("$env:TEMP\probe-out.json") | ConvertFrom-Json
if ($o.error) { "ERROR: $($o.error.message)"; exit 1 }
$m = $o.choices[0].message
"system prompt: $(-not $NoSystem)  reasoning_len=$(([string]$m.reasoning_content).Length)  content_len=$(([string]$m.content).Length)"
"content: " + ([string]$m.content).Substring(0, [Math]::Min(160, ([string]$m.content).Length))
