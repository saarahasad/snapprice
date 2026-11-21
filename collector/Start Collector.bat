@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Install Python 3, then double-click this file again.
  pause
  exit /b 1
)
python -m venv .venv
call .venv\Scripts\pip install -r requirements.txt
echo Pricebench Collector is ready. Leave this window open.
call .venv\Scripts\python collector.py
pause
