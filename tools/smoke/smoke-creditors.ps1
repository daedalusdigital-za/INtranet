# Smoke test for Finance â€º Creditors payment packs. Run after deploy.
$ErrorActionPreference = 'Stop'
$api = 'http://localhost:5143/api'
$login = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -ContentType 'application/json' -Body (@{ email = 'e2e.test@intranet.local'; password = 'E2eTest!2026' } | ConvertTo-Json)
$tok = $login.token; if (-not $tok) { $tok = $login.accessToken }
$h = @{ Authorization = "Bearer $tok" }

Write-Host "== meta"
$meta = Invoke-RestMethod -Uri "$api/finance/creditors/meta" -Headers $h
Write-Host ("companies: " + ($meta.companies | ForEach-Object code) -join ',')
Write-Host ("me: " + ($meta.me | ConvertTo-Json -Compress))

Write-Host "== create batch"
$b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches" -Headers $h -ContentType 'application/json' -Body (@{ companyCode = 'PMT'; paymentType = 'DailyCreditor'; notes = 'smoke test' } | ConvertTo-Json)
Write-Host "$($b.batchNumber) status=$($b.status) readyToSubmit=$($b.readyToSubmit)"

Write-Host "== add item"
$b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$($b.id)/items" -Headers $h -ContentType 'application/json' -Body (@{ supplierName = 'Test Supplier (Pty) Ltd'; supplierVatNumber = '4123456789'; invoiceNumbers = 'INV-1001'; amount = 1234.56; bankName = 'FNB'; accountNumber = '62012345678'; branchCode = '250655'; accountHolder = 'Test Supplier'; stockReturned = $false } | ConvertTo-Json)
Write-Host ("required for item: " + (($b.items[0].required | ForEach-Object { "$($_.docType)=$($_.filled)" }) -join ' '))
Write-Host ("required for batch: " + (($b.requiredBatchDocs | ForEach-Object { "$($_.docType)=$($_.filled)" }) -join ' '))

Write-Host "== submit without docs (expect ChecksFailed)"
$b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$($b.id)/submit" -Headers $h
Write-Host "status=$($b.status) checks=$($b.checksStatus) fail=$($b.checks.fail) review=$($b.checks.review) pass=$($b.checks.pass)"
$b.checks.findings | Where-Object severity -ne 'PASS' | ForEach-Object { Write-Host ("  [{0}] {1} {2} - {3}" -f $_.severity, $_.code, $_.title, $_.detail) }

Write-Host "== alerts"
(Invoke-RestMethod -Uri "$api/finance/creditors/alerts" -Headers $h) | Select-Object -First 5 | Format-Table code,title,severity -AutoSize

Write-Host "== list"
(Invoke-RestMethod -Uri "$api/finance/creditors/batches" -Headers $h) | Select-Object -First 3 | Format-Table batchNumber,companyCode,status,totalAmount,checksStatus -AutoSize

Write-Host "== cleanup: reopen + delete draft"
$b = Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$($b.id)/status" -Headers $h -ContentType 'application/json' -Body (@{ decision = 'Draft' } | ConvertTo-Json)
Invoke-RestMethod -Method Delete -Uri "$api/finance/creditors/batches/$($b.id)" -Headers $h | Out-Null
Write-Host "deleted $($b.batchNumber). OK"

