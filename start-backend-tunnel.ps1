# Starts the Incognito backend AND a public cloudflared tunnel in one go, then
# launches the backend with PUBLIC_BASE_URL set to the tunnel URL (required so
# Twilio webhook-signature checks pass). Loads secrets from server/.env.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$envFile = Join-Path $root 'server\.env'

# --- Load server/.env (KEY=VALUE lines) into this process ---
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $name = $matches[1]; $val = $matches[2].Trim()
      if ($name -ne 'PUBLIC_BASE_URL') { Set-Item -Path "Env:$name" -Value $val }
    }
  }
} else {
  Write-Host "No server\.env found. Copy server\.env.example to server\.env and fill in TWILIO_AUTH_TOKEN + WEBHOOK_SHARED_SECRET first." -ForegroundColor Yellow
}

# --- Find cloudflared ---
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) {
  foreach ($p in @("$env:ProgramFiles\cloudflared\cloudflared.exe", "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe")) {
    if (Test-Path $p) { $cf = $p; break }
  }
}
if (-not $cf) {
  Write-Host "cloudflared not found. Install it with:  winget install --id Cloudflare.cloudflared" -ForegroundColor Red
  exit 1
}

$port = if ($env:PORT) { $env:PORT } else { '8787' }
$cfLog = Join-Path $env:TEMP 'incognito-cloudflared.log'
if (Test-Path $cfLog) { Remove-Item $cfLog -Force }

Write-Host "Starting public tunnel to http://localhost:$port ..." -ForegroundColor Cyan
$cfProc = Start-Process -FilePath $cf -ArgumentList @('tunnel', '--no-autoupdate', '--url', "http://localhost:$port") `
  -RedirectStandardError $cfLog -RedirectStandardOutput "$cfLog.out" -PassThru -WindowStyle Hidden

# --- Wait for the trycloudflare URL to appear in the log ---
$publicUrl = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  $text = (Get-Content $cfLog -Raw -ErrorAction SilentlyContinue) + (Get-Content "$cfLog.out" -Raw -ErrorAction SilentlyContinue)
  $m = [regex]::Match($text, 'https://[a-z0-9-]+\.trycloudflare\.com')
  if ($m.Success) { $publicUrl = $m.Value; break }
}

if (-not $publicUrl) {
  Write-Host "Couldn't get a tunnel URL. Check $cfLog" -ForegroundColor Red
  if ($cfProc -and -not $cfProc.HasExited) { $cfProc.Kill() }
  exit 1
}

$env:PUBLIC_BASE_URL = $publicUrl
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Public backend URL:  $publicUrl" -ForegroundColor Green
Write-Host ""
Write-Host "  In the app (Family Call Coverage -> setup guide):" -ForegroundColor Green
Write-Host "    Backend URL  =  $publicUrl"
Write-Host "  In the Twilio console, each number's Voice webhook (POST):" -ForegroundColor Green
Write-Host "    $publicUrl/webhooks/twilio/voice"
Write-Host ""
Write-Host "  Keep this window OPEN while you want call screening active." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

# --- Run the backend in the foreground (Ctrl+C stops both) ---
try {
  & node (Join-Path $root 'server\src\index.js')
} finally {
  if ($cfProc -and -not $cfProc.HasExited) { $cfProc.Kill() }
}
