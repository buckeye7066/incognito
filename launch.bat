@echo off
title Incognito - Privacy Guardian
cd /d "%~dp0"
color 0C

echo.
echo   ===================================================
echo.
echo        #### ##    ##  ######   #######   ######
echo         ##  ###   ## ##    ## ##     ## ##    ##
echo         ##  ####  ## ##       ##     ## ##
echo         ##  ## ## ## ##       ##     ## ##   ####
echo         ##  ##  #### ##       ##     ## ##    ##
echo         ##  ##   ### ##    ## ##     ## ##    ##
echo        #### ##    ##  ######   #######   ######
echo.
echo              P R I V A C Y   G U A R D I A N
echo.
echo   ===================================================
echo.
echo   Starting Incognito...
echo   Your browser will open automatically.
echo.
echo   DO NOT close this window while using the app.
echo   Press Ctrl+C to stop the server.
echo.

echo   Loading the companion autofill extension into an isolated browser profile.
echo.

start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-incognito-browser.ps1"
npm run dev
