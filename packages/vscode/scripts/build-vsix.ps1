# Glitch Code VSIX Build Script (PowerShell)

Write-Host "🔨 VSIX Build basliyor..." -ForegroundColor Cyan

# Build
Write-Host "📦 Extension build ediliyor..." -ForegroundColor Yellow
npm run build

# Package
Write-Host "📋 VSIX paketleniyor..." -ForegroundColor Yellow
npx vsce package

# Find VSIX file
$VSIX_FILE = Get-ChildItem -Filter "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $VSIX_FILE) {
    Write-Host "❌ VSIX dosyasi bulunamadi!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ VSIX olusturuldu: $($VSIX_FILE.Name)" -ForegroundColor Green
Write-Host ""
Write-Host "📤 GitHub Release'e yuklemek icin:" -ForegroundColor Cyan
Write-Host "   1. GitHub Releases sayfasina git"
Write-Host "   2. Yeni release olustur"
Write-Host "   3. $($VSIX_FILE.Name) dosyasini asset olarak yukle"
Write-Host ""
Write-Host "📥 Kullaniciilar su komutla kurabilir:" -ForegroundColor Cyan
Write-Host "   code --install-extension $($VSIX_FILE.Name)"
