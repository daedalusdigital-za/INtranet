param([string]$Tok)
$ErrorActionPreference = 'Stop'
$B = 'http://localhost:5143/api'
$H = @{ Authorization = "Bearer $Tok" }
$script:fail = 0
function Step($name, [scriptblock]$fn) {
  try { $r = & $fn; Write-Host ("PASS  {0}  {1}" -f $name, $r) -ForegroundColor Green; return $r }
  catch { $script:fail++; $msg = $_.Exception.Message; try { $msg += ' ' + ($_.ErrorDetails.Message) } catch {}; Write-Host ("FAIL  {0}  {1}" -f $name, $msg) -ForegroundColor Red }
}
function Or($a, $b) { if ($null -ne $a -and $a -ne '') { $a } else { $b } }
function J($o) { $o | ConvertTo-Json -Depth 10 -Compress }
function Get($u, $h = $H) { Invoke-RestMethod -TimeoutSec 20 -Uri "$B/$u" -Headers $h }
function Post($u, $body, $h = $H) { Invoke-RestMethod -TimeoutSec 20 -Uri "$B/$u" -Method Post -Headers $h -ContentType 'application/json' -Body (J $body) }
function Put($u, $body, $h = $H) { Invoke-RestMethod -TimeoutSec 20 -Uri "$B/$u" -Method Put -Headers $h -ContentType 'application/json' -Body (J $body) }
function Pdf($u, $h = $H) { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Uri "$B/$u" -Headers $h; if ($r.Headers['Content-Type'] -notlike 'application/pdf*') { throw "not pdf: $($r.Headers['Content-Type'])" }; $b = $r.Content; if ($b.Length -lt 1000) { throw "pdf too small $($b.Length)" }; $s=[Text.Encoding]::ASCII.GetString($b[0..4]); if ($s -ne '%PDF-') { throw "bad magic $s" }; "pdf $($b.Length) bytes" }

Write-Host "`n=== INTRANET SIDE: setup ===" -ForegroundColor Cyan
Step 'clients list' { $c = Get 'logistics/bookings/clients'; if (-not $c.Count) { throw 'no clients' }; "count=$($c.Count)"; $script:clients = $c }
$cust = $script:clients | Where-Object { $_.name -notlike "*MISSING*" } | Select-Object -First 1
Write-Host "   using customer: $($cust.id) $($cust.name)"

$email = "e2e.portal.$(Get-Random)@rocketfreight.test"
Step 'ops: create portal login' { $u = Post 'logistics/portal/users' @{ customerId = $cust.id; name = 'E2E Portal Client'; email = $email; password = 'Portal!2026'; role = 'admin' }; $script:pu = $u.user; if (-not $u.user.id) { throw 'no user id' }; "id=$($u.user.id) email=$email" }
Step 'ops: list portal users contains new' { $l = Get 'logistics/portal/users'; if (-not ($l | Where-Object { $_.email -eq $email })) { throw 'missing' }; 'ok' }
Step 'ops: portal summary' { $s = Get 'logistics/portal/summary'; J $s }

Write-Host "`n=== CLIENT SIDE: portal API (what the Angular portal calls) ===" -ForegroundColor Cyan
Step 'portal: wrong password -> 401' { try { Post 'portal/auth/login' @{ email = $email; password = 'nope' } @{}; throw 'should have failed' } catch { if ($_.Exception.Response.StatusCode.value__ -ne 401) { throw }; '401 ok' } }
Step 'portal: login' { $r = Post 'portal/auth/login' @{ email = $email; password = 'Portal!2026' } @{}; if (-not $r.token) { throw 'no token' }; $script:PH = @{ Authorization = "Bearer $($r.token)" }; "user=$($r.user.name) customer=$($r.user.customerName)" }
$PH = $script:PH
Step 'portal token rejected on intranet endpoint' { try { Get 'logistics/portal/summary' $PH; throw 'should be 401' } catch { if ($_.Exception.Response.StatusCode.value__ -notin 401,403) { throw }; 'blocked ok' } }
Step 'portal: me' { $m = Get 'portal/me' $PH; "name=$($m.name) email=$($m.email)" }
Step 'portal: shipments/counts' { J (Get 'portal/shipments/counts' $PH) }
Step 'portal: notification prefs get' { J (Get 'portal/settings/notifications' $PH) }
Step 'portal: notification prefs save' { $p = Put 'portal/settings/notifications' @{ email = @{ booked = $true; delivered = $true }; sms = @{ delivered = $true } } $PH; 'saved' }

