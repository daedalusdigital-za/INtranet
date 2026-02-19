# =============================================================================
# ProjectTracker Database Backup Script
# Runs a full SQL Server backup inside the Docker container,
# copies the .bak file out, and optionally mirrors it to the NAS.
# Keeps the last 14 local backups and 30 NAS backups.
# =============================================================================

param(
    [string]$LocalBackupDir = "C:\Backups\ProjectTrackerDB",
    [string]$NasBackupDir   = "\\192.168.11.186\WorkSpace\Backups\ProjectTrackerDB",
    [string]$ContainerName  = "projecttracker-db",
    [string]$DatabaseName   = "ProjectTrackerDB",
    [string]$SaPassword     = "YourStrong@Passw0rd",
    [int]$LocalRetainDays   = 14,
    [int]$NasRetainDays     = 30
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFileName = "${DatabaseName}_${timestamp}.bak"
$containerBackupPath = "/var/opt/mssql/backup"
$logFile = Join-Path $LocalBackupDir "backup.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $entry = "$ts [$Level] $Message"
    Write-Host $entry
    $parentDir = Split-Path $logFile -Parent
    if (Test-Path $parentDir) {
        Add-Content -Path $logFile -Value $entry -Encoding utf8
    }
}

function Write-AuditLog {
    param(
        [string]$Action,
        [string]$Description,
        [string]$Details = "",
        [string]$Severity = "info",
        [bool]$IsSuccess = $true,
        [string]$ErrorMessage = ""
    )
    try {
        $descSafe = $Description -replace "'", "''"
        $detailsSafe = $Details -replace "'", "''"
        $errSafe = $ErrorMessage -replace "'", "''"
        $isSuccessBit = if ($IsSuccess) { 1 } else { 0 }
        $errClause = if ($ErrorMessage) { "N'$errSafe'" } else { "NULL" }
        $detailsClause = if ($Details) { "N'$detailsSafe'" } else { "NULL" }
        
        $sql = "INSERT INTO AuditLogs (Action,Category,EntityType,Description,Details,Severity,IsSuccess,ErrorMessage,UserName,UserRole,CreatedAt) VALUES (N'$Action',N'backup',N'Database',N'$descSafe',$detailsClause,N'$Severity',$isSuccessBit,$errClause,N'System',N'System',GETUTCDATE())"
        
        docker exec $ContainerName /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $SaPassword -C -d $DatabaseName -Q "$sql" 2>&1 | Out-Null
        Write-Log "Audit log entry written to database."
    }
    catch {
        Write-Log "Failed to write audit log: $($_.Exception.Message)" "WARN"
    }
}

try {
    # 1. Ensure local backup directory exists
    if (-not (Test-Path $LocalBackupDir)) {
        New-Item -ItemType Directory -Path $LocalBackupDir -Force | Out-Null
        Write-Log "Created local backup directory: $LocalBackupDir"
    }

    # 2. Verify the database container is running
    $containerRunning = docker inspect -f '{{.State.Running}}' $ContainerName 2>&1
    if ($containerRunning -ne "true") {
        Write-Log "Container $ContainerName is not running. Aborting." "ERROR"
        exit 1
    }
    Write-Log "Container $ContainerName is running."

    # 3. Create backup directory inside the container
    docker exec $ContainerName mkdir -p $containerBackupPath 2>&1 | Out-Null

    # 4. Run SQL Server BACKUP command inside the container
    Write-Log "Starting backup of $DatabaseName ..."

    $sqlCmd = "BACKUP DATABASE [$DatabaseName] TO DISK = N'$containerBackupPath/$backupFileName' WITH FORMAT, INIT, NAME = N'${DatabaseName}-Full-${timestamp}', SKIP, NOREWIND, NOUNLOAD, STATS = 10"

    $result = docker exec $ContainerName /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $SaPassword -C -Q $sqlCmd 2>&1
    $resultText = $result | Out-String
    Write-Log "sqlcmd output: $resultText"

    if ($LASTEXITCODE -ne 0 -or $resultText -match "terminating abnormally") {
        Write-Log "sqlcmd backup command failed" "ERROR"
        exit 1
    }
    Write-Log "Database backup completed inside container."

    # 5. Copy the .bak file from the container to local
    $localFilePath = Join-Path $LocalBackupDir $backupFileName
    $cpOutput = docker cp "${ContainerName}:${containerBackupPath}/${backupFileName}" $localFilePath 2>&1 | Out-String
    Write-Log "docker cp: $cpOutput"

    if (-not (Test-Path $localFilePath)) {
        Write-Log "Failed to copy backup file from container." "ERROR"
        exit 1
    }

    $fileSizeMB = [math]::Round((Get-Item $localFilePath).Length / 1MB, 2)
    Write-Log "Backup saved locally: $localFilePath ($fileSizeMB MB)"

    # 6. Clean up backup file inside the container
    docker exec $ContainerName rm -f "$containerBackupPath/$backupFileName" 2>&1 | Out-Null
    Write-Log "Cleaned up backup inside container."

    # 7. Copy to NAS if reachable
    $nasShare = "\\192.168.11.186\WorkSpace"
    if (Test-Path $nasShare) {
        if (-not (Test-Path $NasBackupDir)) {
            New-Item -ItemType Directory -Path $NasBackupDir -Force | Out-Null
            Write-Log "Created NAS backup directory: $NasBackupDir"
        }
        Copy-Item -Path $localFilePath -Destination $NasBackupDir -Force
        Write-Log "Backup copied to NAS: $NasBackupDir"

        # Purge old NAS backups
        Get-ChildItem -Path $NasBackupDir -Filter "${DatabaseName}_*.bak" |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$NasRetainDays) } |
            ForEach-Object {
                Remove-Item $_.FullName -Force
                Write-Log "Purged old NAS backup: $($_.Name)"
            }
    }
    else {
        Write-Log "NAS not reachable - skipping NAS copy." "WARN"
    }

    # 8. Purge old local backups
    Get-ChildItem -Path $LocalBackupDir -Filter "${DatabaseName}_*.bak" |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$LocalRetainDays) } |
        ForEach-Object {
            Remove-Item $_.FullName -Force
            Write-Log "Purged old local backup: $($_.Name)"
        }

    Write-Log "=== Backup completed successfully ==="

    # Log success to audit trail
    $nasStatus = if (Test-Path $nasShare) { "Copied to NAS" } else { "NAS unavailable" }
    Write-AuditLog -Action "Backup Completed" `
        -Description "Database backup completed successfully: $backupFileName ($fileSizeMB MB). $nasStatus." `
        -Details "File: $backupFileName, Size: ${fileSizeMB}MB, NAS: $nasStatus" `
        -Severity "info" -IsSuccess $true

    exit 0
}
catch {
    $msg = $_.Exception.Message
    Write-Log "Backup FAILED: $msg" "ERROR"

    # Log failure to audit trail
    Write-AuditLog -Action "Backup Failed" `
        -Description "Database backup FAILED: $msg" `
        -Severity "critical" -IsSuccess $false -ErrorMessage $msg

    exit 1
}
