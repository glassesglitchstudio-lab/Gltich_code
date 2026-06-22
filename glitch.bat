@echo off
setlocal
chcp 65001 >nul
title Glitch Code

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo [Glitch Code] Baslatiliyor...
bun run dev --offline %*

if %errorlevel% neq 0 (
    echo [HATA] Glitch Code baslatilamadi!
    echo Bun yuklu mu? once glitch_kur.bat calistir.
    pause
)

endlocal
