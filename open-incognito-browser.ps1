# Opens the Incognito app in a Chromium browser with the companion extension
# loaded, in a dedicated isolated profile. Waits for the local dev server first.
# Falls back to the default browser if no Chromium browser is found.
$ErrorActionPreference = 'SilentlyContinue'
$ext     = Join-Path $PSScriptRoot 'extension'
$profile = Join-Path $env:LOCALAPPDATA 'IncognitoBrowserProfile'
$appUrl  = 'http://localhost:5173'

# Wait up to ~40s for the dev server to answer.
for ($i = 0; $i -lt 40; $i++) {
  try {
    $r = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -ge 200) { break }
  } catch { Start-Sleep -Seconds 1 }
}

$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($browser) {
  & $browser "--user-data-dir=$profile" "--load-extension=$ext" "--no-first-run" "--no-default-browser-check" $appUrl
} else {
  Write-Host 'No Chrome/Edge found - opening default browser (extension will NOT load there).'
  Start-Process $appUrl
}
