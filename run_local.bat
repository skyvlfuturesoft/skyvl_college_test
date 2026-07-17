@echo off
title SOEMS Local Dev Servers
color 0A

echo ============================================================
echo   SOEMS - Secure Online Exam Management System
echo   Starting Local Development Environment
echo ============================================================
echo.

:: Kill any process already using port 8010
echo [1/4] Clearing port 8010...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8010" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
:: Also kill any lingering Python/node processes from previous runs
taskkill /IM "python.exe" /F >nul 2>&1
taskkill /IM "node.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

:: Kill any process on port 5173 too
echo [2/4] Clearing port 5173...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo [3/4] Starting FastAPI backend on http://127.0.0.1:8010 ...
start "SOEMS Backend (port 8010)" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8010"

:: Wait for backend to initialise before starting frontend
timeout /t 4 /nobreak >nul

echo [4/4] Starting Vite frontend on http://localhost:5173 ...
start "SOEMS Frontend (port 5173)" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ============================================================
echo   Both servers are starting in separate windows.
echo.
echo   Frontend : http://localhost:5173
echo   Backend  : http://127.0.0.1:8010
echo   API Docs : http://127.0.0.1:8010/docs
echo ============================================================
echo.
echo   Close this window any time. Servers run in their own windows.
pause
