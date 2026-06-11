@echo off
title HQMS - Starting...
color 0A

echo ================================================
echo   HQMS - Hifzul Quran Management System
echo ================================================
echo.

:: Start PostgreSQL
echo [1/2] Starting PostgreSQL database...
pg_ctl start -D "D:\scoop\apps\postgresql\current\data" -w -l "D:\scoop\apps\postgresql\current\data\logfile.log" 2>nul
if %errorlevel% == 0 (
    echo       Database started successfully!
) else (
    echo       Database already running or started.
)
echo.

:: Start Next.js dev server
echo [2/2] Starting HQMS web application...
echo.
echo ================================================
echo   App running at: http://localhost:3000
echo   Username: admin
echo   Password: Admin@123
echo ================================================
echo.
echo   Press Ctrl+C to stop the application.
echo.

npm run dev
