@echo off
title Incognito - Backend + Public Tunnel
cd /d "%~dp0"
echo.
echo   Starting the Incognito backend and a public tunnel...
echo   (Twilio needs this to reach your computer.)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-backend-tunnel.ps1"
echo.
echo   Tunnel/backend stopped. Press any key to close.
pause >nul
