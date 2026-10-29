param([string]$Tok)
# Seeds demo data for the client portal + logistics intranet demo.
# Client: welcome@rocketfreight.co.za / 1234
$ErrorActionPreference = 'Stop'
$API = 'http://localhost:5143/api'
$H = @{ Authorization = "Bearer $Tok" }
function J($o) { $o | ConvertTo-Json -Depth 8 -Compress }
function Post($u, $b, $h = $H) { try { Invoke-RestMethod -TimeoutSec 30 -Uri "$API/$u" -Method Post -Headers $h -ContentType 'application/json' -Body (J $b) } catch { $s=$_.Exception.Response.GetResponseStream(); $t=(New-Object IO.StreamReader($s)).ReadToEnd(); throw "POST $u -> $t" } }
function Get($u, $h = $H) { Invoke-RestMethod -TimeoutSec 30 -Uri "$API/$u" -Headers $h }

$p = Post 'portal/auth/login' @{ email = 'welcome@rocketfreight.co.za'; password = '1234' } @{}
$PH = @{ Authorization = "Bearer $($p.token)" }
Write-Host "client: $($p.user.name) / $($p.user.customerName)"
$me = @{ name = $p.user.name; email = 'welcome@rocketfreight.co.za'; phone = '021 404 9111' }

$pick = @{ label = 'Groote Schuur Pharmacy Stores'; street = 'Main Rd'; suburb = 'Observatory'; city = 'Cape Town'; province = 'Western Cape'; postalCode = '7925'; lat = -33.9410; lng = 18.4630; unit = ''; contactName = 'Stores Supervisor'; contactPhone = '021 404 9111' }
$dests = @(
  @{ label = 'Tygerberg Hospital'; street = 'Francie van Zijl Dr'; suburb = 'Parow'; city = 'Cape Town'; province = 'Western Cape'; postalCode = '7505'; lat = -33.9100; lng = 18.6110; unit = ''; contactName = 'Receiving'; contactPhone = '021 938 4911' },
  @{ label = 'Paarl Hospital'; street = 'Hospital St'; suburb = 'Paarl'; city = 'Paarl'; province = 'Western Cape'; postalCode = '7646'; lat = -33.7290; lng = 18.9690; unit = ''; contactName = 'Pharmacy'; contactPhone = '021 860 2500' },
  @{ label = 'Worcester Hospital'; street = 'Murray St'; suburb = 'Worcester'; city = 'Worcester'; province = 'Western Cape'; postalCode = '6850'; lat = -33.6460; lng = 19.4480; unit = ''; contactName = 'Dispatch'; contactPhone = '023 348 1100' },
  @{ label = 'George Hospital'; street = 'Davidson Rd'; suburb = 'George'; city = 'George'; province = 'Western Cape'; postalCode = '6529'; lat = -33.9630; lng = 22.4590; unit = ''; contactName = 'Receiving'; contactPhone = '044 802 4411' },
  @{ label = 'Caledon Hospital'; street = 'Hospital St'; suburb = 'Caledon'; city = 'Caledon'; province = 'Western Cape'; postalCode = '7230'; lat = -34.2290; lng = 19.4270; unit = ''; contactName = 'Sister in charge'; contactPhone = '028 212 1070' },
  @{ label = 'Hermanus Hospital'; street = 'Hospital St'; suburb = 'Hermanus'; city = 'Hermanus'; province = 'Western Cape'; postalCode = '7200'; lat = -34.4190; lng = 19.2340; unit = ''; contactName = 'Pharmacy'; contactPhone = '028 313 5200' },
  @{ label = 'Swellendam Hospital'; street = 'Drostdy St'; suburb = 'Swellendam'; city = 'Swellendam'; province = 'Western Cape'; postalCode = '6740'; lat = -34.0220; lng = 20.4430; unit = ''; contactName = 'Receiving'; contactPhone = '028 514 1140' }
)
$pickId = (Post 'portal/addresses' $pick $PH).id
foreach ($d in $dests) { try { Post 'portal/addresses' $d $PH | Out-Null } catch {} }

$today = (Get-Date).Date
function Book($dest, $ref, $cargo, $dayOffset, $notes) {
  $cd = $today.AddDays([Math]::Max(0, $dayOffset))
  $req = @{ clientReference = $ref; requestedBy = $me; shipments = @(
      @{ pickup = @{ addressId = $pickId }; delivery = @{ address = $dest }; collectionDate = $cd.ToString('yyyy-MM-dd'); deliverBy = $cd.AddDays(1).ToString('yyyy-MM-dd'); windowFrom = '08:00'; windowTo = '16:00'; cargo = @($cargo); fragile = $true; hazardous = $false; specialInstructions = $(if($notes){$notes}else{'Call ahead on arrival.'}) }) }
  $r = Post 'portal/bookings' $req $PH
  Write-Host "  booked $($r.bookingNo) -> $($dest.label)"
  return [int]$r.shipmentIds[0]
}
function Pal($q, $w, $d) { ,@(@{ type = 'pallet'; qty = $q; weightKg = $w; lengthCm = 120; widthCm = 100; heightCm = 110; description = $d }) }
function Par($q, $w, $d) { ,@(@{ type = 'parcel'; qty = $q; weightKg = $w; lengthCm = 40; widthCm = 30; heightCm = 30; description = $d }) }
function Confirm($ids) { foreach ($s in $ids) { Post "logistics/portal/waybills/$s/confirm" @{} | Out-Null } }
function Scan($code, $type) { Post 'logistics/driver/scans' @{ scanId = [guid]::NewGuid().ToString(); type = $type; code = $code; latitude = -33.94; longitude = 18.46 } | Out-Null }
function WB($s) { (Get "logistics/shipments/$s").shipment.waybillNo }

