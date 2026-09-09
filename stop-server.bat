@echo off
setlocal enabledelayedexpansion
title Stop PumpStock Dev Server

echo.
echo Stopping PumpStock dev server and clearing ports...
echo.

set FOUND=0

call :KillPort 5173
call :KillPort 5174
call :KillPort 5175
call :KillPort 4173

echo.
if !FOUND!==0 (
  echo No process found on ports 5173, 5174, 5175, or 4173.
) else (
  echo Done. Dev server ports cleared.
)
echo.
pause
exit /b 0

:KillPort
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":%1 " ^| findstr "LISTENING"') do (
  echo Port %1 - stopping PID %%P
  taskkill /PID %%P /F >nul 2>&1
  if not errorlevel 1 set FOUND=1
)
exit /b 0
