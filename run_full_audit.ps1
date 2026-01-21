$body='{"email":"welcome@promedtechnologies.co.za","password":"Kingsland2630"}'
$login=Invoke-RestMethod -Method Post -Uri "http://localhost:5143/api/auth/login" -Body $body -ContentType "application/json"
$token=$login.token
$h=@{"Authorization"="Bearer $token"}

$results = @()
$results += "=========================================="
$results += "    COMPREHENSIVE ENDPOINT AUDIT REPORT"
$results += "    Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$results += "=========================================="
$results += ""

# Core APIs
$results += "--- CORE APIS ---"
$core = @("/api/auth/login","/api/users","/api/users/1","/api/departments","/api/announcements","/api/todo","/api/meetings","/api/auditlogs","/api/extensions")
foreach($ep in $core) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# Attendance  
$results += ""
$results += "--- ATTENDANCE ---"
$att = @("/api/attendance/employees","/api/attendance/earliest-today","/api/attendance/metrics")
foreach($ep in $att) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# Messages
$results += ""
$results += "--- MESSAGES ---"
$msg = @("/api/messages/conversations","/api/messages/unread-count")
foreach($ep in $msg) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# Support Tickets
$results += ""
$results += "--- SUPPORT TICKETS ---"
$supp = @("/api/supporttickets")
foreach($ep in $supp) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# Profile
$results += ""
$results += "--- PROFILE ---"
$prof = @("/api/profile/1")
foreach($ep in $prof) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# Documents
$results += ""
$results += "--- DOCUMENTS ---"
$docs = @("/api/documents/departments")
foreach($ep in $docs) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# Knowledge Base
$results += ""
$results += "--- KNOWLEDGE BASE ---"
$kb = @("/api/knowledgebase/documents")
foreach($ep in $kb) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# Boards
$results += ""
$results += "--- BOARDS ---"
$boards = @("/api/boards")
foreach($ep in $boards) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# PBX
$results += ""
$results += "--- PBX ---"
$pbx = @("/api/pbx/status","/api/pbx/extension-status","/api/pbx/cdr","/api/pbx/active-calls")
foreach($ep in $pbx) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# Reports
$results += ""
$results += "--- REPORTS ---"
$rep = @("/api/reports/weekly","/api/reports/monthly")
foreach($ep in $rep) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# AI Chat
$results += ""
$results += "--- AI CHAT ---"
$ai = @("/api/aichat/models")
foreach($ep in $ai) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# Print
$results += ""
$results += "--- PRINT ---"
$print = @("/api/print/printers")
foreach($ep in $print) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# CRM
$results += ""
$results += "--- CRM ---"
$crm = @("/api/crm/dashboard","/api/crm/leads","/api/crm/campaigns","/api/crm/dispositions","/api/crm/promotions")
foreach($ep in $crm) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

# Logistics
$results += ""
$results += "--- LOGISTICS ---"
$logi = @("/api/fleet/vehicles","/api/fleet/drivers","/api/fleet/vehicle-types","/api/loads","/api/warehouses","/api/invoices","/api/maintenance","/api/maintenance/upcoming","/api/tracking/fleet-status","/api/tracking/active-loads")
foreach($ep in $logi) { try { Invoke-RestMethod -Uri "http://localhost:5143$ep" -Headers $h -TimeoutSec 10 | Out-Null; $results += "OK: $ep" } catch { $results += "FAIL: $ep" } }

$results | Out-File "FULL_AUDIT_REPORT.txt"
