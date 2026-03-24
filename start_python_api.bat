@echo off
title MeetingRAG - Python API
echo.
echo =========================================
echo  Starting MeetingRAG Python API (8000)
echo =========================================
echo.

REM Navigate to backend python_api directory
cd /d "%~dp0backend\python_api"

REM Try to activate venv from project root
if exist "%~dp0.venv\Scripts\activate.bat" (
    call "%~dp0.venv\Scripts\activate.bat"
    echo [OK] Virtual environment activated
) else (
    echo [WARN] No venv found - using system Python
)

echo.
echo [*] Starting FastAPI on http://localhost:8000
echo     Press Ctrl+C to stop
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause
