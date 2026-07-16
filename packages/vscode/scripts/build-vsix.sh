#!/bin/bash

# Glitch Code VSIX Build Script
# Bu script VSIX dosyasını oluşturur ve GitHub Release'e yükler

set -e

echo "🔨 VSIX Build başlıyor..."

# Build
echo "📦 Extension build ediliyor..."
npm run build

# Package
echo "📋 VSIX paketleniyor..."
npx vsce package

# Find VSIX file
VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -1)

if [ -z "$VSIX_FILE" ]; then
  echo "❌ VSIX dosyası bulunamadı!"
  exit 1
fi

echo "✅ VSIX oluşturuldu: $VSIX_FILE"
echo ""
echo "📤 GitHub Release'e yüklemek için:"
echo "   1. GitHub Releases sayfasına git"
echo "   2. Yeni release oluştur"
echo "   3. $VSIX dosyasını asset olarak yükle"
echo ""
echo "📥 Kullanıcılar şu komutla kurabilir:"
echo "   code --install-extension $VSIX_FILE"
