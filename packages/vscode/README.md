# Glitch Code - VS Code Extension

AI-powered coding assistant with 40+ providers, integrated directly into VS Code.

## Features

- **Chat Panel** — Sidebar'dan AI ile sohbet
- **Fix Selection** — Seçili kodu otomatik düzelt
- **Solve Task** — Karmaşık görevleri planla ve çöz
- **Session Management** — Oturumları oluştur, listele, değiştir
- **Model Selection** — 40+ model arasından seçim yap
- **Diff View** — Kod değişikliklerini karşılaştır
- **Terminal Integration** — Glitch terminal'ini VS Code'a entegre et
- **Status Bar** — Bağlantı durumu ve model bilgisi

## Installation

### From VSIX

```bash
cd packages/vscode
npm install
npm run build
npx vsce package
code --install-extension glitch-code-0.3.0.vsix
```

### From Source

```bash
cd packages/vscode
npm install
npm run watch
# Press F5 in VS Code to launch Extension Development Host
```

## Usage

1. **Start Server**: Extension otomatik olarak `glitch serve` başlatır
2. **Open Chat**: Activity bar'dan Glitch ikonuna tıklayın veya `Ctrl+Shift+G`
3. **Chat**: Mesajınızı yazın ve Enter'a basın
4. **Fix Code**: Kodu seçin ve `Ctrl+Shift+F` veya komut paletinden "Glitch: Fix Selection"
5. **Solve Task**: Komut paletinden "Glitch: Solve Task" seçin

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `glitch.chat` | `Ctrl+Shift+G` | Open chat panel |
| `glitch.fix` | - | Fix selected code |
| `glitch.solve` | - | Solve a task |
| `glitch.session.new` | - | Create new session |
| `glitch.session.list` | - | List sessions |
| `glitch.model.select` | - | Select model |
| `glitch.status` | - | Check server status |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `glitch.server.port` | `4096` | Server port |
| `glitch.server.autoStart` | `true` | Auto-start server |
| `glitch.server.hostname` | `127.0.0.1` | Server hostname |

## Requirements

- VS Code 1.85.0 or higher
- Node.js 18.0.0 or higher
- Glitch Code CLI installed (`npm install -g glitchcode-cli`)

## License

MIT
