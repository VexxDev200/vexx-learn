@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title Vexx Learn — ship (exe + OTA + GitHub)

echo.
echo  Один релиз: bump версии, portable exe, OTA на GitHub, Release с exe.
echo  У пользователей: перезапуск приложения — обновления сами.
echo.

where node >nul 2>&1 || (echo Node.js required & pause & exit /b 1)
where gh >nul 2>&1 || (
  echo GitHub CLI ^(gh^) не найден — нужен для push и Release.
  echo https://cli.github.com/
  pause & exit /b 1
)

call npm run ship
echo.
pause
