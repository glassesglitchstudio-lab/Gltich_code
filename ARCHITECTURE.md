# Glitch Code Mimarisi

## Genel Bakış

Glitch Code, Effect-TS üzerine inşa edilmiş terminal-merkezli bir AI kod asistanıdır. Provider-agnostic tasarım ile birden fazla LLM sağlayıcısını destekler.

## Temel Bileşenler

### 1. Session Sistemi (`src/session/`)

Oturum yönetimi, mesaj depolama ve context compaction'ı yönetir.

```
Session.Service
├── create()          # Yeni oturum oluştur
├── messages()        # Mesajları getir
├── compact()         # Context'i sıkıştır
└── checkpoint()      # Durum kaydı
```

**Önemli dosyalar:**
- `session.ts` — SessionService implementasyonu
- `message.ts` — Mesaj modelleri
- `prompt.ts` — System prompt oluşturma
- `compaction.ts` — Context window yönetimi

### 2. Provider Sistemi (`src/provider/`)

LLM sağlayıcılarını soyutlar. Tek arayüz üzerinden birden fazla model kullanılır.

```
Provider.Service
├── list()            # Mevcut provider'ları listele
├── resolve()         # Modeli çözümlle
└── auth()            # Kimlik doğrulama
```

**Desteklenen Provider'lar:**
- MiMo (varsayılan, ücretsiz)
- OpenAI (GPT-4o, o1)
- Anthropic (Claude)
- Google (Gemini)
- GitHub Copilot
- Cloudflare Workers AI
- Ollama (offline)

### 3. Tool Sistemi (`src/tool/`)

Agent'ların kullanabileceği araçları yönetir.

| Tool | Açıklama |
|------|----------|
| `bash` | Terminal komutu çalıştır |
| `read` | Dosya oku |
| `write` | Dosya yaz |
| `edit` | Dosya düzenle |
| `glob` | Dosya ara |
| `grep` | İçerik ara |
| `webfetch` | URL getir |
| `websearch` | Web'de ara |
| `actor` | Subagent oluştur |
| `task` | Görev takibi |
| `skill` | Skill çağır |
| `memory` | Hafıza ara |
| `lsp` | Language Server |

### 4. Agent Sistemi (`src/agent/`)

Farklı yeteneklere sahip agent türleri.

```
Agent Türleri:
├── build (varsayılan)  # Tam erişim, geliştirme için
├── plan                # Salt okunur analiz
├── compose             # Orkestrasyon
└── max (deneysel)      # Paralel aday çalıştırmalı
```

### 5. Actor/Subagent Sistemi (`src/actor/`)

Paralel ve izole görev çalıştırmayı yönetir.

```
Actor lifecycle:
spawn → running → completed/failed/cancelled
         ↓
    ReAct döngüsü (max 3 iterasyon)
         ↓
    postStop hook
```

**Önemli kavramlar:**
- `spawnPeer`: Yeni çocuk oturum oluşturur
- `spawnSubagent`: Mevcut oturum içinde actor
- `ForkContext`: Ebeveyn durumunu kopyalar
- `TaskGate`: Tamamlanma kontrolü

### 6. Skill Sistemi (`src/skill/`)

Markdown tabanlı talimat dosyaları. Agent davranışını değiştirir.

```
Skills dizini:
├── .glitchcode/skills/     # Proje özelinde
├── .claude/skills/         # Claude uyumlu
└── builtin_skills/         # Dahili skill'ler
```

### 7. Workflow Motoru (`src/workflow/`)

Deterministik JavaScript scriptleri ile multi-agent orkestrasyonu.

```javascript
export const meta = { name: "my-workflow", description: "..." }

phase("Araştırma")
const results = await parallel([
  agent("Araştır", { prompt: "..." }),
  agent("İncele", { prompt: "..." }),
])

phase("Uygulama")
await agent("Kodla", { prompt: "..." })
```

### 8. Memory Sistemi (`src/memory/`)

Kalıcı, dosya tabanlı hafıza yönetimi.

```
Memory türleri:
├── global      # Kullanıcı tercihleri
├── projects    # Proje bilgileri
├── sessions    # Oturum checkpoint'leri
└── cc          # Claude Code uyumlu
```

### 9. CLI Komutları (`src/cli/cmd/`)

Tüm CLI komutları bu dizinde bulunur.

**Temel komutlar:**
- `run` — Mesaj ile çalıştır
- `serve` — Headless sunucu
- `session` — Oturum yönetimi
- `providers` — Provider kimlik doğrulama

**Gelişmiş komutlar:**
- `plus-two-coder` — Multi-model debate
- `fix` — GitHub issue otomatik çözme
- `solve` — Görev parçalama
- `bench` — Model karşılaştırma
- `cost` — Maliyet takibi
- `audit` — Güvenlik denetimi

## Veri Akışı

```
Kullanıcı Girdisi
       ↓
   Session.Service.create()
       ↓
   System Prompt Oluşturma
       ↓
   Provider.Service.resolve()
       ↓
   generateText() / streamText()
       ↓
   Tool Çağrıları (varsa)
       ↓
   Yanıt Depolama
       ↓
   Checkpoint Yazma
```

## Build Sistemi

```
bun run script/build.ts
       ↓
   Migration'ları yükle
       ↓
   Web UI embed (devre dışı)
       ↓
   Bun.build() — compile seçeneği ile
       ↓
   Platform bazlı binary üretimi
       ↓
   dist/glitchcode-<platform>/bin/glitch
```

## CI/CD Pipeline

```
git tag v* → push
       ↓
   GitHub Actions Tetiklenir
       ↓
   ┌─────────────────────────────┐
   │  10 Platform Paralel Build  │
   │  (linux, darwin, win32)     │
   └─────────────────────────────┘
       ↓
   npm publish (glitchcode-cli)
       ↓
   GitHub Release (10 asset)
```

## Performans Notları

- ** cold start **: ~200ms (Bun runtime)
- **Tool çağrısı**: ~50ms overhead
- **Context compaction**: 10K token'da ~2s
- **Binary boyutu**: ~7MB (standalone)

## Güvenlik

- Provider anahtarları `.glitchcode/` altında saklanır
- `.env` dosyaları varsayılan olarak gizli
- `hardPermission` ile agent izinleri kısıtlanır
- OAuth flow'u browser üzerinden yürütülür

## Gelecek Planları

1. Real-time team collaboration
2. Plugin marketplace genişletme
3. Web UI aktifleştirme
4. Cross-compilation iyileştirme
5. Rate limiting ekleme