Write-Host 'Awaiting confirmation (BOOKED):'
Book $dests[0] 'GSH-PO-10421' (Pal 2 180 'Chronic medication - cold chain') 1 'Keep refrigerated 2-8C. Deliver before 10:00.' | Out-Null
Book $dests[1] 'GSH-PO-10422' (Par 6 8 'Surgical consumables') 1 '' | Out-Null
Book $dests[2] 'GSH-PO-10423' (Pal 1 240 'IV fluids') 2 'Forklift available at delivery.' | Out-Null

Write-Host 'Confirmed, awaiting planning:'
$c1 = Book $dests[3] 'GSH-PO-10415' (Pal 3 300 'Theatre packs') 0 ''
$c2 = Book $dests[4] 'GSH-PO-10416' (Par 12 5 'Lab reagents') 0 'Fragile glassware.'
Confirm @($c1, $c2)

Write-Host 'Rejected example:'
$r1 = Book $dests[5] 'GSH-PO-10410' (Pal 1 90 'Oxygen cylinders') 0 ''
Post "logistics/portal/waybills/$r1/reject" @{ reason = 'Hazardous goods (compressed gas) require a dangerous-goods booking. Please rebook with the DG declaration attached.' } | Out-Null

$l = Get 'logistics/loads'; $items = if ($l.items) { $l.items } else { $l }
$loads = @($items | Where-Object { $_.status -eq 'Assigned' } | Select-Object -First 3)
if ($loads.Count -lt 3) { throw "need 3 Assigned loads, found $($loads.Count)" }
Write-Host "Using loads: $(($loads | ForEach-Object { $_.loadNumber }) -join ', ')"

Write-Host 'Active tripsheets (planned / collected / in transit):'
$a1 = Book $dests[0] 'GSH-PO-10401' (Pal 2 200 'Dialysis consumables') 0 ''
$a2 = Book $dests[1] 'GSH-PO-10402' (Par 4 10 'Vaccines - cold chain') 0 'Cold chain.'
$a3 = Book $dests[6] 'GSH-PO-10403' (Pal 1 150 'Linen') 0 ''
Confirm @($a1, $a2, $a3)
Post "logistics/loads/$($loads[0].id)/shipments" @{ shipmentIds = @($a1, $a2); createStops = $true } | Out-Null
Post "logistics/loads/$($loads[1].id)/shipments" @{ shipmentIds = @($a3); createStops = $true } | Out-Null
Scan (WB $a2) 'collect'
Scan (WB $a3) 'collect'
Post "logistics/shipments/$a3/transition?to=IN_TRANSIT" @{ note = 'Departed Observatory' } | Out-Null
Write-Host "  $(WB $a1) WAYBILL_ISSUED, $(WB $a2) COLLECTED on $($loads[0].loadNumber); $(WB $a3) IN_TRANSIT on $($loads[1].loadNumber)"

Write-Host 'Delivered (inactive) with POD:'
$d1 = Book $dests[2] 'GSH-PO-10388' (Pal 2 210 'Pharmaceuticals') 0 ''
$d2 = Book $dests[3] 'GSH-PO-10389' (Par 8 6 'PPE') 0 ''
Confirm @($d1, $d2)
Post "logistics/loads/$($loads[2].id)/shipments" @{ shipmentIds = @($d1, $d2); createStops = $true } | Out-Null
$sig = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
foreach ($s in @($d1, $d2)) {
  $wb = WB $s
  Scan $wb 'collect'
  Post "logistics/shipments/$s/transition?to=IN_TRANSIT" @{} | Out-Null
  $payload = J @{ scanId = [guid]::NewGuid().ToString(); type = 'deliver'; code = $wb; receiverName = 'Sr. N. Dlamini'; note = 'Received in good order'; latitude = -33.65; longitude = 19.45; signatureBase64 = $sig }
  $bnd = [guid]::NewGuid().ToString(); $LF = "`r`n"
  $body = "--$bnd$LF" + "Content-Disposition: form-data; name=`"payload`"$LF$LF$payload$LF--$bnd--$LF"
  Invoke-RestMethod -TimeoutSec 30 -Uri "$API/logistics/driver/pod" -Method Post -Headers $H -ContentType "multipart/form-data; boundary=$bnd" -Body $body | Out-Null
  Write-Host "  $wb DELIVERED"
}

Write-Host 'Support chat:'
Post 'portal/support/thread/messages' @{ text = "Hi, can you confirm GSH-PO-10421 will be collected before 10:00 tomorrow? It's cold-chain stock." } $PH | Out-Null
Post "logistics/portal/support/$($p.user.id)/reply" @{ text = 'Hi Thandi - yes, the driver is scheduled for 08:30 at Observatory. We will keep it on the fridge truck.' } | Out-Null
Post 'portal/support/thread/messages' @{ text = 'Perfect, thank you!' } $PH | Out-Null

Write-Host 'DONE. Summary:'; J (Get 'logistics/portal/summary')
