@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Glitch Code v2.0 - Setup Builder
color 0D

set "CYAN=[36m"
set "GREEN=[32m"
set "YELLOW=[33m"
set "RED=[31m"
set "RESET=[0m"

echo.
echo  %CYAN%  ╔═══════════════════════════════════════════╗%RESET%
echo  %CYAN%  ║  %YELLOW%GLITCH CODE v2.0 - SETUP BUILDER%RESET%     %CYAN%║%RESET%
echo  %CYAN%  ║  %YELLOW%GlassesCat AI Platform%RESET%               %CYAN%║%RESET%
echo  %CYAN%  ╚═══════════════════════════════════════════╝%RESET%
echo.

:: ─── Inno Setup check ───
where iscc >nul 2>nul
if %errorlevel% neq 0 (
    echo  [%RED%!%RESET%] Inno Setup bulunamadi!
    echo      Winget ile kuruluyor...
    winget install --id JR.InnoSetup -e --silent >nul 2>&1
    if !errorlevel! neq 0 (
        echo  [%RED%HATA%RESET%] Kurulamadi! Manuel: https://jrsoftware.org/isdl.php
        pause
        exit /b 1
    )
    echo  [%GREEN%OK%RESET%] Inno Setup kuruldu
)

:: ─── Build check ───
if not exist "..\packages\opencode\dist\mimocode-windows-x64\bin\mimo.exe" (
    echo  [%YELLOW%!%RESET%] mimo.exe bulunamadi!
    choice /C EH /M "Build alinsin mi? [E]vet / [H]ayir"
    if !errorlevel! equ 1 (
        cd ..\packages\opencode
        set MIMOCODE_CHANNEL=prod
        echo  [!] Build aliniyor...
        call bun run script\build.ts --single
        cd ..\..\setup
    ) else (
        pause
        exit /b 1
    )
)

:: ─── Build setup ───
echo  [!] Setup derleniyor (v2.0 - GlassesCat Edition)...
echo.
iscc glitch_setup.iss
if !errorlevel! neq 0 (
    echo  [%RED%HATA%RESET%] Setup derlemesi basarisiz!
    pause
    exit /b 1
)

echo.
echo  %CYAN%════════════════════════════════════════════%RESET%
echo  %GREEN%  ✅ SETUP HAZIR!%RESET%
echo  %CYAN%════════════════════════════════════════════%RESET%
echo.
echo   📦 dist\GlitchCode_Setup_v2.0.0.exe
echo   🎨 GlassesCat AI entegrasyonu ile
echo   🔄 Animasyonlu kurulum asistani
echo.
echo  %YELLOW}  Yayinlamak icin:%RESET%
echo     git tag v2.0.0
echo     git push origin v2.0.0
echo.
pause