$today = (Get-Date).ToString('yyyy-MM-dd'); $tmr = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
$addrA = @{ label = 'E2E Warehouse'; street = '7 Electron Ave'; unit = ''; suburb = 'Isando'; city = 'Kempton Park'; province = 'Gauteng'; postalCode = '1600'; contactName = 'Warehouse'; contactPhone = '0110000000'; lat = -26.14; lng = 28.2 }
$addrB = @{ label = 'E2E Customer'; street = '15 Montague Dr'; unit = ''; suburb = 'Montague Gardens'; city = 'Cape Town'; province = 'Western Cape'; postalCode = '7441'; contactName = 'Receiving'; contactPhone = '0210000000'; lat = -33.86; lng = 18.52 }
Step 'portal: save address to address book' { $a = Post 'portal/addresses' $addrA $PH; $script:savedId = $a.id; "id=$($a.id)" }
Step 'portal: list addresses' { $l = Get 'portal/addresses' $PH; if (-not ($l | Where-Object { $_.id -eq $script:savedId })) { throw 'not listed' }; "count=$($l.Count)" }

$cargo = @(@{ type = 'pallet'; qty = 2; weightKg = 120; lengthCm = 120; widthCm = 100; heightCm = 110; description = 'E2E pharma pallets' })
$badReq = @{ clientReference = 'E2E-BAD'; requestedBy = @{ name = ''; email = 'bad' }; shipments = @(@{ pickup = @{ addressId = $script:savedId }; delivery = @{ address = $addrB }; collectionDate = '2020-01-01'; deliverBy = '2019-01-01'; cargo = @() }) }
Step 'portal: validate rejects bad booking (ok=false w/ problems)' { $v = Post 'portal/bookings/validate' $badReq $PH; if ($v.ok) { throw 'ok should be false' }; if (-not $v.problems.Count) { throw 'no problems list' }; "problems=$($v.problems.Count) e.g. '$($v.problems[0].path): $($v.problems[0].message)'" }

$goodReq = @{ clientReference = 'E2E-PO-' + (Get-Random -Max 9999); requestedBy = @{ name = 'E2E Portal Client'; email = $email; phone = '0820000000' }
  shipments = @(
    @{ pickup = @{ addressId = $script:savedId }; delivery = @{ address = $addrB }; collectionDate = $today; deliverBy = $tmr; windowFrom = '08:00'; windowTo = '16:00'; cargo = $cargo; fragile = $true; hazardous = $false; specialInstructions = 'E2E test --- call ahead' },
    @{ pickup = @{ address = $addrA }; delivery = @{ address = $addrB }; collectionDate = $today; deliverBy = $tmr; cargo = @(@{ type = 'parcel'; qty = 3; weightKg = 4.5; description = 'E2E parcels' }) }
  ) }
Step 'portal: validate good booking' { $v = Post 'portal/bookings/validate' $goodReq $PH; if (-not $v.ok) { throw ("problems: " + (($v.problems | ForEach-Object { $_.message }) -join ' | ')) }; 'ok=true' }
Step 'portal: place booking (201)' { $r = Post 'portal/bookings' $goodReq $PH; if (-not $r.bookingNo) { throw 'no bookingNo' }; if ($r.shipmentIds.Count -ne 2) { throw "shipmentIds=$($r.shipmentIds.Count)" }; $script:bk = $r; "bookingNo=$($r.bookingNo) shipmentIds=$($r.shipmentIds -join ',')" }
$bk = $script:bk
$ship1 = @{ id = $bk.shipmentIds[0] }; $ship2 = @{ id = $bk.shipmentIds[1] }
Step 'portal: shipments list shows BOOKED' { $l = Get 'portal/shipments?filter=active' $PH; $items = if ($l.items) { $l.items } else { $l }; $hit = $items | Where-Object { $_.id -eq $ship1.id }; if (-not $hit) { throw 'missing' }; "status=$($hit.status)" }
Step 'portal: shipment detail' { $d = Get "portal/shipments/$($ship1.id)" $PH; "status=$($d.status) events=$($d.events.Count) ref=$(Or $d.reference $d.waybillNo)" }
Step 'portal: cancel 2nd shipment while BOOKED' { $c = Post "portal/shipments/$($ship2.id)/cancel" @{ reason = 'E2E cancel' } $PH; "status=$($c.status)" }

