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

echo [3/6] Git commit (OTA: lessons + app-ui.zip, users keep same exe)...
git add -A
git commit -m "release: v%VER%"
if errorlevel 1 (
  echo Nothing to commit or commit failed.
)

echo [4/6] Git push...
git push
if errorlevel 1 (echo git push failed. & pause & exit /b 1)

echo [5/6] Tag v%VER%...
git tag -f "v%VER%"
git push origin "v%VER%" --force

echo [6/6] GitHub Release (Releases tab)...
where gh >nul 2>&1 && (
  node scripts/gh-release.mjs
) || (
  echo Install GitHub CLI: winget install GitHub.cli
  echo Then: gh auth login
)

echo.
echo Done v%VER%. OTA on main/release/updates — users restart app.
echo First-time installer: BUILD-PORTABLE.bat then gh uploads exe.
pause
