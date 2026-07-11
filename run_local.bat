@echo off
echo =======================================================================
echo     SOEMS - Secure Online Examination Management System Local Starter
echo =======================================================================
echo.

REM Navigate to the workspace directory safely avoiding trailing backslash quote escaping
cd /d "%~dp0."

if exist venv goto venv_exists
echo [INFO] Creating Python virtual environment (venv)...
python -m venv venv
if errorlevel 1 goto venv_failed
goto venv_exists

:venv_failed
echo [ERROR] Failed to create virtual environment. Ensure Python is installed and in your PATH.
pause
exit /b 1

:venv_exists
echo [INFO] Python virtual environment exists.

echo [INFO] Activating virtual environment and installing backend requirements...
call venv\Scripts\activate.bat
pip install -r backend\requirements.txt
if errorlevel 1 goto pip_failed
goto pip_success

:pip_failed
echo [ERROR] Failed to install Python dependencies.
pause
exit /b 1

:pip_success
echo [INFO] Installing frontend dependencies (npm install)...
call npm install
if errorlevel 1 goto npm_failed
goto npm_success

:npm_failed
echo [ERROR] Failed to install Node.js dependencies.
pause
exit /b 1

:npm_success
echo [INFO] Starting FastAPI backend server in a new window (port 8000)...
start "SOEMS FastAPI Backend" cmd /k "call venv\Scripts\activate.bat && cd backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo [INFO] Starting Vite frontend dev server (port 5173)...
echo.
npm run dev

pause
