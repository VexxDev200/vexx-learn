@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

where node >nul 2>&1 || (echo Install Node.js first. & pause & exit /b 1)
where git >nul 2>&1 || (echo Install Git first. & pause & exit /b 1)

echo [1/6] Bump patch version in package.json...
for /f "delims=" %%V in ('node scripts/bump-version.mjs') do set "VER=%%V"
if not defined VER (echo bump failed. & pause & exit /b 1)
echo        Version: %VER%

echo [2/6] Pack lessons + manifest.json...
call npm run release:pack
if errorlevel 1 (echo release:pack failed. & pause & exit /b 1)

echo [3/6] Build portable exe...
call npm run build
if errorlevel 1 (echo build failed. & pause & exit /b 1)

echo [4/6] Git commit...
git add -A
git commit -m "release: v%VER%"
if errorlevel 1 (
  echo Nothing to commit or commit failed.
)

echo [5/6] Git push...
git push
if errorlevel 1 (echo git push failed. & pause & exit /b 1)

echo [6/6] Tag v%VER% and push tag (GitHub Release CI)...
git tag -f "v%VER%"
git push origin "v%VER%" --force

echo.
echo Done. v%VER% — manifest appVersion and portable exe are in sync.
echo Users on older exe will see app update after pull + auto-check.
pause
