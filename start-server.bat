@echo off
title PumpStock Dev Server
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install Node.js 20+ from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm ci
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting PumpStock dev server...
echo Open the URL shown below (usually http://localhost:5173/)
echo Press Ctrl+C to stop the server.
echo.

call npm run dev

if errorlevel 1 (
  echo.
  echo Server exited with an error.
  pause
)
