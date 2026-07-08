# UE5 AI Agent Plugin — Araştırma Raporu

**Tarih:** 2026-07-08 | **Derinlik:** Standard

---

## Yönetici Özeti

Unreal Engine 5 için AI agent plugin geliştirme, **MCP (Model Context Protocol)** üzerinden yapılabilir. Glitch Code CLI zaten MCP desteği içerdiği için, UE5 plugin'i onu subprocess olarak başlatıp stdin/stdout JSON-RPC ile iletişim kurabilir.

**Önerilen mimari:** C++ Plugin + Slate UI + MCP Subprocess (Glitch Code CLI)

---

## 1. Mevcut UE5 AI Plugin'leri

| Plugin | Yıldız | Özellik | MCP |
|--------|--------|---------|-----|
| **UnrealGenAISupport** | 623 | Multi-provider (OpenAI, Claude, Gemini) | Evet |
| **SpecialAgentPlugin** | 46 | 71+ tool, Python bridge | Evet |
| **unreal-ollama** | 16 | Yerel LLM (Ollama) | Hayır |

**Sonuç:** Sıfırdan başlamak yerine mevcut bir plugin'i fork edip Glitch Code entegrasyonu eklemek daha akıllıca.

---

## 2. UE5 Plugin Mimarisi

### Dosya Yapısı
```
GlitchCodeAI/
├── GlitchCodeAI.uplugin
├── Source/
│   ├── GlitchCodeAI/           # Runtime module
│   │   ├── GlitchCodeAI.Build.cs
│   │   ├── Public/
│   │   └── Private/
│   └── GlitchCodeAIEditor/     # Editor module
│       ├── GlitchCodeAIEditor.Build.cs
│       ├── Public/
│       └── Private/
│           ├── GlitchCodeAIEditorModule.cpp
│           ├── GlitchCodeAIPanel.h
│           ├── GlitchCodeAIPanel.cpp
│           └── GlitchCodeAIConnector.h
```

### Modül Tipleri
- **Runtime** — Blueprint API, data structures
- **Editor** — UI panel, toolbar, menu

### Editor Uzantıları
- `UToolMenus` → Toolbar butonu
- `FGlobalTabmanager` → Custom panel (SDockTab)
- `Slate` → UI widgets (SNew, SVerticalBox)

---

## 3. Glitch Code Entegrasyonu (3 Seçenek)

### Seçenek A: MCP Subprocess (Önerilen)
```
UE5 Plugin → CreateProc("glitch mcp") → stdin/stdout JSON-RPC
```
- **Avantaj:** Doğrudan, düşük gecikme, stateful
- **Dezavantaj:** Subprocess yönetimi

### Seçenek B: HTTP Server
```
UE5 Plugin → FHttpModule → localhost:3000 → Glitch Code HTTP
```
- **Avantaj:** Platform bağımsız, test edilebilir
- **Dezavantaj:** Ekstra HTTP endpoint gerekli

### Seçenek C: Named Pipe (IPC)
```
UE5 Plugin → Win32 Named Pipe → Glitch Code
```
- **Avantaj:** Yüksek performans
- **Dezavantaj:** Platform-specific, karmaşık

---

## 4. Önerilen Mimari

```
┌─────────────────────────────────────────────────┐
│              UE5 Editor                         │
│  ┌─────────────────────────────────────────┐    │
│  │  GlitchCodeAI Panel (Slate)             │    │
│  │  ┌─────────────────────────────────┐    │    │
│  │  │  Chat UI                        │    │    │
│  │  │  - Mesaj girişi (SEditableText) │    │    │
│  │  │  - Yanıt gösterimi (SRichText)  │    │    │
│  │  │  - Aksiyon butonları            │    │    │
│  │  └─────────────────────────────────┘    │    │
│  │  ┌─────────────────────────────────┐    │    │
│  │  │  GlitchCodeConnector            │    │    │
│  │  │  - FPlatformProcess::CreateProc │    │    │
│  │  │  - CreatePipe() + ReadPipe()    │    │    │
│  │  │  - AsyncTask thread management  │    │    │
│  │  └─────────────────────────────────┘    │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
                        │
                        ▼ MCP (stdin/stdout JSON-RPC)
┌─────────────────────────────────────────────────┐
│        Glitch Code CLI                          │
│  - `glitch mcp` subcommand                     │
│  - AI model ile iletişim                        │
│  - Tool calling (bash, read, edit, etc.)        │
│  - Memory management                            │
│  - UE5-specific tools (spawn actor, edit BP)    │
└─────────────────────────────────────────────────┘
```

---

## 5. UE5-Specific Tool'lar

Glitch Code'a eklenebilecek özel tool'lar:

| Tool | Amaç | Örnek |
|------|------|-------|
| `ue5-spawn-actor` | Sahneye actor ekle | `ue5-spawn-actor Cube location=0,0,100` |
| `ue5-edit-blueprint` | Blueprint düzenle | `ue5-edit-blueprint MyBP add-node` |
| `ue5-compile` | Blueprint derle | `ue5-compile MyBP` |
| `ue5-play` | Oyunu başlat/durdur | `ue5-play` |
| `ue5-screenshot` | Ekran görüntüsü al | `ue5-screenshot output.png` |
| `ue5-list-actors` | Sahnedeki actor'ları listele | `ue5-list-actors` |
| `ue5-property` | Actor property'sini değiştir | `ue5-property MyActor location=100,0,0` |

---

## 6. Implementasyon Adımları

### Aşama 1: Temel Plugin (1-2 gün)
1. Plugin iskeleti oluştur (uplugin, Build.cs, modüller)
2. Slate paneli kaydet (FGlobalTabmanager)
3. Basit chat UI oluştur

### Aşama 2: Glitch Code Connector (2-3 gün)
1. `FPlatformProcess::CreateProc` ile Glitch Code başlat
2. stdin/stdout pipe'ları oluştur
3. JSON-RPC mesajlaşma
4. AsyncTask ile thread yönetimi

### Aşama 3: UE5 Tool'lar (3-5 gün)
1. Glitch Code'a `ue5-*` tool'ları ekle
2. UE5 API çağrıları (Actor spawning, BP editing)
3. Hot-reload desteği

### Aşama 4: Polish (2-3 gün)
1. Hata yönetimi
2. Streaming yanıtlar
3. Ayarlar paneli
4. Dökümantasyon

---

## 7. Kaynaklar

- [UE5 Plugin Docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/creating-ue5-plugins)
- [Slate UI Framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/slate-ui-framework-in-unreal-engine)
- [UnrealGenAISupport](https://github.com/prajwalshettydev/UnrealGenAISupport)
- [SpecialAgentPlugin](https://github.com/ArtisanGameworks/SpecialAgentPlugin)
- [MCP Specification](https://modelcontextprotocol.io)

---

## Sonuç

Glitch Code + UE5 entegrasyonu **MCP subprocess** üzerinden yapılabilir. En hızlı yol: mevcut bir plugin'i fork edip Glitch Code connector eklemek. Yaklaşık **8-13 günde** çalışan bir MVP oluşturulabilir.
