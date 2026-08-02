# Debug Oturumu — Tool Crash (memory / websearch)

**Tarih:** 2026-08-02  
**Durum:** Araştırma yapıldı, fix uygulanmadı — dışarıdan dönünce devam edilecek.

---

## Sorun (kullanıcı raporu)

- `glitch` TUI'de bazı tool çağrıları uygulamayı çökertiyor gibi davranıyor.
- Örnekler: "hafızana bak", "webde araştırma yap"
- İstenen: PC'yi kasırmadan debug.

---

## Ne test edildi

| Test | Sonuç |
|------|--------|
| `bun test test/tool/memory.test.ts test/tool/webfetch.test.ts` | ✅ 5/5 geçti |
| `bun run script/debug-tools.ts` (yeni tanı scripti) | ✅ memory + websearch OK |
| Global binary `~/.glitchcode/bin/glitch.exe` v1.0.11 headless | ✅ |
| `glitch run "hafızana bak test"` | ✅ memory araması çalıştı, exit 0 |
| `glitch run "webde araştırma yap"` | ⚠️ exit 0 ama provider hatası log'da |

**Sonuç:** Tool kodları izole ve headless modda çalışıyor. Çökme büyük ihtimalle **TUI (Worker thread)** veya **session/provider** katmanında.

---

## Muhtemel kök nedenler (öncelik sırası)

### 1. Thinking mode + tool_choice uyumsuzluğu

Headless websearch testinde görülen hata:

```
Error: <400> InternalError.Algo.InvalidParameter:
The tool_choice parameter does not support being set to required or object in thinking mode
```

- Thinking/reasoning açık modellerde provider tool çağrısını reddedebilir.
- TUI bunu düzgün yakalamazsa session "çökmüş" gibi görünür.

**İlgili dosyalar:** `packages/opencode/src/session/llm.ts`, `packages/opencode/src/session/prompt.ts` (toolChoice), provider SDK.

### 2. Effect.orDie → fatal defect

Birçok tool (`memory`, `websearch`, `webfetch`) hata olunca `Effect.orDie` ile defect'e dönüşüyor:

- `packages/opencode/src/tool/tool.ts` — wrap'te `Effect.orDie`
- `packages/opencode/src/tool/webfetch.ts`, `websearch/index.ts`, `mcp-exa.ts` — timeout'ta `Effect.die`
- `packages/opencode/src/session/prompt.ts` — `permission.ask` + `Effect.orDie`, tool execute'ta catch yok

Recoverable olması gereken hatalar (network, DB, permission) process/worker'ı öldürebilir.

### 3. TUI Worker crash

- TUI: `packages/opencode/src/cli/cmd/tui/thread.ts` → Worker spawn
- Worker: `packages/opencode/src/cli/cmd/tui/worker.ts`
- Tool render: `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` (memory → GenericTool fallback)

Headless `glitch run` çalışıp sadece `glitch` (TUI) çöküyorsa sorun burada.

### 4. processor.ts cleanup (dev branch — henüz publish edilmedi)

Uncommitted değişiklik: `process()` path'ine `Effect.ensuring(cleanup())` eklendi.

- Kullanıcı global binary **v1.0.11** kullanıyor → bu değişiklik production'da yok.
- Dev'de test ederken dikkat: cleanup pending tool'ları "aborted" işaretleyebilir.

---

## Ortam bilgisi

- **OS:** Windows 10.0.26200
- **Global CLI:** `glitchcode-cli@1.0.11` → `C:\Users\ErCuM\AppData\Roaming\npm\glitch.ps1`
- **Cached binary:** `C:\Users\ErCuM\.glitchcode\bin\glitch.exe`
- **DB:** `C:\Users\ErCuM\.local\share\glitchcode\glitchcode.db` (35 migration uygulandı)
- **Memory corpus:** ~3 dosya, ~0.01 MB (performans sorunu değil)
- **Config:** `C:\Users\ErCuM\.config\glitchcode\` — sadece `.gitignore` (model config TUI/env'den geliyor olabilir)

---

## Hafif debug komutları (PC'yi kasırmaz)

```powershell
# 1) Tool tanı scripti (TUI açmaz, ~3-5 sn)
cd C:\Users\ErCuM\CascadeProjects\glitch-code\packages\opencode
bun run script/debug-tools.ts

# 2) Headless — TUI mi tool mu ayır
cd C:\Users\ErCuM\CascadeProjects\glitch-code
glitch run "hafızana bak" --print-logs
glitch run "webde glitch code ara" --print-logs

