@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo npm install...
  call npm install
)
start "Vexx Learn" cmd /c "npm run dev"
echo Launched. Close this window if you want.
