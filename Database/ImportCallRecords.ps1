# ImportCallRecords.ps1 - Bulk import PBX call records from CSV files
# Uses SqlBulkCopy for high-performance insertion

param(
    [string]$Server = "localhost,1433",
    [string]$Database = "ProjectTrackerDB",
    [string]$User = "sa",
    [string]$Password = "YourStrong@Passw0rd",
    [string]$CsvFolder = "$PSScriptRoot\..\docs\Master"
)

$connectionString = "Server=$Server;Database=$Database;User Id=$User;Password=$Password;TrustServerCertificate=True;Connection Timeout=120"

# Get all CSV files sorted by name (chronological)
$csvFiles = Get-ChildItem -Path $CsvFolder -Filter "*.csv" | Sort-Object Name
Write-Host "Found $($csvFiles.Count) CSV files to import" -ForegroundColor Cyan

$totalImported = 0
$totalSkipped = 0

foreach ($file in $csvFiles) {
    Write-Host "`nProcessing: $($file.Name)" -ForegroundColor Yellow
    
    # Read CSV
    $records = Import-Csv -Path $file.FullName
    Write-Host "  Rows in file: $($records.Count)"
    
    if ($records.Count -eq 0) {
        Write-Host "  Skipping empty file" -ForegroundColor Gray
        continue
    }
    
    # Create DataTable matching the CallRecords schema
    $dataTable = New-Object System.Data.DataTable
    $dataTable.Columns.Add("AccountCode", [string]) | Out-Null
    $dataTable.Columns.Add("CallerNumber", [string]) | Out-Null
    $dataTable.Columns.Add("CallerNat", [string]) | Out-Null
    $dataTable.Columns.Add("CalleeNumber", [string]) | Out-Null
    $dataTable.Columns.Add("CalleeNat", [string]) | Out-Null
    $dataTable.Columns.Add("Context", [string]) | Out-Null
    $dataTable.Columns.Add("CallerId", [string]) | Out-Null
    $dataTable.Columns.Add("SourceChannel", [string]) | Out-Null
    $dataTable.Columns.Add("DestChannel", [string]) | Out-Null
    $dataTable.Columns.Add("LastApp", [string]) | Out-Null
    $dataTable.Columns.Add("LastData", [string]) | Out-Null
    $dataTable.Columns.Add("StartTime", [DateTime]) | Out-Null
    $dataTable.Columns.Add("AnswerTime", [DateTime]) | Out-Null
    $dataTable.Columns["AnswerTime"].AllowDBNull = $true
    $dataTable.Columns.Add("EndTime", [DateTime]) | Out-Null
    $dataTable.Columns["EndTime"].AllowDBNull = $true
    $dataTable.Columns.Add("CallTime", [int]) | Out-Null
    $dataTable.Columns.Add("TalkTime", [int]) | Out-Null
    $dataTable.Columns.Add("CallStatus", [string]) | Out-Null
    $dataTable.Columns.Add("AmaFlags", [string]) | Out-Null
    $dataTable.Columns.Add("UniqueId", [string]) | Out-Null
    $dataTable.Columns.Add("CallType", [string]) | Out-Null
    $dataTable.Columns.Add("DestChannelExtension", [string]) | Out-Null
    $dataTable.Columns.Add("CallerName", [string]) | Out-Null
    $dataTable.Columns.Add("AnsweredBy", [string]) | Out-Null
    $dataTable.Columns.Add("Session", [string]) | Out-Null
    $dataTable.Columns.Add("PremierCaller", [string]) | Out-Null
    $dataTable.Columns.Add("ActionType", [string]) | Out-Null
    $dataTable.Columns.Add("SourceTrunkName", [string]) | Out-Null
    $dataTable.Columns.Add("DestinationTrunkName", [string]) | Out-Null
    
    $skipped = 0
    foreach ($r in $records) {
        # Parse StartTime - skip if invalid
        $startTime = $null
        if (-not [DateTime]::TryParse($r.'Start Time', [ref]$startTime)) {
            $skipped++
            continue
        }
        
        # Skip if no caller or callee
        $callerNum = if ($r.'Caller Number') { $r.'Caller Number'.Trim() } else { '' }
        $calleeNum = if ($r.'Callee Number') { $r.'Callee Number'.Trim() } else { '' }
        if ([string]::IsNullOrWhiteSpace($callerNum) -or [string]::IsNullOrWhiteSpace($calleeNum)) {
            $skipped++
            continue
        }
        
        $row = $dataTable.NewRow()
        $row["AccountCode"] = if ($r.'Account Code') { $r.'Account Code'.Trim() } else { [DBNull]::Value }
        $row["CallerNumber"] = $callerNum
        $row["CallerNat"] = if ($r.'Caller NAT') { $r.'Caller NAT'.Trim() } else { [DBNull]::Value }
        $row["CalleeNumber"] = $calleeNum
        $row["CalleeNat"] = if ($r.'Callee NAT') { $r.'Callee NAT'.Trim() } else { [DBNull]::Value }
        $row["Context"] = if ($r.'Context') { $r.'Context'.Trim() } else { [DBNull]::Value }
        $row["CallerId"] = if ($r.'Caller ID') { $r.'Caller ID'.Substring(0, [Math]::Min($r.'Caller ID'.Length, 500)) } else { [DBNull]::Value }
        $row["SourceChannel"] = if ($r.'Source Channel') { $r.'Source Channel'.Substring(0, [Math]::Min($r.'Source Channel'.Length, 200)) } else { [DBNull]::Value }
        $row["DestChannel"] = if ($r.'Dest. Channel') { $r.'Dest. Channel'.Substring(0, [Math]::Min($r.'Dest. Channel'.Length, 200)) } else { [DBNull]::Value }
        $row["LastApp"] = if ($r.'Last app.') { $r.'Last app.'.Substring(0, [Math]::Min($r.'Last app.'.Length, 100)) } else { [DBNull]::Value }
        $row["LastData"] = if ($r.'Last data') { $r.'Last data'.Substring(0, [Math]::Min($r.'Last data'.Length, 500)) } else { [DBNull]::Value }
        $row["StartTime"] = $startTime
        
        $answerTime = $null
        if ([DateTime]::TryParse($r.'Answer Time', [ref]$answerTime)) {
            $row["AnswerTime"] = $answerTime
        } else {
            $row["AnswerTime"] = [DBNull]::Value
        }
        
        $endTime = $null
        if ([DateTime]::TryParse($r.'End Time', [ref]$endTime)) {
            $row["EndTime"] = $endTime
        } else {
            $row["EndTime"] = [DBNull]::Value
        }
        
        $callTime = 0
        [int]::TryParse($r.'Call Time', [ref]$callTime) | Out-Null
        $row["CallTime"] = $callTime
        
        $talkTime = 0
        [int]::TryParse($r.'Talk Time', [ref]$talkTime) | Out-Null
        $row["TalkTime"] = $talkTime
        
        $row["CallStatus"] = if ($r.'Call Status') { $r.'Call Status'.Trim() } else { "UNKNOWN" }
        $row["AmaFlags"] = if ($r.'AMA Flags') { $r.'AMA Flags'.Trim() } else { [DBNull]::Value }
        $row["UniqueId"] = if ($r.'Unique ID') { $r.'Unique ID'.Trim() } else { [DBNull]::Value }
        $row["CallType"] = if ($r.'Call Type') { $r.'Call Type'.Trim() } else { "Unknown" }
        $row["DestChannelExtension"] = if ($r.'Dest Channel Extension') { $r.'Dest Channel Extension'.Substring(0, [Math]::Min($r.'Dest Channel Extension'.Length, 100)) } else { [DBNull]::Value }
        $row["CallerName"] = if ($r.'Caller Name') { $r.'Caller Name'.Substring(0, [Math]::Min($r.'Caller Name'.Length, 200)) } else { [DBNull]::Value }
        $row["AnsweredBy"] = if ($r.'Answered by') { $r.'Answered by'.Substring(0, [Math]::Min($r.'Answered by'.Length, 200)) } else { [DBNull]::Value }
        $row["Session"] = if ($r.'Session') { $r.'Session'.Substring(0, [Math]::Min($r.'Session'.Length, 200)) } else { [DBNull]::Value }
        $row["PremierCaller"] = if ($r.'Premier Caller') { $r.'Premier Caller'.Substring(0, [Math]::Min($r.'Premier Caller'.Length, 100)) } else { [DBNull]::Value }
        $row["ActionType"] = if ($r.'Action Type') { $r.'Action Type'.Trim() } else { [DBNull]::Value }
        $row["SourceTrunkName"] = if ($r.'Source Trunk Name') { $r.'Source Trunk Name'.Substring(0, [Math]::Min($r.'Source Trunk Name'.Length, 200)) } else { [DBNull]::Value }
        $row["DestinationTrunkName"] = if ($r.'Destination Trunk Name') { $r.'Destination Trunk Name'.Substring(0, [Math]::Min($r.'Destination Trunk Name'.Length, 200)) } else { [DBNull]::Value }
        
        $dataTable.Rows.Add($row) | Out-Null
    }
    
    Write-Host "  Parsed: $($dataTable.Rows.Count) rows, Skipped: $skipped"
    
    if ($dataTable.Rows.Count -gt 0) {
        # Bulk insert
        $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
        $connection.Open()
        
        $bulkCopy = New-Object System.Data.SqlClient.SqlBulkCopy($connection)
        $bulkCopy.DestinationTableName = "CallRecords"
        $bulkCopy.BatchSize = 5000
        $bulkCopy.BulkCopyTimeout = 300
        
        # Map columns
        foreach ($col in $dataTable.Columns) {
            $bulkCopy.ColumnMappings.Add($col.ColumnName, $col.ColumnName) | Out-Null
        }
        
        try {
            $bulkCopy.WriteToServer($dataTable)
            Write-Host "  Inserted: $($dataTable.Rows.Count) rows" -ForegroundColor Green
            $totalImported += $dataTable.Rows.Count
        }
        catch {
            Write-Host "  ERROR: $_" -ForegroundColor Red
        }
        finally {
            $bulkCopy.Close()
            $connection.Close()
        }
    }
    
    $totalSkipped += $skipped
    $dataTable.Dispose()
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Import Complete!" -ForegroundColor Green
Write-Host "Total Imported: $totalImported" -ForegroundColor Green
Write-Host "Total Skipped: $totalSkipped" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
