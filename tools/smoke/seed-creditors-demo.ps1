# Seeds realistic demo batches across every workflow stage so the Creditors screen can be explored.
# Usage: .\tools\seed-creditors-demo.ps1 <path-to-any-pdf>   (e.g. uploads\maintenance\20260515093335_5a44699eca77434ca9a94c5f2bbefd74.pdf)
# Remove again with: .\tools\seed-creditors-demo.ps1 <pdf> -Clean   (deletes every batch whose notes start with "[DEMO]"; non-draft ones are reopened first)
param([Parameter(Mandatory = $true)][string]$Pdf, [switch]$Clean)
$ErrorActionPreference = 'Stop'
$api = 'http://localhost:5143/api'
$login = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -ContentType 'application/json' -Body (@{ email = 'e2e.test@intranet.local'; password = 'E2eTest!2026' } | ConvertTo-Json)
$tok = $login.token; if (-not $tok) { $tok = $login.accessToken }
$h = @{ Authorization = "Bearer $tok" }
$J = 'application/json'
$meName = (Invoke-RestMethod -Uri "$api/finance/creditors/users?search=e2e" -Headers $h | Select-Object -First 1).name

function Post($path, $body) { if ($null -eq $body) { return Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/$path" -Headers $h } ; return Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/$path" -Headers $h -ContentType $J -Body ($body | ConvertTo-Json) }
function Upload($id, $type, $itemId) {
  $bytes = [IO.File]::ReadAllBytes($Pdf); $rnd = [Guid]::NewGuid().ToByteArray(); [Array]::Copy($rnd, 0, $bytes, $bytes.Length - 16, 16)
  $boundary = [Guid]::NewGuid().ToString(); $LF = "`r`n"
  $head = "--$boundary$LF" + "Content-Disposition: form-data; name=`"docType`"$LF$LF$type$LF"
  if ($itemId) { $head += "--$boundary$LF" + "Content-Disposition: form-data; name=`"itemId`"$LF$LF$itemId$LF" }
  $head += "--$boundary$LF" + "Content-Disposition: form-data; name=`"file`"; filename=`"$type-$([Guid]::NewGuid().ToString('N').Substring(0,6)).pdf`"$LF" + "Content-Type: application/pdf$LF$LF"
  $ms = New-Object IO.MemoryStream
  $hb = [Text.Encoding]::ASCII.GetBytes($head); $ms.Write($hb, 0, $hb.Length); $ms.Write($bytes, 0, $bytes.Length); $tb = [Text.Encoding]::ASCII.GetBytes("$LF--$boundary--$LF"); $ms.Write($tb, 0, $tb.Length)
  return Invoke-RestMethod -Method Post -Uri "$api/finance/creditors/batches/$id/documents" -Headers $h -ContentType "multipart/form-data; boundary=$boundary" -Body $ms.ToArray()
}
function FillAllDocs($b) {
  foreach ($r in $b.requiredBatchDocs) { if (-not $r.filled) { $b = Upload $b.id $r.docType $null } }
  foreach ($it in $b.items) { foreach ($r in $it.required) { if (-not $r.filled) { $b = Upload $b.id $r.docType $it.id } } }
  return $b
}
function NewBatch($co, $type, $notes, $daysAgo) {
  $b = Post 'batches' @{ companyCode = $co; paymentType = $type; notes = "[DEMO] $notes"; batchDate = (Get-Date).AddDays(-$daysAgo).ToString('yyyy-MM-dd') }
  Write-Host "  $($b.batchNumber)  $co / $type" -NoNewline
  return $b
}
function AddItem($b, $name, $amt, $inv, $desc, $bank, $acc, $branch, $vat) {
  return Post "batches/$($b.id)/items" @{ supplierName = $name; amount = $amt; invoiceNumbers = $inv; description = $desc; bankName = $bank; accountNumber = $acc; branchCode = $branch; accountHolder = $name; supplierVatNumber = $vat; paymentReference = ($inv -split ',')[0].Trim() }
}
function Submit($b) { $b = FillAllDocs $b; return Post "batches/$($b.id)/submit" $null }
function AccApprove($b, $c) { return Post "batches/$($b.id)/accountant" @{ decision = 'approve'; comment = $c } }
function Decide($b, $i, $d, $c) { return Post "batches/$($b.id)/items/$($b.items[$i].id)/decision" @{ decision = $d; comment = $c } }
function ApproveAll($b) { for ($i = 0; $i -lt $b.items.Count; $i++) { $b = Decide $b $i 'Approved' $null }; return $b }
function Sign($b, $c) { return Post "batches/$($b.id)/sign" @{ typedName = $meName; comment = $c } }
function Status($b, $s) { return Post "batches/$($b.id)/status" @{ decision = $s } }
function Done($b) { Write-Host "  ->  $($b.status)" -ForegroundColor Green }

if ($Clean) {
  $all = Invoke-RestMethod -Uri "$api/finance/creditors/batches" -Headers $h
  foreach ($r in $all) {
    $d = Invoke-RestMethod -Uri "$api/finance/creditors/batches/$($r.id)" -Headers $h
    if (-not ("$($d.notes)".StartsWith('[DEMO]'))) { continue }
    if ($d.status -ne 'Draft') {
      # Locked / in-flight batches are deliberately undeletable through the API; demo rows are removed directly in SQL.
      $sql = "DECLARE @id INT = $($d.id); DELETE FROM PaymentBatchDocuments WHERE BatchId=@id; DELETE FROM PaymentBatchEvents WHERE BatchId=@id; DELETE FROM PaymentBatchItems WHERE BatchId=@id; DELETE FROM Signatures WHERE EntityType='PaymentBatch' AND EntityId=@id; DELETE FROM PaymentBatches WHERE Id=@id;"
      docker exec projecttracker-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YourStrong@Passw0rd' -C -d ProjectTrackerDB -Q $sql 2>&1 | Out-Null
      Write-Host "  deleted $($d.batchNumber) ($($d.status)) via SQL"; continue
    }
    Invoke-RestMethod -Method Delete -Uri "$api/finance/creditors/batches/$($r.id)" -Headers $h | Out-Null
    Write-Host "  deleted $($d.batchNumber)"
  }
  return
}

Write-Host "Seeding demo batches (signing as $meName)..."

# 1. Draft, nothing attached yet - shows "Add the payments / documents missing" guidance
$b = NewBatch 'PMT' 'DailyCreditor' 'Week 46 daily creditors' 0
$b = AddItem $b 'Medtronic SA (Pty) Ltd' 184250.00 'INV-88213, INV-88240' 'Pacemaker leads & consumables' 'FNB' '62012345678' '250655' '4120198765'
$b = AddItem $b 'B Braun Medical' 42310.50 'BB-55102' 'IV administration sets' 'Nedbank' '1189002233' '198765' '4530123456'
$b = AddItem $b 'Clicks Courier Services' 3850.00 'CCS-0917' 'Branch deliveries, Oct' 'Capitec' '1401234567' '470010' ''
$b = Upload $b.id 'PaymentSchedule' $null
$b = Upload $b.id 'TaxInvoice' $b.items[0].id
Done $b

# 2. Draft, fully documented and ready to submit
$b = NewBatch 'SAW' 'Utility' 'Nov utilities - head office' 0
$b = AddItem $b 'City of Johannesburg' 23870.14 'COJ-5512339988' 'Electricity & rates, Nov' 'Standard Bank' '000123456789' '051001' '4000123456'
$b = AddItem $b 'Telkom SA' 6120.00 'TLK-77120034' 'Fibre + voice, Nov' 'ABSA' '4071234567' '632005' '4280123456'
$b = FillAllDocs $b
Done $b

# 3. Submitted - with the accountant
$b = NewBatch 'ACM' 'MonthlyCreditor' 'October month-end creditors' 2
$b = AddItem $b 'Smith & Nephew SA' 312480.00 'SN-20311, SN-20388, SN-20402' 'Wound care, Oct statement' 'Standard Bank' '021456789' '051001' '4150123456'
$b = AddItem $b 'Dis-Chem Wholesale' 98650.25 'DCW-100233' 'OTC lines, Oct' 'FNB' '62987654321' '250655' '4870123456'
$b = AddItem $b 'Bidvest Waltons' 7430.00 'BW-5589012' 'Stationery, Oct' 'Nedbank' '1980012345' '198765' '4050123456'
$b = Submit $b
Done $b

# 4. Sent back by the accountant
$b = NewBatch 'SEY' 'DailyCreditor' 'Hikvision cameras - Sandton site' 3
$b = AddItem $b 'Hikvision Distribution SA' 56900.00 'HKV-33019' '12x dome cameras + NVR' 'FNB' '62555123456' '250655' '4910123456'
$b = Submit $b
if ($b.status -eq 'AwaitingAccountant') { $b = Post "batches/$($b.id)/accountant" @{ decision = 'query'; comment = 'Invoice total is R56 900 but the quote we approved was R52 400. Please get a credit note or explain the difference before I can approve.' } }
Done $b

# 5. With the director - accountant approved, decisions pending
$b = NewBatch 'PHC' 'DailyCreditor' 'Pharma suppliers - urgent, stock-out risk' 1
$b = AddItem $b 'Aspen Pharmacare' 421300.00 'ASP-991022, ASP-991087' 'Chronic meds replenishment' 'Standard Bank' '070012345' '051001' '4010123456'
$b = AddItem $b 'Adcock Ingram' 158720.40 'ADK-20771' 'Analgesics & cold/flu' 'ABSA' '4051239876' '632005' '4020123456'
$b = AddItem $b 'Cipla Medpro' 76210.00 'CIP-55120' 'Generics' 'Nedbank' '1123456789' '198765' '4030123456'
$b = Submit $b
if ($b.status -eq 'AwaitingAccountant') { $b = AccApprove $b 'Recon agrees to Sage. Aspen is above normal due to the stock-out last week.' }
Done $b

# 6. Sent back by the director with a query on one payment
$b = NewBatch 'NAT' 'DailyCreditor' 'IT hardware - laptops for new starters' 4
$b = AddItem $b 'Pinnacle Micro' 89400.00 'PIN-4410' '6x Dell Latitude 5540' 'FNB' '62111222333' '250655' '4140123456'
$b = AddItem $b 'Rectron' 15230.00 'REC-88710' 'Docking stations & monitors' 'Standard Bank' '011223344' '051001' '4160123456'
$b = Submit $b
if ($b.status -eq 'AwaitingAccountant') { $b = AccApprove $b 'OK from my side' }
if ($b.status -eq 'AwaitingDirector') { $b = Decide $b 0 'Queried' 'We only approved 4 laptops in the budget. Who are the other two for?'; $b = Decide $b 1 'Approved' $null; $b = Sign $b 'See query on Pinnacle' }
Done $b

# 7. Signed & locked - waiting for the bank user
$b = NewBatch 'SBT' 'Prepayment' 'Deposit on forklift - 50% upfront' 1
$b = AddItem $b 'Goscor Lift Trucks' 162500.00 'GLT-PF-2201' '50% deposit, Toyota 2.5t forklift' 'Standard Bank' '060987654' '051001' '4220123456'
$b = Submit $b
if ($b.status -eq 'AwaitingAccountant') { $b = AccApprove $b 'Quote and PO attached, deposit per supplier terms' }
if ($b.status -eq 'AwaitingDirector') { $b = ApproveAll $b; $b = Sign $b 'Approved - balance on delivery' }
Done $b

# 8. Loaded on the bank
$b = NewBatch 'RFT' 'Utility' 'Fuel cards & tolls, Oct' 5
$b = AddItem $b 'Engen Petroleum' 211340.60 'ENG-FC-1031' 'Fleet fuel cards, Oct' 'FNB' '62400112233' '250655' '4110123456'
$b = AddItem $b 'SANRAL e-toll' 18290.00 'ETC-2210-RFT' 'Gauteng e-tolls, Oct' 'ABSA' '4098765432' '632005' '4290123456'
$b = Submit $b
if ($b.status -eq 'AwaitingAccountant') { $b = AccApprove $b $null }
if ($b.status -eq 'AwaitingDirector') { $b = ApproveAll $b; $b = Sign $b $null }
if ($b.status -eq 'Approved') { Invoke-WebRequest -Uri "$api/finance/creditors/batches/$($b.id)/bank-file" -Headers $h -UseBasicParsing | Out-Null; $b = Status $b 'LoadedOnBank' }
Done $b

# 9. Paid - proof of payment still outstanding on one line
$b = NewBatch 'KOG' 'StaffPayment' 'Travel claims - October' 6
$b = AddItem $b 'T. Mokoena' 4820.00 'CLAIM-1022' 'Durban branch visit' 'Capitec' '1512345678' '470010' ''
$b = AddItem $b 'S. Naidoo' 2110.50 'CLAIM-1023' 'Client meetings, Pretoria' 'FNB' '62777888999' '250655' ''
$b = Submit $b
if ($b.status -eq 'AwaitingAccountant') { $b = AccApprove $b 'Claims checked against policy' }
if ($b.status -eq 'AwaitingDirector') { $b = ApproveAll $b; $b = Sign $b $null }
if ($b.status -eq 'Approved') { $b = Status $b 'LoadedOnBank'; $b = Status $b 'Paid'; $b = Upload $b.id 'ProofOfPayment' $b.items[0].id }
Done $b

# 10. Closed - full trail
$b = NewBatch 'SHK' 'Intercompany' 'Management fee Q3 - SHK to PMT' 12
$b = AddItem $b 'Promed Technologies' 250000.00 'IC-Q3-2026' 'Q3 management fee' 'Standard Bank' '001122334' '051001' '4100123456'
$b = Submit $b
if ($b.status -eq 'AwaitingAccountant') { $b = AccApprove $b 'Per intercompany agreement' }
if ($b.status -eq 'AwaitingDirector') { $b = ApproveAll $b; $b = Sign $b $null }
if ($b.status -eq 'Approved') { $b = Status $b 'LoadedOnBank'; $b = Status $b 'Paid'; foreach ($it in $b.items) { $b = Upload $b.id 'ProofOfPayment' $it.id }; $b = Status $b 'Closed' }
Done $b

Write-Host "`nDone. Open Finance -> Creditors. Remove with: .\tools\seed-creditors-demo.ps1 $Pdf -Clean"
