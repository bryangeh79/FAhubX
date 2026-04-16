@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

:: ============================================================
:: FAhubX Backend Build Script
:: Compiles NestJS, obfuscates sensitive files, stages output
:: ============================================================

set PROJECT_ROOT=%~dp0..
set BACKEND_DIR=%PROJECT_ROOT%\backend
set STAGING_DIR=%~dp0staging\backend
set INSTALLER_DIR=%~dp0

echo ========================================
echo   Building FAhubX Backend
echo ========================================
echo.

:: Step 1: Install dependencies
echo [1/5] Installing backend dependencies...
cd /d "%BACKEND_DIR%"
call npm ci
if errorlevel 1 (
    echo ERROR: npm ci failed
    exit /b 1
)

:: Install serve-static for local mode
call npm install @nestjs/serve-static --save
if errorlevel 1 (
    echo ERROR: Failed to install @nestjs/serve-static
    exit /b 1
)

:: Step 2: Build
echo [2/5] Compiling TypeScript...
call npx nest build
if errorlevel 1 (
    echo ERROR: nest build failed
    exit /b 1
)
echo   Build complete: backend\dist\

:: Step 3: Obfuscate
echo [3/5] Obfuscating sensitive files...
cd /d "%INSTALLER_DIR%"

:: Install javascript-obfuscator if not present
call npm list javascript-obfuscator >nul 2>&1
if errorlevel 1 (
    call npm install javascript-obfuscator --no-save
)

node obfuscate.js --backend-dist "%BACKEND_DIR%\dist"
if errorlevel 1 (
    echo ERROR: Obfuscation failed
    exit /b 1
)

:: Step 4: Stage files
echo [4/5] Staging backend files...
if exist "%STAGING_DIR%" rmdir /s /q "%STAGING_DIR%"
mkdir "%STAGING_DIR%"

:: Copy dist
xcopy /E /I /Q /Y "%BACKEND_DIR%\dist" "%STAGING_DIR%\dist" >nul
:: Copy node_modules
xcopy /E /I /Q /Y "%BACKEND_DIR%\node_modules" "%STAGING_DIR%\node_modules" >nul
:: Copy package.json
copy /Y "%BACKEND_DIR%\package.json" "%STAGING_DIR%\" >nul
:: Copy database migrations
xcopy /E /I /Q /Y "%BACKEND_DIR%\database" "%STAGING_DIR%\database" >nul
:: Copy scripts (seed)
xcopy /E /I /Q /Y "%BACKEND_DIR%\scripts" "%STAGING_DIR%\scripts" >nul

:: Step 5: Prune dev dependencies
echo [5/5] Pruning development dependencies...
cd /d "%STAGING_DIR%"
call npm prune --production >nul 2>&1
echo   Pruned dev dependencies.

echo.
echo   Backend build complete!
echo   Staged at: %STAGING_DIR%
echo.
cd /d "%INSTALLER_DIR%"
exit /b 0
