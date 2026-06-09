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

start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"
npm run dev
