<h1 align="center">Glitch Code</h1>

<p align="center"><strong>Terminal-Native AI Coding Assistant</strong></p>

<p align="center">
  <a href="https://github.com/glassesglitchstudio-lab/Gltich_code">GitHub</a> •
  <a href="https://www.npmjs.com/package/glitchcode-cli">npm</a> •
  <a href="https://github.com/glassesglitchstudio-lab/Gltich_code/releases">Releases</a>
</p>

> Bu proje [Opencode](https://github.com/opencode-ai/opencode)'dan base alınmıştır.
> LICENSE dosyasına bakın.

Glitch Code, terminal-merkezli bir AI kod asistanıdır. Kod okuyup yazabilir, komut çalıştırabilir, Git yönetebilir ve kalıcı hafıza sistemi ile projenizi oturumlar arası anlayabilir.

MiMo Auto varsayılan olarak ücretsizdir — sıfır yapılandırma ile başlayabilirsiniz. Ayrıca OpenAI, Anthropic, Google, GitHub Copilot, Cloudflare ve Ollama gibi tüm ana LLM sağlayıcılarını destekler.

---

## Kurulum

### npm ile (Önerilen)
```bash
npm install -g glitchcode-cli
glitch
```

### GitHub Releases'dan
1. [Releases](https://github.com/glassesglitchstudio-lab/Gltich_code/releases) adresine git
2. Platformuna göre dosyayı indir (aşağıdaki tabloya bak)
3. Arşivi aç ve `glitch` çalıştır

### Kaynaktan
```bash
git clone https://github.com/glassesglitchstudio-lab/Gltich_code.git
cd Gltich_code
bun install
bun run dev
```

---

## Hızlı Başlangıç

```bash
# Yeni proje başlat
glitch

# Tek mesaj ile çalıştır
glitch run "Bu projeyi analiz et ve özetle"

# Devam eden oturumu sürdür
glitch --continue

# Belirli bir model ile
glitch --model anthropic/claude-sonnet-4-20250514
```

---

## Platform Desteği

| Platform | Durum | Binary |
|----------|-------|--------|
| Linux x64 (glibc) | ✅ Tam destek | `linux-x64.tar.gz` |
| Linux x64 (musl) | ✅ Tam destek | `linux-x64-musl.tar.gz` |
| Linux x64 baseline | ✅ Tam destek | `linux-x64-baseline.tar.gz` |
| Linux ARM64 | ✅ Tam destek | `linux-arm64.tar.gz` |
| Linux ARM64 (musl) | ✅ Tam destek | `linux-arm64-musl.tar.gz` |
| macOS x64 (Intel) | ✅ Tam destek | `darwin-x64.tar.gz` |
| macOS ARM64 (Apple Silicon) | ✅ Tam destek | `darwin-arm64.tar.gz` |
| Windows x64 | ✅ Tam destek | `windows-x64.zip` |
| Windows x64 baseline | ✅ Tam destek | `windows-x64-baseline.zip` |
| Windows ARM64 | ⚠️ Sınırlı | Native modül desteği yok |

---

## Temel Özellikler

### Multi-Model Debate (PlusTwoCoder)

2-3 model birbiriyle tartışarak en iyi kod çözümünü üretir:

```bash
# Tek tartırmа
glitch plus-two-coder --task "REST API oluştur"

# Özel modeller ile
glitch ptc --task "Auth sistemi kur" --models "anthropic/claude-sonnet-4-20250514,openai/gpt-4o"

# 3 tur tartışma
glitch debate --task "Cache sistemi tasarla" --rounds 3
```

### GitHub Issue Otomatik Çözümleme (Fix)

7 aşamalı pipeline ile GitHub issue'larını otomatik çözer:

```bash
# Issue'yu çöz
glitch fix https://github.com/user/repo/issues/42

# Sadece planı göster
glitch fix https://github.com/user/repo/issues/42 --dry-run

# Debate modu ile
glitch fix https://github.com/user/repo/issues/42 --debate
```

**7 Aşama:**
1. Issue Triage
2. Planning
3. File Discovery
4. Code Proposal (+ debate modu)
5. Review & Revision (Technical + Style + Security)
6. Apply & Test
7. Git & PR

### Görev Parçalama (Solve)

Büyük görevleri alt görevlere bölüp paralel çalıştırır:

```bash
glitch solve "Bu projeye JWT authentication ekle"
glitch solve "Test coverage'ı %80'e çıkar" --dry-run
glitch solve "10 dosyadaki refactor'ü yap" -m anthropic/claude-sonnet-4-20250514
```

### Maliyet Takibi (Cost)

Token kullanımını ve maliyetleri takip eder:

```bash
glitch cost                    # Son 7 günün özeti
glitch cost --days 30          # Son 30 gün
glitch cost --daily            # Günlük dağılım
glitch cost --model claude     # Sadece belirli model
```

### Multi-Model Benchmark

Aynı görevi farklı modellere çalıştırıp karşılaştırır:

```bash
glitch bench --prompt "Fibonacci fonksiyonu yaz"
glitch bench -p "REST API tasarla" --models "openai/gpt-4o,anthropic/claude-sonnet-4-20250514"
glitch bench -p "Test yaz" --rounds 3
```

### Güvenlik Denetimi (Audit)

Bagımlılıklardaki güvenlik açıklarını tarar:

```bash
glitch audit                   # Tam denetim
glitch audit --format summary  # Özet rapor
glitch audit --fix             # Otomatik düzeltme
```

### Oturum Tekrarı (Replay)

Eski oturumları tekrar oynatır:

```bash
glitch replay                  # Son 5 oturumu listele
glitch replay --session abc123 # Belirli oturumu göster
glitch replay --search "auth"  # Mesajlarda ara
```

### Otomatik Changelog

Git commit'lerinden CHANGELOG üretir:

```bash
glitch changelog                       # Son tag'den HEAD'e
glitch changelog --from v0.2.30        # Belirli aralık
glitch changelog --output CHANGELOG.md # Dosyaya yaz
```

---

## Tüm Komutlar

| Komut | Açıklama |
|-------|----------|
| `glitch` | TUI'yi başlat (varsayılan) |
| `glitch run` | Mesaj ile çalıştır |
| `glitch serve` | Headless sunucu |
| `glitch providers` | Provider kimlik doğrulama |
| `glitch models` | Mevcut modelleri listele |
| `glitch session` | Oturum yönetimi |
| `glitch export` | Oturum dışa aktar |
| `glitch import` | Oturum içe aktar |
| `glitch stats` | Token istatistikleri |
| `glitch debug` | Hata ayıklama araçları |
| `glitch plus-two-coder` | Multi-model debate |
| `glitch fix` | GitHub issue çöz |
| `glitch solve` | Görev parçalama |
| `glitch cost` | Maliyet takibi |
| `glitch bench` | Model karşılaştırma |
| `glitch audit` | Güvenlik denetimi |
| `glitch replay` | Oturum tekrarı |
| `glitch changelog` | Changelog üretme |
| `glitch review` | Kod inceleme |
| `glitch suggest` | Öneri sistemi |
| `glitch theme` | Tema yönetimi |
| `glitch offline` | Offline model desteği |
| `glitch history` | Oturum geçmişi |
| `glitch onboard` | interaktif başlangıç |
| `glitch share` | Oturum paylaşımı |
| `glitch upgrade` | Güncelleme |

---

## Provider Kurulumu

### MiMo (Varsayılan — Ücretsiz)
```bash
glitch providers
# Browser OAuth ile otomatik bağlan
```

### OpenAI
```bash
glitch providers
# API key gir
```

### Anthropic
```bash
glitch providers
# API key gir
```

### GitHub Copilot
```bash
glitch providers
# Device Code OAuth ile bağlan
```

### Ollama (Offline)
```bash
# Ollama'yı yükle ve başlat
ollama serve

# Model indir
ollama pull codellama

# Glitch'e ekle
glitch offline
```

---

## TUI Slash Komutları

TUI içinde `/` yazarak erişilebilir:

| Komut | Açıklama |
|-------|----------|
| `/share` | Oturumu paylaş |
| `/rename` | Oturumu yeniden adlandır |
| `/compact` | Oturumu özetle |
| `/undo` | Son mesajı geri al |
| `/redo` | Mesajı tekrarla |
| `/export` | Oturumu dışa aktar |
| `/ptc` | Plus Two Coder |
| `/help` | Yardım |

---

## Geliştirici Rehberi

### Kurulum
```bash
git clone https://github.com/glassesglitchstudio-lab/Gltich_code.git
cd Gltich_code
bun install
bun run dev
```

### Testler
```bash
bun test                        # Tüm testler
bun test test/cli/cmd/          # Sadece CLI testleri
```

### Typecheck
```bash
bun typecheck                   # veya: bun turbo typecheck
```

### Build
```bash
# Yerel build
bun run script/build.ts --single --skip-install

# Tam build (CI)
bun run script/build.ts
```

### Yeni Komut Ekleme
1. `packages/opencode/src/cli/cmd/` altına dosya oluştur
2. `cmd()` pattern'ini kullan
3. `index.ts`'e import ve `.command()` ekle
4. Test oluştur

Detaylı bilgi için [CONTRIBUTING.md](CONTRIBUTING.md) ve [ARCHITECTURE.md](ARCHITECTURE.md)'ye bakın.

---

## Mimari

```
packages/opencode/src/
├── cli/cmd/           # 25+ CLI komutu
├── agent/             # Agent sistemi
├── session/           # Oturum yönetimi
├── tool/              # 15+ araç (bash, read, write, edit...)
├── provider/          # 20+ LLM sağlayıcısı
├── memory/            # Kalıcı hafıza
├── skill/             # Skill sistemi
├── actor/             # Subagent/orkestrasyon
├── workflow/          # Workflow motoru
└── task/              # Görev takibi
```

Detaylı mimari için [ARCHITECTURE.md](ARCHITECTURE.md)'ye bakın.

---

## Katkıda Bulunma

[CONTRIBUTING.md](CONTRIBUTING.md) dosyasındaki adımları takip edin.

---

## Topluluk

<p align="center">
  <img src="assets/readme/community-qrcode.jpg" alt="Topluluk sohbeti QR kodu" width="240">
</p>

---

## Lisans

Kaynak kodu [MIT Lisansı](./LICENSE) altında lisanslanmıştır.
