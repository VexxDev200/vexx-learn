@echo off
cd /d "%~dp0"
echo Building portable with OTA engine (one-time install for users)...
call npm run build
if errorlevel 1 (echo FAILED & pause & exit /b 1)
echo.
echo Ready: release\Vexx-Learn-Portable.exe
echo Give this file to users ONCE. Later use only BUMP-RELEASE.bat
pause
