# =============================================================================
# ProjectTracker Database Backup Script
# Runs a full SQL Server backup inside the Docker container,
# copies the .bak file out, and mirrors it to the NAS.
#
# RETENTION POLICY: backups are NEVER deleted. Every backup is kept forever,
# both locally and on the NAS. (Set $PurgeOldBackups = $true only if you ever
# deliberately want age-based cleanup back.)
#
# NAS RESILIENCE: if the NAS is offline, the local backup is still created and
# the run still succeeds. On the next run where the NAS IS reachable, any local
# backups that are missing from the NAS are copied over (catch-up), so nothing
# is lost while the NAS was disconnected.
# =============================================================================

param(
    [string]$LocalBackupDir = "C:\Backups\ProjectTrackerDB",
    [string]$NasBackupDir   = "\\192.168.10.76\WorkSpace\Backups\ProjectTrackerDB",
    [string]$ContainerName  = "projecttracker-db",
    [string]$DatabaseName   = "ProjectTrackerDB",
    [string]$SaPassword     = "YourStrong@Passw0rd",
    [int]$LocalRetainDays   = 30,
    [int]$NasRetainDays     = 180,
    [int]$MinRetainCount    = 10,
    # When $false (default) NO backups are ever deleted - everything is kept
    # forever. Set to $true only if you deliberately want age-based cleanup
    # (which then still keeps at least $MinRetainCount recent backups).
    [bool]$PurgeOldBackups  = $false
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

    # 5. Retrieve the .bak file on the host.
    #    docker-compose bind-mounts the container backup path
    #    (/var/opt/mssql/backup) to the host backup folder, so the BACKUP
    #    written above already appears at $localFilePath. If that bind mount
    #    is not present, fall back to copying it out of the container.
    $localFilePath = Join-Path $LocalBackupDir $backupFileName
    if (-not (Test-Path $localFilePath)) {
        $cpOutput = docker cp "${ContainerName}:${containerBackupPath}/${backupFileName}" $localFilePath 2>&1 | Out-String
        Write-Log "docker cp: $cpOutput"
    }
    else {
        Write-Log "Backup already present on host via bind mount: $localFilePath"
    }

    if (-not (Test-Path $localFilePath)) {
        Write-Log "Backup file not found on host: $localFilePath" "ERROR"
        exit 1
    }

    $fileSizeMB = [math]::Round((Get-Item $localFilePath).Length / 1MB, 2)
    Write-Log "Backup saved locally: $localFilePath ($fileSizeMB MB)"

    # 6. Clean up the container-internal backup ONLY when the backup path is
    #    NOT bind-mounted to the host folder. Deleting a bind-mounted path here
    #    would destroy the local backup we just created -- this was the original
    #    data-loss bug.
    $mounts = docker inspect -f '{{range .Mounts}}{{.Destination}};{{end}}' $ContainerName 2>&1 | Out-String
    $backupIsBindMounted = $mounts -match [regex]::Escape($containerBackupPath)
    if (-not $backupIsBindMounted) {
        docker exec $ContainerName rm -f "$containerBackupPath/$backupFileName" 2>&1 | Out-Null
        Write-Log "Cleaned up backup inside container."
    }
    else {
        Write-Log "Skipped container cleanup - backup path is bind-mounted to host (backup retained locally)."
    }

    # 7. Copy to NAS if reachable
    $nasShare = "\\192.168.10.76\WorkSpace"
    if (Test-Path $nasShare) {
        if (-not (Test-Path $NasBackupDir)) {
            New-Item -ItemType Directory -Path $NasBackupDir -Force | Out-Null
            Write-Log "Created NAS backup directory: $NasBackupDir"
        }
        Copy-Item -Path $localFilePath -Destination $NasBackupDir -Force
        Write-Log "Backup copied to NAS: $NasBackupDir"

        # NAS catch-up: copy across any local backups that are missing from the
        # NAS (e.g. backups taken on days the NAS was offline). This guarantees
        # every local backup eventually lands on the NAS once it reconnects.
        $nasNames = @{}
        Get-ChildItem -Path $NasBackupDir -Filter "${DatabaseName}_*.bak" -ErrorAction SilentlyContinue |
            ForEach-Object { $nasNames[$_.Name] = $true }
        $caughtUp = 0
        Get-ChildItem -Path $LocalBackupDir -Filter "${DatabaseName}_*.bak" -ErrorAction SilentlyContinue |
            Where-Object { -not $nasNames.ContainsKey($_.Name) } |
            ForEach-Object {
                Copy-Item -Path $_.FullName -Destination $NasBackupDir -Force
                Write-Log "NAS catch-up: copied missing backup to NAS: $($_.Name)"
                $caughtUp++
            }
        if ($caughtUp -gt 0) {
            Write-Log "NAS catch-up complete: $caughtUp backup(s) that were missed while the NAS was offline are now on the NAS."
        }

        # Retention: DISABLED by default - backups are kept forever. Only runs
        # if $PurgeOldBackups is explicitly set to $true.
        if ($PurgeOldBackups) {
            Get-ChildItem -Path $NasBackupDir -Filter "${DatabaseName}_*.bak" |
                Sort-Object LastWriteTime -Descending |
                Select-Object -Skip $MinRetainCount |
                Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$NasRetainDays) } |
                ForEach-Object {
                    Remove-Item $_.FullName -Force
                    Write-Log "Purged old NAS backup: $($_.Name)"
                }
        }
    }
    else {
        Write-Log "NAS not reachable - keeping backup locally only. It will be copied to the NAS automatically on the next run once the NAS reconnects." "WARN"
    }

    # 8. Local retention: DISABLED by default - backups are kept forever. Only
    #    runs if $PurgeOldBackups is explicitly set to $true.
    if ($PurgeOldBackups) {
        Get-ChildItem -Path $LocalBackupDir -Filter "${DatabaseName}_*.bak" |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip $MinRetainCount |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$LocalRetainDays) } |
            ForEach-Object {
                Remove-Item $_.FullName -Force
                Write-Log "Purged old local backup: $($_.Name)"
            }
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