Write-Host "`n=== INTRANET SIDE: Overberg Tripsheets tab ===" -ForegroundColor Cyan
Step 'ops: pending shows portal booking' { $p = Get 'logistics/portal/pending'; $hit = $p | Where-Object { $_.bookingNo -eq $bk.bookingNo }; if (-not $hit) { throw 'booking not pending' }; "waybills=$($hit.waybills.Count)" }
Step 'ops: confirm waybill 1' { $r = Post "logistics/portal/waybills/$($ship1.id)/confirm" @{}; "status=$(Or $r.status "ok")" }
Step 'portal: client sees CONFIRMED' { $d = Get "portal/shipments/$($ship1.id)" $PH; if ($d.status -ne 'CONFIRMED') { throw "status=$($d.status)" }; 'CONFIRMED' }
# re-book a fresh shipment for the rest of the flow since cancel may have succeeded
Step 'portal: place second booking for lifecycle' { $r = Post 'portal/bookings' $goodReq $PH; $script:bk2 = $r; "bookingNo=$($r.bookingNo)" }
$sid = $script:bk2.shipmentIds[0]
Step 'ops: confirm lifecycle waybill' { Post "logistics/portal/waybills/$sid/confirm" @{} | Out-Null; 'ok' }
Step 'ops: reject other waybill with reason' { $r = Post "logistics/portal/waybills/$($script:bk2.shipmentIds[1])/reject" @{ reason = 'E2E: duplicate' }; 'ok' }
Step 'portal: rejected shows reason' { $d = Get "portal/shipments/$($script:bk2.shipmentIds[1])" $PH; if ($d.status -ne 'REJECTED') { throw $d.status }; "problem='$($d.problem)' canCancel=$($d.canCancel)" }

Write-Host "`n=== INTRANET SIDE: plan onto load, waybill + barcodes ===" -ForegroundColor Cyan
Step 'ops: client bookings queue includes portal source' { $q = Get 'logistics/bookings?source=portal'; $items = if ($q.items) { $q.items } else { $q }; "rows=$($items.Count)" }
Step 'ops: shipment detail + allowed transitions' { $d = Get "logistics/shipments/$sid"; $script:det = $d; "status=$($d.shipment.status) transitions=$($d.allowedTransitions -join ',')" }
Step 'ops: find/create a load to plan onto' {
  $l = Get 'logistics/loads'; $items = if ($l.items) { $l.items } else { $l }
  $open = $items | Where-Object { $_.status -in 'Planned','Draft','PLANNED','Open','Scheduled' } | Select-Object -First 1
  if (-not $open) { $open = $items | Select-Object -First 1 }
  if (-not $open) { throw 'no loads exist to plan onto' }
  $script:load = $open; "load=$(Or $open.loadNumber $open.id) status=$($open.status)"
}
Step 'ops: plan shipment onto load (issues waybill)' { $r = Post "logistics/loads/$($script:load.id)/shipments" @{ shipmentIds = @($sid); createStops = $true }; "load=$($r.loadNumber) warnings=$($r.warnings.Count) status=$($r.shipments[0].status)" }
Step 'ops: waybill issued' { $d = Get "logistics/shipments/$sid"; if (-not $d.shipment.waybillNo) { throw "no waybill; status=$($d.shipment.status)" }; $script:wb = @{ waybillNo = $d.shipment.waybillNo; barcodeValue = $d.shipment.waybillNo; trackingToken = $d.shipment.trackingToken }; "waybillNo=$($d.shipment.waybillNo) status=$($d.shipment.status) token=$($d.shipment.trackingToken)" }
Step 'ops: waybill PDF' { Pdf "logistics/waybills/$($script:wb.waybillNo)/pdf" }
Step 'ops: label PDF (Code128 + QR per item)' { Pdf "logistics/waybills/$($script:wb.waybillNo)/label" }
Step 'items have barcodes' { $d = Get "logistics/shipments/$sid"; $missing = $d.shipment.items | Where-Object { -not $_.itemBarcode }; if ($missing) { throw 'items without barcode' }; ($d.shipment.items | ForEach-Object { $_.itemBarcode }) -join ',' }
Step 'ops: Overberg tripsheets view lists load with portal waybill' { $t = Get 'logistics/portal/tripsheets?status=all'; $hit = $t | Where-Object { ($_.waybills | ForEach-Object { $_.waybillNo }) -contains $script:wb.waybillNo }; if (-not $hit) { throw "not listed (rows=$($t.Count))" }; "tripsheet=$(Or $hit.tripsheetNo $hit.loadNumber) waybills=$($hit.waybills.Count)" }

