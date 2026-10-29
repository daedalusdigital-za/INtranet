param([string]$Out = "$PSScriptRoot\flows-smoke.log")
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:5143/api/flows'
$log = @()
function L($m) { $script:log += $m; Write-Host $m }

try {
  $login = Invoke-RestMethod -Uri http://localhost:5143/api/auth/login -Method Post -ContentType 'application/json' -Body '{"email":"e2e.test@intranet.local","password":"E2eTest!2026"}' -TimeoutSec 20
  $h = @{ Authorization = "Bearer $($login.token)" }

  $cat = Invoke-RestMethod -Uri "$base/catalog" -Headers $h
  L "catalog: designer=$($cat.isDesigner) users=$($cat.users.Count) depts=$($cat.departments.Count) events=$($cat.events.Count) sources=$($cat.dataSources.Count) stepTypes=$($cat.stepTypes.Count)"

  $tpl = Invoke-RestMethod -Uri "$base/definitions?templates=true" -Headers $h
  L "templates: $(($tpl | ForEach-Object { "$($_.name) [L$($_.level)/$($_.triggerType)]" }) -join ' | ')"

  $flows = Invoke-RestMethod -Uri "$base/definitions" -Headers $h
  $pa = $flows | Where-Object { $_.name -like 'Purchase request approval*' } | Select-Object -First 1
  if (-not $pa) {
    $src = $tpl | Where-Object { $_.name -eq 'Purchase request approval' }
    $pa = Invoke-RestMethod -Uri "$base/definitions/$($src.id)/clone" -Method Post -Headers $h
    L "cloned template -> flow #$($pa.id) '$($pa.name)' enabled=$($pa.isEnabled)"
  } else { L "using existing flow #$($pa.id)" }

  $body = @{ inputs = @{ item = 'Label printer'; amount = 4500; supplier = 'Makro'; reason = 'Warehouse labels for Rocket' }; priority = 'Normal' } | ConvertTo-Json
  $run = Invoke-RestMethod -Uri "$base/definitions/$($pa.id)/start" -Method Post -Headers $h -ContentType 'application/json' -Body $body
  L "started $($run.summary.runNumber) status=$($run.summary.status) currentStep=$($run.summary.currentStepId) tasks=$($run.tasks.Count) assignee='$($run.tasks[0].assigneeLabel)'"
  foreach ($e in $run.events) { L "  ev: $($e.type) - $($e.message)" }

  $mine = Invoke-RestMethod -Uri "$base/tasks/mine" -Headers $h
  L "my open tasks: $($mine.Count)"
  $t = $run.tasks | Where-Object { $_.status -eq 'open' } | Select-Object -First 1
  if ($t) {
    $dec = @{ decision = 'approved'; comment = 'Go ahead'; result = @{} } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$base/tasks/$($t.id)/complete" -Method Post -Headers $h -ContentType 'application/json' -Body $dec
    L "approved task #$($t.id) -> run status=$($res.run.summary.status) outcome=$($res.run.summary.outcome) step=$($res.run.summary.currentStepId)"
    foreach ($e in $res.run.events | Select-Object -Skip $run.events.Count) { L "  ev: $($e.type) - $($e.message)" }
  }

  $stats = Invoke-RestMethod -Uri "$base/stats" -Headers $h
  L "stats: myOpen=$($stats.myOpen) active=$($stats.active) completed30=$($stats.completed30) failed30=$($stats.failed30) enabled=$($stats.enabled)"

  # Scheduled flow: clone Missing POD chaser and run now
  $pod = $flows | Where-Object { $_.name -like 'Missing POD chaser*' } | Select-Object -First 1
  if (-not $pod) { $src = $tpl | Where-Object { $_.name -eq 'Missing POD chaser' }; $pod = Invoke-RestMethod -Uri "$base/definitions/$($src.id)/clone" -Method Post -Headers $h; L "cloned POD chaser -> #$($pod.id) enabled=$($pod.isEnabled)" }
  $r2 = Invoke-RestMethod -Uri "$base/definitions/$($pod.id)/start" -Method Post -Headers $h -ContentType 'application/json' -Body '{}'
  L "POD chaser run-now: $($r2.message)"
}
catch {
  L "ERROR: $($_.Exception.Message)"
  if ($_.ErrorDetails) { L $_.ErrorDetails.Message }
}
$log | Out-File $Out -Encoding UTF8
