# =============================================================================
# Register (or update) a Windows Scheduled Task that runs the database
# backup every night at 9:00 PM.
# Run this script once as Administrator to set it up.
# =============================================================================

param(
    [string]$TaskName = "ProjectTrackerDB_NightlyBackup",
    [string]$TriggerTime = "21:00",
    [string]$ScriptPath = ""
)

$ErrorActionPreference = "Stop"

# Resolve the backup script path
if ([string]::IsNullOrWhiteSpace($ScriptPath)) {
    $ScriptPath = Join-Path $PSScriptRoot "Backup-Database.ps1"
}

if (-not (Test-Path $ScriptPath)) {
    Write-Error "Backup script not found at: $ScriptPath"
    exit 1
}

Write-Host "=============================================="
Write-Host " ProjectTracker DB – Scheduled Backup Setup"
Write-Host "=============================================="
Write-Host ""
Write-Host "  Task Name  : $TaskName"
Write-Host "  Trigger    : Daily at $TriggerTime"
Write-Host "  Script     : $ScriptPath"
Write-Host ""

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing scheduled task."
}

# Build the action – run PowerShell with the backup script
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`"" `
    -WorkingDirectory (Split-Path $ScriptPath -Parent)

# Trigger: every day at the specified time
$trigger = New-ScheduledTaskTrigger -Daily -At $TriggerTime

# Settings: run whether user is logged on or not, don't stop on battery, wake to run
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5)

# Register the task to run as SYSTEM (no password prompt needed)
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Nightly full backup of ProjectTrackerDB (SQL Server in Docker) at $TriggerTime. Stores locally at C:\Backups\ProjectTrackerDB and mirrors to NAS." `
    -User "SYSTEM" `
    -RunLevel Highest `
    -Force | Out-Null

Write-Host ""
Write-Host "Scheduled task '$TaskName' registered successfully." -ForegroundColor Green
Write-Host "The backup will run every day at $TriggerTime."
Write-Host ""
Write-Host "To run it manually:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "To check status:     Get-ScheduledTask -TaskName '$TaskName' | Format-List"
Write-Host "To remove it:        Unregister-ScheduledTask -TaskName '$TaskName'"
