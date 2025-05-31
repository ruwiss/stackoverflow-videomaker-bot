@echo off
title YouTube Otomasyon - Starting Server
echo.
echo ========================================
echo    YouTube Otomasyon Sistemi
echo ========================================
echo.
echo Server baslatiliyor...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo HATA: Node.js bulunamadi!
    echo Lutfen Node.js yukleyin: https://nodejs.org
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo HATA: npm bulunamadi!
    echo Node.js ile birlikte npm yuklu olmali.
    pause
    exit /b 1
)

echo Node.js ve npm bulundu.
echo.

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo node_modules klasoru bulunamadi.
    echo Dependencies yukleniyor...
    npm install
    if %errorlevel% neq 0 (
        echo HATA: npm install basarisiz!
        pause
        exit /b 1
    )
    echo.
)

echo Server baslatiliyor...
echo.
echo Tarayici otomatik olarak acilacak...
echo Server durdurmak icin Ctrl+C basin.
echo.

REM Wait 3 seconds then open browser
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3002"

REM Start the server
npm start
