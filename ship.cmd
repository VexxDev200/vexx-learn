@echo off
setlocal
cd /d "%~dp0"
call npm run ship
exit /b %ERRORLEVEL%
