@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Glitch Code v2.0 - GlassesCat AI Kurulumu
color 0D

:: ─── ASCII Logo (renkli animasyonlu) ───
set "CYAN=[36m"
set "GREEN=[32m"
set "YELLOW=[33m"
set "MAGENTA=[35m"
set "RED=[31m"
set "BLUE=[34m"
set "RESET=[0m"

call :animate_logo
echo.
echo  %CYAN%=============================================%RESET%
echo  %GREEN%    GLITCH CODE v2.0%RESET%
echo  %YELLOW%    GlassesCat AI - Otonom Kod Asistani%RESET%
echo  %CYAN%=============================================%RESET%
echo.

:: ─── Bun kontrol ───
call :spinner "Bun kontrol ediliyor..."
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo  [%YELLOW%!%RESET%] Bun bulunamadi, kuruluyor...
    call :spinner "Bun indiriliyor..."
    powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://bun.sh/install.ps1' -OutFile '%TEMP%\bun_install.ps1'"
    powershell -ExecutionPolicy Bypass -File "%TEMP%\bun_install.ps1"
    echo  [%GREEN%OK%RESET%] Bun kuruldu
) else (
    for /f "tokens=*" %%i in ('bun --version') do set "BUN_VER=%%i"
    echo  [%GREEN%OK%RESET%] Bun: !BUN_VER!
)

:: ─── Bagimliliklar ───
echo.
echo  [2/4] Bagimliliklar yukleniyor...
call :progress_bar "bun install calisiyor" 20 60
call bun install >nul 2>&1
if %errorlevel% neq 0 (
    echo  [%RED%HATA%RESET%] bun install basarisiz!
    pause
    exit /b 1
)
echo  [%GREEN%OK%RESET%] Bagimliliklar hazir

:: ─── Config ───
echo.
echo  [3/4] Yapilandirma...
if not exist ".mimocode\command" (
    mkdir ".mimocode\command" >nul 2>&1
    echo. > ".mimocode\command\help-the-model.md"
    echo. > ".mimocode\command\supervise.md"
    echo  [%GREEN%OK%RESET%] .mimocode yapilandirildi
) else (
    echo  [%GREEN%OK%RESET%] .mimocode zaten hazir
)

:: ─── Baslat ───
echo.
echo  [4/4] Baslatiliyor...
call :progress_bar "GlassesCat AI motoru baslatiliyor" 30 50

echo.
echo  %CYAN%=============================================%RESET%
echo  %GREEN%    KURULUM BASARIYLA TAMAMLANDI!%RESET%
echo  %CYAN%=============================================%RESET%
echo.
echo  [^>] Klasor: %~dp0
echo  [^>] Calistir: glitch.bat
echo  [^>] Yardim: /help-the-model
echo  [^>] Denetim: /supervise
echo.
choice /C EN /M "Glitch Code simdi baslatilsin mi? [E]vet / [H]ayir"
if errorlevel 2 goto :skip
if errorlevel 1 (
    start "" cmd /c "glitch.bat"
    echo  [%GREEN%OK%RESET%] Glitch Code baslatildi!
)
:skip
echo.
pause
exit /b 0

:: ─── FUNCTIONS ─────────────────────────────────────

:spinner
set "spin_chars=|/-\"
set "spin_idx=0"
set /a "spin_end=%time:~-2%+3"
:spin_loop
set /a "spin_idx+=1"
if !spin_idx! gtr 3 set "spin_idx=0"
for /f %%a in ("!spin_idx!") do set "spin_char=!spin_chars:~%%a,1!"
set /a "spin_now=%time:~-2%"
if !spin_now! lss !spin_end! (
    <nul set /p "=[!spin_char!] %~1"
    ping -n 1 127.0.0.1 >nul
    goto :spin_loop
)
echo.
exit /b 0

:progress_bar
set "pbar_total=%~2"
set "pbar_delay=%~3"
if "%pbar_total%"=="" set "pbar_total=20"
if "%pbar_delay%"=="" set "pbar_delay=80"
for /l %%i in (1,1,%pbar_total%) do (
    set /a "pct=%%i * 100 / %pbar_total%"
    set /a "blocks=%%i * 50 / %pbar_total%"
    set "bar="
    for /l %%b in (1,1,!blocks!) do set "bar=!bar!█"
    for /l %%b in (!blocks!,1,49) do set "bar=!bar!░"
    <nul set /p "=[!bar!] !pct!%% %~1"
    ping -n 1 127.0.0.1 >nul
    for /l %%w in (1,1,%pbar_delay%) do ver>nul
)
echo.
exit /b 0

:animate_logo
set "logo_line1=   _____ _ _       _     _____          _        "
set "logo_line2=  / ____| (_)     | |   / ____|        | |       "
set "logo_line3= | |  __| |_  ___| |_ | |     ___   ___| | _____ "
set "logo_line4= | | |_ | | |/ _ \ __|| |    / _ \ / __| |/ / __|"
set "logo_line5= | |__| | | |  __/ |_ | |___| (_) | (__|   <\__ \"
set "logo_line6=  \_____|_|_|\___|\__|\_____\___/ \___|_|\_\___/"
echo.
for %%l in (%logo_line1% %logo_line2% %logo_line3% %logo_line4% %logo_line5% %logo_line6%) do (
    <nul set /p "=%CYAN%%%l%RESET%"
    echo.
    ping -n 1 127.0.0.1 >nul
)
exit /b 0
