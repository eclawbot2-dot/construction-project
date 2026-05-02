# Register a Windows Task Scheduler entry that hits /api/cron/verify-portals
# weekly to refresh portal-catalog telemetry (Monday 08:47 local).
#
# Reads CRON_SECRET from .env in the repo root. Hits the public Cloudflare
# tunnel URL by default; pass -LocalOnly to hit http://127.0.0.1:3101.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\register-portal-verify-task.ps1

param(
  [string]$TaskName = 'bcon-weekly-portal-verify',
  [string]$DayOfWeek = 'Monday',
  [string]$Time = '08:47',
  [switch]$LocalOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $root

$envFile = Join-Path $repo '.env'
if (-not (Test-Path $envFile)) { throw "No .env at $envFile - set CRON_SECRET first." }
$secretLine = Get-Content $envFile | Where-Object { $_ -match '^CRON_SECRET=' } | Select-Object -First 1
if (-not $secretLine) { throw "CRON_SECRET not present in .env" }
$secret = ($secretLine -replace '^CRON_SECRET=', '').Trim('"').Trim("'")

$url = if ($LocalOnly) { 'http://127.0.0.1:3101/api/cron/verify-portals' } else { 'https://bcon.jahdev.com/api/cron/verify-portals' }

$action = New-ScheduledTaskAction `
  -Execute 'curl.exe' `
  -Argument "-sf -H ""Authorization: Bearer $secret"" -X POST $url"

# Weekly on the specified day of week. Verification probes ~80 portals
# politely (batches of 6); usually finishes in 5-10 minutes.
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $DayOfWeek -At $Time

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RunOnlyIfNetworkAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Weekly portal-catalog verification for bcon. Endpoint: $url"

Write-Host "Registered $TaskName, next run on $DayOfWeek at $Time ($url)"