Write-Host "`n=== CLIENT SIDE: documents + public tracking ===" -ForegroundColor Cyan
function Local($url) { $url -replace '^https?://[^/]+', 'http://localhost:5143' }
Step 'portal: waybill doc url' { $u = Get "portal/shipments/$sid/documents/waybill" $PH; if (-not $u.url) { throw 'no url' }; $script:wurl = Local $u.url; $u.url }
Step 'portal: waybill url downloads without login (signed)' { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Uri $script:wurl; if ($r.Headers['Content-Type'] -notlike 'application/pdf*') { throw $r.Headers['Content-Type'] }; "pdf $($r.Content.Length) bytes" }
Step 'portal: tampered signed url rejected' { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Uri ($script:wurl.Substring(0, $script:wurl.Length - 4) + 'xxxx') | Out-Null; throw 'should fail' } catch { if ($_.Exception.Response.StatusCode.value__ -notin 400,401,403,404) { throw }; "$($_.Exception.Response.StatusCode.value__) ok" } }
Step 'portal: labels doc url' { $u = Get "portal/shipments/$sid/documents/labels" $PH; $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Uri (Local $u.url); "pdf $($r.Content.Length) bytes" }
Step 'portal: detail has tracking url (same as waybill QR)' { $d = Get "portal/shipments/$sid" $PH; if (-not $d.trackingUrl) { throw 'no trackingUrl' }; if ($d.trackingUrl -match '/t/t/') { throw "doubled path: $($d.trackingUrl)" }; $script:turl = $d.trackingUrl; $d.trackingUrl }
Step 'public tracking API (anonymous, no token)' { $tok = ($script:turl -split '/')[-1]; $r = Invoke-RestMethod -TimeoutSec 20 -Uri "$B/t/$tok"; "status=$($r.status) waybill=$($r.waybillNo)" }