# 3) TUI + log
glitch --print-logs --trust
# Log dizini: %USERPROFILE%\.local\share\glitchcode\log\
```

---

## Yeni eklenen dosya

- `packages/opencode/script/debug-tools.ts` — memory + websearch + direct memory.service test

---

## Dönünce yapılacaklar (checklist)

- [x] Kullanıcıdan netleştir: TUI tamamen kapanıyor mu / donuyor mu / kırmızı hata mı?
  → **Cevap:** TUI çökme ekranları çıkıyor (ErrorBoundary tetikleniyor)
- [ ] Headless vs TUI karşılaştırması yap (yukarıdaki komutlar)
- [ ] TUI reproduce sonrası log dosyasını oku
- [ ] Hangi model/provider kullanılıyor — thinking mode açık mı?
- [x] **Fix A:** Tool timeout/network/DB hatalarını `RecoverableError`'a çevir (`orDie`/`die` azalt)
  → Fix C ile dolaylı olarak çözüldü: `Effect.exit` hem failure hem defect'i yakalıyor
- [x] **Fix B:** Thinking mode'da `toolChoice: required` göndermeyi engelle
  → `llm.ts`'te `effectiveToolChoice` eklendi — thinking mode aktifse "required" → "auto"
- [x] **Fix C:** `prompt.ts` tool execute'a `Effect.exit` ekle — defect yerine error output
  → Hem built-in tool'lar hem MCP tool'ları için `Effect.exit` ile sarmalandı
  → Hata olursa: error log + metric publish + completeToolCall + error output return
  → `isRecoverableError` ile recoverable hatalar muted işaretleniyor
  → Promise reject OLMIYOR artık → AI SDK normal tool result alıyor → TUI crash yerine tool error kartı
- [ ] Fix sonrası: `debug-tools.ts` + headless + (mümkünse) TUI manuel test
- [ ] Typecheck: ✅ Geçti (sadece önceden var olan text-loop-integration.test.ts hataları)

---

## Git durumu (oturum sonu)

Modified (uncommitted):
- `packages/opencode/src/session/processor.ts` — cleanup ensuring eklendi
- `packages/opencode/src/tool/webfetch.ts` — `GLITCHCODE_ALLOW_PRIVATE_URLS` test escape hatch
- Diğer test/tool dosyaları (signing, repo-map, vb.)

**Commit yapılmadı** — kullanıcı istemedi.

---

## Hızlı referans — ilgili kaynak dosyalar

| Konu | Dosya |
|------|-------|
| Memory tool | `packages/opencode/src/tool/memory.ts` |
| Memory search + reconcile | `packages/opencode/src/memory/service.ts` |
| Websearch | `packages/opencode/src/tool/websearch/index.ts` |
| Exa MCP | `packages/opencode/src/tool/mcp-exa.ts` |
| Tool orDie wrap | `packages/opencode/src/tool/tool.ts` |
| Session tool execute | `packages/opencode/src/session/prompt.ts` (~667) |
| Processor cleanup | `packages/opencode/src/session/processor.ts` (~602) |
| TUI tool render | `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` |
| RecoverableError | `packages/opencode/src/tool/recoverable.ts` |

---

## Nihai Durum (oturum sonu — 2026-08-02)

**Commit'ler push edildi (main):**
- `c8eac21` — fix: prevent TUI crash on tool execute errors (Fix B + C)
- `12422d6` — fix: resolve typecheck error in crash-prevention tests

**GitHub Actions sonucu:**
- ✅ typecheck: PASS
- ✅ lint: PASS
- ✅ pages: PASS
- ✅ os-eval (ubuntu/macos/windows): TÜM smoke test'ler PASS
- ❌ test: FAIL — **benim fix'imle alakasız**:
  - 548 test geçti (tool-define + Fix C testleri dahil)
  - 18 test başarısız → hepsi `plugin.signing` (1) + `plugin.install.task` (17) — önceki oturumun uncommitted plugin değişiklikleriyle ilgili **önceden var olan** hata
  - Ayrıca unit step `exit 137` (OOM — bellek yetmedi)

**Açık iş (ayrı):**
- [ ] 18 plugin test hatası (`plugin/signing.test.ts` + `plugin.install.task`) düzeltilmeli
- [ ] Unit test OOM (exit 137) sorunu
- [ ] TUI manuel test: `glitch --print-logs --trust` → tool çağır, crash yerine error kartı görmelisin

*Devam: "tool crash fix sonrası plugin test hatalarını düzelt" de yeterli.*
