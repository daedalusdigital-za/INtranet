$loginResp = Invoke-WebRequest -Uri "http://localhost:5143/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"welcome@promedtechnologies.co.za","password":"Kingsland2630"}' -UseBasicParsing
$token = ($loginResp.Content | ConvertFrom-Json).token

$resp = Invoke-WebRequest -Uri "http://localhost:5143/api/logistics/customers/address-issues?pageSize=10" -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing
$r = $resp.Content | ConvertFrom-Json

Write-Host "Total issues: $($r.totalCount)"
Write-Host "Customers returned: $($r.customers.Count)"
Write-Host ""

foreach ($c in $r.customers) {
    Write-Host "--- $($c.name) ($($c.customerCode)) ---"
    Write-Host "  Addr: $($c.address)"
    Write-Host "  PhysAddr: $($c.physicalAddress)"  
    Write-Host "  DelvAddr: $($c.deliveryAddress)"
    Write-Host "  City/DCity: $($c.city) / $($c.deliveryCity)"
    Write-Host "  Prov/DProv: $($c.province) / $($c.deliveryProvince)"
    Write-Host "  Lat/Lng: $($c.latitude) / $($c.longitude)"
    Write-Host "  Missing: addr=$($c.hasMissingAddress) city=$($c.hasMissingCity) prov=$($c.hasMissingProvince) gps=$($c.hasMissingCoordinates)"
    Write-Host ""
}