Write-Host "`n=== DRIVER SIDE: scan + POD, then client sees it ===" -ForegroundColor Cyan
Step 'driver: scan waybill barcode -> COLLECTED' { $r = Post 'logistics/driver/scans' @{ scanId = [guid]::NewGuid().ToString(); type = 'collect'; code = $script:wb.barcodeValue; latitude = -26.14; longitude = 28.2 }; if ($r.result -ne 'applied') { throw (J $r) }; "result=$($r.result) status=$($r.status)" }
Step 'driver: duplicate scan is idempotent' { $g = [guid]::NewGuid().ToString(); Post 'logistics/driver/scans' @{ scanId = $g; type = 'collect'; code = $script:wb.barcodeValue } | Out-Null; $r = Post 'logistics/driver/scans' @{ scanId = $g; type = 'collect'; code = $script:wb.barcodeValue }; "result=$($r.result)" }
Step 'driver: scan item barcode resolves same shipment' { $d = Get "logistics/shipments/$sid"; $code = $d.shipment.items[0].itemBarcode; $r = Get "logistics/shipments/resolve?code=$code"; if ($r.id -ne $sid -and $r.shipmentId -ne $sid) { throw (J $r) }; "item $code -> shipment $sid" }
Step 'ops: mark in transit' { $r = Post "logistics/shipments/$sid/transition?to=IN_TRANSIT" @{ note = 'E2E manual' }; "status=$($r.status)" }
Step 'portal: client sees IN_TRANSIT + tracking' { $d = Get "portal/shipments/$sid" $PH; if ($d.status -notin 'IN_TRANSIT','COLLECTED') { throw $d.status }; "status=$($d.status) tracking=$(if($d.tracking){'yes'}else{'n/a (no vehicle position)'})" }
Step 'driver: POD (multipart with signature)' {
  $payload = J @{ scanId = [guid]::NewGuid().ToString(); type = 'deliver'; code = $script:wb.barcodeValue; receiverName = 'E2E Receiver'; note = 'left at reception'; latitude = -33.86; longitude = 18.52; signatureBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' }
  $boundary = [guid]::NewGuid().ToString(); $LF = "`r`n"
  $body = "--$boundary$LF" + "Content-Disposition: form-data; name=`"payload`"$LF$LF$payload$LF--$boundary--$LF"
  $r = Invoke-RestMethod -TimeoutSec 20 -Uri "$B/logistics/driver/pod" -Method Post -Headers $H -ContentType "multipart/form-data; boundary=$boundary" -Body $body
  if ($r.result -ne 'applied') { throw (J $r) }; "result=$($r.result) status=$($r.status)" }
Step 'portal: DELIVERED + POD pdf' { $d = Get "portal/shipments/$sid" $PH; if ($d.status -ne 'DELIVERED') { throw $d.status }; if (-not $d.pod.receiverName) { throw 'no pod block' }; $u = Get "portal/shipments/$sid/documents/pod" $PH; $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Uri (Local $u.url); "DELIVERED by '$($d.pod.receiverName)', signature=$(if($d.pod.signatureUrl){'yes'}else{'no'}), pod pdf $($r.Content.Length) bytes" }
Step 'portal: POD signature image downloads anonymously' { $d = Get "portal/shipments/$sid" $PH; if (-not $d.pod.signatureUrl) { throw 'no signatureUrl' }; $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Uri (Local $d.pod.signatureUrl); "$($r.Headers['Content-Type']) $($r.Content.Length) bytes" }
Step 'ops: POD pdf' { Pdf "logistics/shipments/$sid/pod/pdf" }
Step 'ops: PODs list shows portal POD' { $l = Get 'logistics/bookings?status=DELIVERED&source=portal'; $items = if ($l.items) { $l.items } else { $l }; "delivered portal rows=$($items.Count)" }
Step 'portal: counts delivered>0' { $c = Get 'portal/shipments/counts' $PH; J $c }

Write-Host "`n=== SUPPORT CHAT both sides ===" -ForegroundColor Cyan
Step 'portal: thread' { $t = Get 'portal/support/thread' $PH; "hours='$($t.hours)' agentOnline=$($t.agentOnline)" }
Step 'portal: client sends message' { $m = Post 'portal/support/thread/messages' @{ text = 'E2E: where is my pallet?'; shipmentId = $sid } $PH; $script:mid = $m.id; "id=$($m.id)" }
Step 'ops: support threads list' { $l = Get 'logistics/portal/support'; $hit = $l | Where-Object { $_.portalUserId -eq $script:pu.id }; if (-not $hit) { throw 'thread missing' }; "unread=$(Or $hit.unread $hit.unreadCount)" }
Step 'ops: reply' { Post "logistics/portal/support/$($script:pu.id)/reply" @{ text = 'E2E agent: on its way' } | Out-Null; 'ok' }
Step 'portal: poll after=id gets agent reply' { $n = Get "portal/support/thread/messages?after=$($script:mid)" $PH; $a = $n | Where-Object { $_.from -eq 'agent' }; if (-not $a) { throw 'no agent reply' }; "'$($a[0].text)'" }

Write-Host "`n=== ACCOUNT ===" -ForegroundColor Cyan
Step 'portal: change password' { Post 'portal/auth/change-password' @{ currentPassword = 'Portal!2026'; newPassword = 'Portal!2027' } $PH | Out-Null; $r = Post 'portal/auth/login' @{ email = $email; password = 'Portal!2027' } @{}; if (-not $r.token) { throw }; 'relogin ok' }
Step 'ops: reset password' { $r = Post "logistics/portal/users/$($script:pu.id)/reset-password?sendEmail=false" @{}; $tmp = Or $r.password $r.temporaryPassword; if (-not $tmp) { throw 'no temp password returned' }; $l = Post 'portal/auth/login' @{ email = $email; password = $tmp } @{}; if (-not $l.token) { throw 'temp login failed' }; "mustChange=$($l.user.mustChangePassword)" }
Step 'ops: deactivate -> login blocked' { Put "logistics/portal/users/$($script:pu.id)" @{ isActive = $false } | Out-Null; try { Post 'portal/auth/login' @{ email = $email; password = 'Portal!2027' } @{}; throw 'should fail' } catch { if ($_.Exception.Response.StatusCode.value__ -notin 401,403) { throw }; 'blocked' } }

Write-Host "`n=== RESULT: $($script:fail) failure(s) ===" -ForegroundColor $(if ($script:fail) { 'Red' } else { 'Green' })




