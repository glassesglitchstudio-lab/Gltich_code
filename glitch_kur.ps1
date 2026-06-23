#requires -version 5.1

<#
  Glitch Code v2.0 - GlassesCat AI Kurulum Asistani
  Modern PowerShell installer with animations and logo
#>

$Host.UI.RawUI.WindowTitle = "Glitch Code v2.0 - GlassesCat AI Kurulumu"
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "White"
Clear-Host

# ─── ASCII LOGO ───────────────────────────────────────────

$LOGO = @"
  ${CYAN}_____ _ _       _     _____          _        ${RESET}
 ${CYAN}/ ____| (_)     | |   / ____|        | |       ${RESET}
${CYAN}| |  __| |_  ___| |_ | |     ___   ___| | _____ ${RESET}
${CYAN}| | |_ | | |/ _ \ __|| |    / _ \ / __| |/ / __|${RESET}
${CYAN}| |__| | | |  __/ |_ | |___| (_) | (__|   <\__ \${RESET}
 ${CYAN}\_____|_|_|\___|\__|\_____\___/ \___|_|\_\___/${RESET}
${YELLOW}  🚀 GlassesCat AI - Otonom Kod Asistani v2.0${RESET}
"@

function Write-AnimatedLogo {
    param([int]$Speed = 30)
    
    $colors = @("Cyan", "Green", "Yellow", "Magenta", "Red", "Blue")
    
    foreach ($line in $LOGO -split "`n") {
        foreach ($char in $line.ToCharArray()) {
            if ($char -ne ' ') {
                $r = Get-Random -Minimum 0 -Maximum $colors.Length
                Write-Host $char -ForegroundColor $colors[$r] -NoNewline
            } else {
                Write-Host " " -NoNewline
            }
            Start-Sleep -Milliseconds ($Speed / 3)
        }
        Write-Host ""
    }
}

# ─── ANIMATED SPINNER ────────────────────────────────────

function Show-Spinner {
    param(
        [string]$Message,
        [scriptblock]$Script,
        [string]$SuccessMessage = "✓ Bitti"
    )
    
    $spinner = @('|', '/', '-', '\')
    $job = Start-Job -ScriptBlock $Script
    $i = 0
    
    while ($job.State -eq 'Running') {
        $s = $spinner[$i % $spinner.Length]
        Write-Host "`r  [$s] $Message " -NoNewline -ForegroundColor Cyan
        $i++
        Start-Sleep -Milliseconds 150
    }
    
    $result = Receive-Job $job -Wait -AutoRemoveJob
    Write-Host "`r  [✓] $SuccessMessage " -ForegroundColor Green
    return $result
}

# ─── PROGRESS BAR ─────────────────────────────────────────

function Show-ProgressBar {
    param(
        [string]$Message,
        [int]$Total = 100,
        [int]$Delay = 50
    )
    
    for ($i = 0; $i -le $Total; $i++) {
        $pct = [math]::Round($i / $Total * 100)
        $bar = "[" + ("█" * [math]::Floor($i / 4)) + ("░" * (25 - [math]::Floor($i / 4))) + "]"
        Write-Host "`r  $Message $bar $pct% " -NoNewline -ForegroundColor Yellow
        Start-Sleep -Milliseconds $Delay
    }
    Write-Host ""
}

# ─── MAIN SETUP ───────────────────────────────────────────

Clear-Host
Write-Host "`n" * 3 -NoNewline
Write-AnimatedLogo -Speed 20
Write-Host "`n"
Write-Host "  GlassesCat AI Kurulum Asistani baslatiliyor..." -ForegroundColor Green
Start-Sleep -Milliseconds 800

Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║      ${YELLOW}GLITCH CODE v2.0 - KURULUM${RESET}${CYAN}              ║" -ForegroundColor Cyan
Write-Host "  ║      ${YELLOW}GlassesCat AI Otonom Kod Asistani${RESET}${CYAN}       ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── STEP 1: Bun check ────────────────────────────────────

Write-Host "  [1/4] Bagimliliklar kontrol ediliyor..." -ForegroundColor White
Start-Sleep -Milliseconds 300

$bunVersion = Show-Spinner -Message "Bun kontrol ediliyor..." -SuccessMessage "Bun hazir" -Script {
    $v = & bun --version 2>$null
    if (-not $v) { return $null }
    return $v
}

if (-not $bunVersion) {
    Write-Host "  [!] Bun bulunamadi, kuruluyor..." -ForegroundColor Yellow
    Show-Spinner -Message "Bun indiriliyor..." -SuccessMessage "Bun kuruldu" -Script {
        Invoke-WebRequest -Uri 'https://bun.sh/install.ps1' -OutFile "$env:TEMP\bun_install.ps1" -UseBasicParsing
        & "$env:TEMP\bun_install.ps1"
    }
} else {
    Write-Host "  [OK] Bun: $bunVersion" -ForegroundColor Green
}

# ─── STEP 2: Dependencies ─────────────────────────────────

Write-Host ""
Write-Host "  [2/4] Bagimliliklar yukleniyor..." -ForegroundColor White
Start-Sleep -Milliseconds 200

$deps = Show-Spinner -Message "bun install calisiyor..." -SuccessMessage "Bagimliliklar hazir" -Script {
    Set-Location -LiteralPath $PSScriptRoot
    & bun install 2>&1 | Out-Null
    return $LASTEXITCODE
}

if ($deps -ne 0 -and $null -ne $deps) {
    Write-Host "  [HATA] bun install basarisiz!" -ForegroundColor Red
    Write-Host "  Manuel: bun install" -ForegroundColor Yellow
    pause
    exit 1
}

# ─── STEP 3: Config ─────────────────────────────────────

Write-Host ""
Write-Host "  [3/4] Yapilandirma..." -ForegroundColor White
Start-Sleep -Milliseconds 200

$mimoDir = Join-Path $PSScriptRoot ".mimocode"
$cmdDir = Join-Path $mimoDir "command"

if (-not (Test-Path $cmdDir)) {
    New-Item -ItemType Directory -Path $cmdDir -Force | Out-Null
    
    # Create command files
    @"
---
title: "/help-the-model"
description: "GlassesCat Model Router — suggests best model for your task, with auto fallback"
group: "GlassesCat"
---

You are the GlassesCat Model Router. Analyze the user's task and route it to the best model.

**Model hierarchy:**
1. X_FABLE_CODER_V1 — primary (Berkay's personal model)
2. V7_HYBRID_TITAN — deep reasoning / security
3. V6_OMNI_OVERLORD — 128K long context
4. V5_NEXUS_CORE — fast execution
5. MiMo Auto — fallback (1M context)

**User task:** `ARGUMENTS`

Analyze the task and:
1. Recommend the best model with reasoning
2. If the user mentions failure, suggest the next model in hierarchy
3. Explain why you chose that model
"@ | Out-File -FilePath (Join-Path $cmdDir "help-the-model.md") -Encoding utf8
    
    @"
---
title: "/supervise"
description: "GlassesCat Auto-Supervision — run self-supervision on the last task"
group: "GlassesCat"
---

Run the self-supervision tool on the current session to check for:
- 🔍 Subagent errors (error patterns, crashes, exceptions)
- ⚠️ Agent flaws (TODO, @ts-ignore, hardcoded values)
- 🎯 Prompt quality (short/ambiguous prompts)
- 🛡️ Consistency check (plan vs output mismatch)

Usage: /supervise [mode]

Modes:
- `all` (default) — runs all 4 checks
- `scan` — subagent error scan only
- `flaws` — agent flaw review only
- `audit` — prompt audit only
- `consistency` — consistency check only
"@ | Out-File -FilePath (Join-Path $cmdDir "supervise.md") -Encoding utf8

    Write-Host "  [OK] .mimocode yapilandirildi" -ForegroundColor Green
} else {
    Write-Host "  [OK] .mimocode zaten hazir" -ForegroundColor Green
}

# ─── STEP 4: Launch ─────────────────────────────────────

Write-Host ""
Write-Host "  [4/4] Baslatiliyor..." -ForegroundColor White
Start-Sleep -Milliseconds 300

Show-ProgressBar -Message "GlassesCat AI motoru baslatiliyor" -Total 30 -Delay 80

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║          ✅ KURULUM BASARIYLA TAMAMLANDI        ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  📂 Klasor: $PSScriptRoot" -ForegroundColor White
Write-Host "  🚀 Calistirmak icin: glitch.bat" -ForegroundColor Yellow
Write-Host "  🔧 Yardim: /help-the-model (model secimi)" -ForegroundColor Gray
Write-Host "  🔍 Denetim: /supervise (oto-denetim)" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "  Glitch Code simdi baslatilsin mi? (E/H)"
if ($choice -eq "E" -or $choice -eq "e") {
    Write-Host ""
    Write-Host "  🚀 GlassesCat AI baslatiliyor..." -ForegroundColor Green
    Start-Sleep -Milliseconds 500
    Start-Process -FilePath "cmd" -ArgumentList "/c", "cd /d `"$PSScriptRoot`" && glitch.bat"
} else {
    Write-Host "  Tamam, manuel baslat: glitch.bat" -ForegroundColor Gray
}

pause
