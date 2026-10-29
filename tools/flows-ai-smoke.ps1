$ErrorActionPreference = 'Stop'
$base = 'http://localhost:5143/api/flows'
$log = @()
function L($m) { $script:log += $m }
try {
  $login = Invoke-RestMethod -Uri http://localhost:5143/api/auth/login -Method Post -ContentType 'application/json' -Body '{"email":"e2e.test@intranet.local","password":"E2eTest!2026"}'
  $h = @{ Authorization = "Bearer $($login.token)" }
  $def = @{
    name = 'AI smoke test'; description = 'temp'; category = 'General'; level = 2; triggerType = 'manual'; isEnabled = $true
    trigger = @{ titleTemplate = 'AI test: {{inputs.text}}' }
    inputs = @(@{ key = 'text'; label = 'Complaint text'; type = 'textarea'; required = $true })
    graph = @{ startStepId = 'analyse'; steps = @(
      @{ id = 'analyse'; type = 'ai_analyze'; name = 'Welly classifies'; nextStepId = 'urgent'; config = @{ outputKey = 'ai'; prompt = 'Classify this customer complaint. category: one of delivery, billing, product, other. priority: Low/Normal/High/Urgent. summary: one sentence.'; fields = @(@{ key = 'category'; description = 'delivery, billing, product or other' }, @{ key = 'priority'; description = 'Low, Normal, High or Urgent' }, @{ key = 'summary'; description = 'one sentence' }) } },
      @{ id = 'urgent'; type = 'condition'; name = 'Urgent?'; config = @{ expression = 'ai.priority == "Urgent" || ai.priority == "High"'; trueStepId = 'task'; falseStepId = 'end' } },
      @{ id = 'task'; type = 'task'; name = 'Handle'; nextStepId = 'end'; config = @{ title = '{{ai.category}}: {{ai.summary}}'; description = 'Welly says: {{ai.summary}}'; assignTo = @{ starter = $true }; priority = '{{ai.priority}}'; dueInHours = 4 } },
      @{ id = 'end'; type = 'end'; name = 'Done'; config = @{ outcome = '{{ai.category}}' } }
    ) }
  } | ConvertTo-Json -Depth 10
  $existing = (Invoke-RestMethod -Uri "$base/definitions" -Headers $h) | Where-Object { $_.name -eq 'AI smoke test' }
  if ($existing) { $d = Invoke-RestMethod -Uri "$base/definitions/$($existing.id)" -Method Put -Headers $h -ContentType 'application/json' -Body $def }
  else { $d = Invoke-RestMethod -Uri "$base/definitions" -Method Post -Headers $h -ContentType 'application/json' -Body $def }
  L "flow #$($d.id) v$($d.version)"
  $v = Invoke-RestMethod -Uri "$base/definitions/validate" -Method Post -Headers $h -ContentType 'application/json' -Body $def
  L "validate ok=$($v.ok) warnings=$($v.warnings -join '; ')"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $run = Invoke-RestMethod -Uri "$base/definitions/$($d.id)/start" -Method Post -Headers $h -ContentType 'application/json' -Body (@{ inputs = @{ text = 'My fridge was delivered 3 days late, the box was crushed and the driver refused to carry it inside. I want a refund today or I am cancelling the account.' } } | ConvertTo-Json) -TimeoutSec 300
  $sw.Stop()
  L "run $($run.summary.runNumber) status=$($run.summary.status) outcome=$($run.summary.outcome) took=$([int]$sw.Elapsed.TotalSeconds)s"
  L "ai: $($run.context.ai | ConvertTo-Json -Compress)"
  foreach ($e in $run.events) { L "  ev: $($e.type) - $($e.message)" }
  foreach ($t in $run.tasks) { L "  task: [$($t.priority)] $($t.title) -> $($t.assigneeLabel)" }
} catch { L "ERROR: $($_.Exception.Message)"; if ($_.ErrorDetails) { L $_.ErrorDetails.Message } }
$log | Out-File "$PSScriptRoot\flows-ai.log" -Encoding UTF8
