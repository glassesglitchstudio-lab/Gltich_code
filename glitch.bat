@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Glitch Code v2.0 - GlassesCat AI
color 0D

set "CYAN=[36m"
set "GREEN=[32m"
set "YELLOW=[33m"
set "RED=[31m"
set "RESET=[0m"

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo.
echo  %CYAN%  ╔═══════════════════════════════════════════╗%RESET%
echo  %CYAN%  ║     %GREEN%GLITCH CODE v2.0%RESET%                   %CYAN%║%RESET%
echo  %CYAN%  ║     %YELLOW%GlassesCat AI Baslatiliyor...%RESET%       %CYAN%║%RESET%
echo  %CYAN%  ╚═══════════════════════════════════════════╝%RESET%
echo.
echo  [%YELLOW!%RESET%] Komutlar:
echo      /help-the-model  - Model secimi ve yonlendirme
echo      /supervise       - Oto-denetim ve kalite analizi
echo.

bun run dev %*

if %errorlevel% neq 0 (
    echo.
    echo  [%RED%HATA%RESET%] Glitch Code baslatilamadi!
    echo  Bun yuklu mu? Once glitch_kur.bat calistir.
    echo.
    pause
)

endlocal
