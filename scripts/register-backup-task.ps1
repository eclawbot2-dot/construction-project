# Register a Windows Task Scheduler entry that runs the nightly backup
# cron at 02:30 local time.
#
# Reads CRON_SECRET from .env in the repo root. Hits the public Cloudflare
# tunnel URL by default (so the task survives a localhost-port change);
# pass -LocalOnly to hit http://127.0.0.1:3101 instead.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\register-backup-task.ps1

param(
  [string]$TaskName = 'bcon-nightly-backup',
  [string]$Time = '02:30',
  [switch]$LocalOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $root

# Pull CRON_SECRET out of the repo's .env file.
$envFile = Join-Path $repo '.env'
if (-not (Test-Path $envFile)) { throw "No .env at $envFile — set CRON_SECRET first." }
$secretLine = Get-Content $envFile | Where-Object { $_ -match '^CRON_SECRET=' } | Select-Object -First 1
if (-not $secretLine) { throw "CRON_SECRET not present in .env" }
$secret = ($secretLine -replace '^CRON_SECRET=', '').Trim('"').Trim("'")

$url = if ($LocalOnly) { 'http://127.0.0.1:3101/api/cron/backup' } else { 'https://bcon.jahdev.com/api/cron/backup' }

$action = New-ScheduledTaskAction `
  -Execute 'curl.exe' `
  -Argument "-sf -H ""Authorization: Bearer $secret"" -X POST $url"

$trigger = New-ScheduledTaskTrigger -Daily -At $Time

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RunOnlyIfNetworkAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

# Run as SYSTEM so the task fires when the user is logged out. SYSTEM has
# no Cloudflare tunnel access by default but curl.exe + the public URL
# works because the tunnel terminates outside the host.
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest

# Replace any existing task with the same name.
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Nightly per-tenant JSON backup for bcon. Endpoint: $url"

Write-Host "Registered $TaskName, next run at $Time daily ($url)"
