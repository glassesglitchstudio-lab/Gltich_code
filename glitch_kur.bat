@echo off
setlocal
chcp 65001 >nul
title Glitch Code - Kurulum
color 0D

echo =============================================
echo    GLITCH CODE - KURULUM ARACI
echo    Windows 10/11 Destegi
echo =============================================
echo.

:: -- Bun kontrolu + kurulumu (Node.js gerekmez) --
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Bun bulunamadi, kuruluyor...
    powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://bun.sh/install.ps1' -OutFile '%TEMP%\bun_install.ps1'"
    powershell -ExecutionPolicy Bypass -File "%TEMP%\bun_install.ps1"
    echo [OK] Bun kuruldu
) else (
    echo [OK] Bun: 
    for /f "tokens=*" %%i in ('bun --version') do echo     %%i
)

:: -- Bu repo (bulundugun klasor) --
set "REPO_DIR=%~dp0"
cd /d "%REPO_DIR%"
echo [OK] Repo: %REPO_DIR%

:: -- Bagimliliklari yukle --
echo [!] Bagimliliklar yukleniyor (bun install)...
call bun install
if %errorlevel% neq 0 (
    echo [HATA] bun install basarisiz!
    pause
    exit /b 1
)
echo [OK] Bagimliliklar hazir

:: -- .mimocode klasoru olustur (gitignored) --
if not exist ".mimocode\command" (
    mkdir ".mimocode\command" >nul 2>&1
    echo help-the-model > ".mimocode\command\help-the-model.md"
    echo supervise > ".mimocode\command\supervise.md"
    echo [OK] .mimocode klasoru olusturuldu
)

:: -- Calistir --
echo.
echo =============================================
echo    GLITCH CODE BASLATILIYOR...
echo =============================================
echo.
start "" cmd /c "glitch.bat --offline"
echo.
echo Glitch Code baslatildi!
echo Klasor: %REPO_DIR%
echo Tekrar calistirmak icin: glitch.bat
echo.
pause
