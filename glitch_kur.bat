@echo off
chcp 65001 >nul
title Glitch Code - Kurulum
color 0D

echo ========================================
echo    GLITCH CODE - KURULUM ARACi
echo    Windows 10 Destegi
echo ========================================
echo.

:: -- Node.js kontrolu --
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js bulunamadi!
    echo [1] Node.js indiriliyor...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.0.0/node-v22.0.0-x64.msi' -OutFile '%TEMP%\node_installer.msi'"
    echo [2] Node.js kuruluyor...
    start /wait msiexec /i "%TEMP%\node_installer.msi" /quiet /norestart
    echo [OK] Node.js kuruldu
) else (
    echo [OK] Node.js: node --version
    for /f "tokens=*" %%i in ('node --version') do echo     %%i
)

:: -- Bun kontrolu --
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Bun bulunamadi, kuruluyor...
    powershell -Command "Invoke-WebRequest -Uri 'https://bun.sh/install' -OutFile '%TEMP%\bun_install.ps1'"
    powershell -ExecutionPolicy Bypass -File "%TEMP%\bun_install.ps1"
    echo [OK] Bun kuruldu
) else (
    echo [OK] Bun: bun --version
    for /f "tokens=*" %%i in ('bun --version') do echo     %%i
)

:: -- Repo kontrolu --
if not exist "%USERPROFILE%\Gltich_code" (
    echo [!] Glitch Code indiriliyor...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/glassesglitchstudio-lab/Gltich_code/archive/refs/heads/main.zip' -OutFile '%TEMP%\glitch.zip'"
    powershell -Command "Expand-Archive -Path '%TEMP%\glitch.zip' -DestinationPath '%USERPROFILE%' -Force"
    rename "%USERPROFILE%\Gltich_code-main" "Gltich_code"
    echo [OK] Glitch Code indirildi
) else (
    echo [OK] Glitch Code klasoru mevcut
)

:: -- Bagimliliklari yukle --
cd /d "%USERPROFILE%\Gltich_code"
echo [!] Bagimliliklar yukleniyor (bun install)...
call bun install >nul 2>&1
echo [OK] Bagimliliklar hazir

:: -- Calistir --
echo.
echo ========================================
echo    GLITCH CODE BASLATILIYOR...
echo ========================================
echo.
start glitch.bat
echo.
echo Glitch Code baslatildi!
echo Klasor: %USERPROFILE%\Gltich_code
echo.
pause
