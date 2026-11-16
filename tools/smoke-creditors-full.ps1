# Full-cycle test: Utility batch (fewest required docs) -> upload PDFs -> submit -> accountant -> director decide + sign -> bank file -> paid -> POP -> close
$ErrorActionPreference = 'Stop'
$api = 'http://localhost:5143/api'
$pdf = $args[0]
$login = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -ContentType 'application/json' -Body (@{ email = 'e2e.test@intranet.local'; password = 'E2eTest!2026' } | ConvertTo-Json)
$tok = $login.token; if (-not $tok) { $tok = $login.accessToken }
$h = @{ Authorization = "Bearer $tok" }
$me = Invoke-RestMethod -Uri "$api/finance/creditors/meta" -Headers $h
$meName = (Invoke-RestMethod -Uri "$api/finance/creditors/users?search=e2e" -Headers $h | Select-Object -First 1).name
Write-Host "signing as: $meName"

function Upload($id, $type, $itemId) {
  $bytes = [IO.File]::ReadAllBytes($pdf)
  $boundary = [Guid]::NewGuid().ToString()
  $LF = "`r`n"
  $head = "--$boundary$LF" + "Content-Disposition: form-data; name=`"docType`"$LF$LF$type$LF"
  if ($itemId) { $head += "--$boundary$LF" + "Content-Disposition: form-data; name=`"itemId`"$LF$LF$itemId$LF" }
  $head += "--$boundary$LF" + "Content-Disposition: form-data; name=`"file`"; filename=`"$type-$([Guid]::NewGuid().ToString('N').Substring(0,6)).pdf`"$LF" + "Content-Type: application/pdf$LF$LF"
  $tail = "$LF--$boundary--$LF"
  # tweak a byte so each upload has a unique hash
  $bytes[$bytes.Length - 1] = [byte](Get-Random -Maximum 255)
  $ms = New-Object IO.MemoryStream
  $hb = [Text.Encoding]::ASCII.GetBytes($head); $ms.Write($hb, 0, $hb.Length); $ms.Write($bytes, 0, $bytes.Length); $tb = [Text.Encoding]::ASCII.GetBytes($tail); $ms.Write($tb, 0, $tb.Length)
  $body = $ms.ToArray()
  return Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$id/documents" -Headers $h -ContentType "multipart/form-data; boundary=$boundary" -Body $body
}

$b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches" -Headers $h -ContentType 'application/json' -Body (@{ companyCode = 'ACM'; paymentType = 'Utility' } | ConvertTo-Json)
Write-Host "created $($b.batchNumber) ($($b.paymentTypeTitle))"
$b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$($b.id)/items" -Headers $h -ContentType 'application/json' -Body (@{ supplierName = 'City Power'; amount = 8800; bankName = 'Standard Bank'; accountNumber = '001122334455'; branchCode = '051001'; accountHolder = 'City Power' } | ConvertTo-Json)
$item = $b.items[0]
Write-Host ("item required: " + (($item.required | ForEach-Object docType) -join ','))
Write-Host ("batch required: " + (($b.requiredBatchDocs | ForEach-Object docType) -join ','))

foreach ($r in $b.requiredBatchDocs) { $b = Upload $b.id $r.docType $null }
foreach ($r in $item.required) { $b = Upload $b.id $r.docType $item.id }
Write-Host "uploaded. readyToSubmit=$($b.readyToSubmit) docs=$($b.batchDocuments.Count + $b.items[0].documents.Count) textMethod=$($b.batchDocuments[0].textMethod) pages=$($b.batchDocuments[0].pageCount)"

$b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$($b.id)/submit" -Headers $h
Write-Host "submit -> $($b.status) checks=$($b.checksStatus) (fail=$($b.checks.fail) review=$($b.checks.review) pass=$($b.checks.pass))"
$b.checks.findings | Where-Object severity -ne 'PASS' | ForEach-Object { Write-Host ("  [{0}] {1} {2} - {3}" -f $_.severity, $_.code, $_.title, $_.detail) }

if ($b.status -eq 'AwaitingAccountant') {
  $b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$($b.id)/accountant" -Headers $h -ContentType 'application/json' -Body (@{ decision = 'approve'; comment = 'Recon agrees' } | ConvertTo-Json)
  Write-Host "accountant -> $($b.status) by $($b.accountantName)"
  $b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$($b.id)/items/$($item.id)/decision" -Headers $h -ContentType 'application/json' -Body (@{ decision = 'Approved' } | ConvertTo-Json)
  Write-Host "director decision -> item $($b.items[0].decisionStatus); can.sign=$($b.can.sign)"
  $b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$($b.id)/sign" -Headers $h -ContentType 'application/json' -Body (@{ typedName = $meName; comment = 'Signed in test' } | ConvertTo-Json)
  Write-Host "sign -> $($b.status) locked=$($b.lockedAt) hash=$($b.lockHash.Substring(0,12)) signatures=$($b.signatures.Count)"
  $csv = Invoke-WebRequest -Uri "$api/finance/creditors/batches/$($b.id)/bank-file" -Headers $h -UseBasicParsing
  Write-Host "bank file:`n$($csv.Content)"
  $b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$($b.id)/status" -Headers $h -ContentType 'application/json' -Body (@{ decision = 'Paid' } | ConvertTo-Json)
  Write-Host "paid -> $($b.status)"
  try { Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$($b.id)/status" -Headers $h -ContentType 'application/json' -Body (@{ decision = 'Closed' } | ConvertTo-Json) | Out-Null; Write-Host "close without POP: UNEXPECTEDLY ALLOWED" } catch { Write-Host "close without POP correctly refused (409)" }
  $b = Upload $b.id 'ProofOfPayment' $item.id
  $b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$($b.id)/status" -Headers $h -ContentType 'application/json' -Body (@{ decision = 'Closed' } | ConvertTo-Json)
  Write-Host "close -> $($b.status). events=$($b.events.Count)"
  $b.events | Sort-Object at | ForEach-Object { Write-Host ("  {0:HH:mm:ss} {1,-20} {2}" -f [datetime]$_.at, $_.action, $_.comment) }
}
