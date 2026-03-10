@echo off
REM One-click launcher for Commute Calculator
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Download it from https://nodejs.org/
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo Starting Commute Calculator...
call npm start
