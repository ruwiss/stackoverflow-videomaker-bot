@echo off
echo YouTube Otomasyon baslatiliyor...

REM 2 saniye bekle ve tarayiciyi ac
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3002"

REM Server'i baslat
npm start
