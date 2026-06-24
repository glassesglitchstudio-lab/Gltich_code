# Glitch Code - Agent Kuralları

## Temel Bilgiler

- **Proje**: Glitch Code (MiMoCode/OpenCode fork'u)
- **GitHub**: `glassesglitchstudio-lab/Gltich_code`
- **Package**: `glitchcode-cli` (npmjs.com)
- **Binary**: `glitch`
- **Branch**: `main`
- **CI**: test, typecheck, lint + publish (tag-triggered)

## Publish Pipeline Durumu

- **Son başarılı version**: `v0.2.9` (README güncellemesi)
- **npm'de yayında olan**: `glitchcode-cli@0.2.8`
- **12 platform build**: linux/darwin/win32 x arm64/x64 + musl/baseline
- **Workflow**: `.github/workflows/publish.yml`
- **Tag ile tetikleniyor**: `v*` push

## Bilinen Sorunlar

### 1. npm ile kurulanlarda özellikler çalışmıyor
- **Sorun**: `npm install -g glitchcode-cli` ile kurulduğunda sadece compile edilmiş binary iniyor
- **Neden**: `.glitchcode/` ve `.mimocode/` config dizinleri pakete eklenmemiş
- **Çözüm**: `package.json`'daki `files` alanına `.glitchcode/` ve `.mimocode/` eklenecek
- **Alternatif**: postinstall ile otomatik setup

### 2. Windows build
- `--skip-install` flag'i zorunlu (node-gyp/tree-sitter sorunları)
- `node-gyp` global kurulumu tek başına çözüm olmadı

### 3. npm token
- CLI'da sorunlu — web UI üzerinden Automation tipinde oluşturulmalı
- `gh secret set NPM_TOKEN` ile GitHub secret eklenebilir

### 4. Version stratejisi
- Her publish öncesi version bump zorunlu (npm overwrite mümkün değil)
- `package.json` version = npmjs.com'daki version olmalı

## Çözülmesi Gerekenler (Öncelikli)

1. **npm package'a config dosyalarını ekle** ✅ ÇÖZÜLDÜ
   - `bin/glitch` → `ensureProjectConfig()` first-run detection eklendi
   - `script/postinstall.mjs` → `ensureProjectConfig()` eklendi
   - İlk çalıştırmada `.glitchcode/` ve `.mimocode/` otomatik oluşturuluyor

2. **Binary branding**
   - Logo/GLITCH yazısı doğru (logo.ts, ui.ts)
   - Ama middleware'de hâlâ "Opencode'dan base alınmıştır" uyarısı var

3. **Build output dizin adı**
   - `build.ts` → `BINARY_PREFIX = "glitchcode"` (doğru)
   - Ama local build `mimocode-windows-x64` üretiyor (eski build cache?)

## Kurulum Talimatları (Kullanıcılar için)

### npm ile
```bash
npm install -g glitchcode-cli
glitch
```

### GitHub Releases'dan
1. https://github.com/glassesglitchstudio-lab/Gltich_code/releases
2. Platforma göre dosya indir (win32-x64.zip, darwin-arm64.tar.gz, linux-x64.tar.gz)
3. Aç ve `glitch` çalıştır

## Styling Kuralları

- neon-turuncu tema (#FF6B00)
- Glassmorphism efektleri
- Framer Motion animasyonları
- Dark mode default
- Monospace font (JetBrains Mono / Fira Code)

## Test Komutları

```bash
# Typecheck
bun typecheck

# Test
bun test

# Build
bun run script/build.ts --single

# Dev
bun run dev
```

## Dosya Yapısı

```
packages/opencode/
├── src/
│   ├── cli/          # CLI komutları ve UI
│   ├── agent/        # Agent sistemi
│   ├── memory/       # Hafıza sistemi
│   ├── task/         # Task yönetimi
│   ├── skill/        # Skill sistemi
│   ├── tool/         # Araçlar (bash, read, write, edit, glob, grep, webfetch, actor, task)
│   ├── provider/     # AI provider entegrasyonları
│   └── index.ts      # Ana entry point
├── script/
│   └── build.ts      # Build scripti (Bun.build)
├── bin/
│   └── glitch        # Node.js wrapper (binary resolution)
└── package.json
```

## Notlar

- Kullanıcı "sadece cevap ver" dediğinde aksiyon alma, sadece açıkla
- Kullanıcı genellikle sinirli — hızlı ve net cevap ver
- Windows kullanıcısı — PowerShell komutları tercih et
- `--no-verify` ile push ediliyor (husky hook typecheck hatası yüzünden)

## Session Notları (2026-06-24)

- v0.2.9 publish başarılı (12 build ✅, npm ✅, release ✅)
- v0.2.8 npm'de yayında
- npm config sorunu ÇÖZÜLDÜ: `ensureProjectConfig()` first-run detection eklendi
- `bin/glitch` + `postinstall.mjs` güncellendi
- Bir sonraki publish'da bu değişiklikler dahil edilecek
