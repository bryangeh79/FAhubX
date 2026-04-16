@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

:: ============================================================
:: FAhubX Database Initialization Script
:: Initializes PostgreSQL, creates database, runs migrations
:: ============================================================

set FAHUBX_HOME=%~dp0..
:: Remove trailing backslash
if "%FAHUBX_HOME:~-1%"=="\" set FAHUBX_HOME=%FAHUBX_HOME:~0,-1%

set PG_BIN=%FAHUBX_HOME%\pgsql\bin
set PG_DATA=%FAHUBX_HOME%\pgsql\data
set NODE=%FAHUBX_HOME%\node\node.exe
set BACKEND_DIR=%FAHUBX_HOME%\backend

:: Read port from .env
set PG_PORT=5433
for /f "usebackq tokens=1,2 delims==" %%a in ("%BACKEND_DIR%\.env") do (
    if "%%a"=="DB_PORT" set PG_PORT=%%b
)

echo ========================================
echo   FAhubX Database Initialization
echo ========================================
echo.

:: === Step 1: Check prerequisites ===
if not exist "%PG_BIN%\initdb.exe" (
    echo ERROR: PostgreSQL not found at %PG_BIN%
    exit /b 1
)
if not exist "%NODE%" (
    echo ERROR: Node.js not found at %NODE%
    exit /b 1
)

:: === Step 2: Initialize PostgreSQL data directory ===
if not exist "%PG_DATA%\PG_VERSION" (
    echo [1/6] Initializing PostgreSQL data directory...
    "%PG_BIN%\initdb.exe" -D "%PG_DATA%" -U postgres -E UTF8 --locale=C -A trust >"%FAHUBX_HOME%\logs\pgsql-initdb.log" 2>&1
    if errorlevel 1 (
        echo ERROR: PostgreSQL initialization failed. Check logs\pgsql-initdb.log
        exit /b 1
    )

    :: Configure pg_hba.conf for local-only trust auth
    (
        echo # FAhubX local-only authentication
        echo # TYPE  DATABASE  USER  ADDRESS       METHOD
        echo host    all       all   127.0.0.1/32  trust
        echo host    all       all   ::1/128       trust
    ) > "%PG_DATA%\pg_hba.conf"

    :: Configure postgresql.conf
    (
        echo listen_addresses = '127.0.0.1'
        echo port = %PG_PORT%
        echo max_connections = 50
        echo shared_buffers = 128MB
        echo work_mem = 4MB
        echo log_destination = 'stderr'
        echo logging_collector = on
        echo log_directory = '../../logs'
        echo log_filename = 'pgsql-%%Y%%m%%d.log'
        echo log_truncate_on_rotation = on
        echo log_rotation_age = 1d
    ) >> "%PG_DATA%\postgresql.conf"

    echo   PostgreSQL data directory initialized.
) else (
    echo [1/6] PostgreSQL data directory already exists, skipping init.
)

:: === Step 3: Check if port is available ===
netstat -an | findstr ":%PG_PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo WARNING: Port %PG_PORT% is already in use!
    echo Another PostgreSQL or service may be running.
    echo Please stop it or choose a different port.
    exit /b 1
)

:: === Step 4: Start PostgreSQL temporarily ===
echo [2/6] Starting PostgreSQL on port %PG_PORT%...
"%PG_BIN%\pg_ctl.exe" start -D "%PG_DATA%" -l "%FAHUBX_HOME%\logs\pgsql-init.log" -w -t 30 >nul 2>&1
if errorlevel 1 (
    echo ERROR: PostgreSQL failed to start. Check logs\pgsql-init.log
    exit /b 1
)

:: Wait for PostgreSQL to be ready
set RETRIES=0
:waitpg
"%PG_BIN%\pg_isready.exe" -h 127.0.0.1 -p %PG_PORT% >nul 2>&1
if errorlevel 1 (
    set /a RETRIES+=1
    if !RETRIES! gtr 30 (
        echo ERROR: PostgreSQL did not become ready in time
        "%PG_BIN%\pg_ctl.exe" stop -D "%PG_DATA%" -m fast -w >nul 2>&1
        exit /b 1
    )
    timeout /t 1 /nobreak >nul
    goto waitpg
)
echo   PostgreSQL is ready.

:: === Step 5: Create database ===
echo [3/6] Creating database 'fbautobot'...
"%PG_BIN%\createdb.exe" -h 127.0.0.1 -p %PG_PORT% -U postgres fbautobot >nul 2>&1
if errorlevel 1 (
    :: Database might already exist, check
    "%PG_BIN%\psql.exe" -h 127.0.0.1 -p %PG_PORT% -U postgres -lqt | findstr "fbautobot" >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Failed to create database
        "%PG_BIN%\pg_ctl.exe" stop -D "%PG_DATA%" -m fast -w >nul 2>&1
        exit /b 1
    )
    echo   Database 'fbautobot' already exists.
) else (
    echo   Database 'fbautobot' created.
)

:: === Step 6: Run migrations ===
echo [4/6] Running database migrations...
set DB_HOST=127.0.0.1
set DB_PORT=%PG_PORT%
set DB_NAME=fbautobot
set DB_USER=postgres
set DB_PASSWORD=

cd /d "%BACKEND_DIR%"
"%NODE%" database\migrate.js migrate
if errorlevel 1 (
    echo ERROR: Database migration failed
    cd /d "%FAHUBX_HOME%"
    "%PG_BIN%\pg_ctl.exe" stop -D "%PG_DATA%" -m fast -w >nul 2>&1
    exit /b 1
)
echo   Migrations complete.

:: === Step 7: Seed admin user ===
echo [5/6] Creating admin user...

:: Load ADMIN_EMAIL and ADMIN_PASSWORD from .env
for /f "usebackq tokens=1,2 delims==" %%a in ("%BACKEND_DIR%\.env") do (
    if "%%a"=="ADMIN_EMAIL" set ADMIN_EMAIL=%%b
    if "%%a"=="ADMIN_PASSWORD" set ADMIN_PASSWORD=%%b
)

"%NODE%" scripts\seed-database.js
if errorlevel 1 (
    echo WARNING: Seed script had errors (non-fatal, admin may already exist)
)
echo   Admin user ready.

:: === Step 8: Stop PostgreSQL ===
echo [6/6] Stopping PostgreSQL...
cd /d "%FAHUBX_HOME%"
"%PG_BIN%\pg_ctl.exe" stop -D "%PG_DATA%" -m fast -w >nul 2>&1
echo   PostgreSQL stopped.

echo.
echo ========================================
echo   Database initialization complete!
echo ========================================
echo.

exit /b 0
