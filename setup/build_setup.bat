@echo off
chcp 65001 >nul
title Glitch Code - Setup Builder

echo =============================================
echo    GLITCH CODE - SETUP BUILDER v1.1.0
echo    AI Provider Setup + TUI Integration
echo =============================================
echo.

:: Inno Setup kontrol
where iscc >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Inno Setup bulunamadi, kuruluyor...
    echo     Winget ile Inno Setup indiriliyor...
    winget install --id JR.InnoSetup -e --silent
    if %errorlevel% neq 0 (
        echo [HATA] Inno Setup kurulamadi!
        echo     Manuel indir: https://jrsoftware.org/isdl.php
        pause
        exit /b 1
    )
    echo [OK] Inno Setup kuruldu
)

:: Build .exe yoksa uyari
if not exist "..\packages\opencode\dist\mimocode-windows-x64\bin\mimo.exe" (
    echo [!] mimo.exe bulunamadi! Once build alin:
    echo     cd packages\opencode
    echo     set MIMOCODE_CHANNEL=prod
    echo     bun run script\build.ts --single
    echo.
    set /p BUILD="Build alinsin mi? (E/H): "
    if /i "!BUILD!"=="E" (
        cd ..\packages\opencode
        set MIMOCODE_CHANNEL=prod
        bun run script\build.ts --single
        cd ..\..\setup
    ) else (
        pause
        exit /b 1
    )
)

:: Setup'i derle
echo [!] Setup derleniyor...
iscc glitch_setup.iss
if %errorlevel% neq 0 (
    echo [HATA] Setup derlemesi basarisiz!
    pause
    exit /b 1
)

echo.
echo =============================================
echo    [OK] Setup hazir!
echo    dist\GlitchCode_Setup_v1.0.0.exe
echo =============================================
echo.
pause
