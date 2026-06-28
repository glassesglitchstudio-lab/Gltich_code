<h1 align="center">Glitch Code</h1>

<p align="center"><strong>Glitch Code: Terminal-Native AI Coding Assistant</strong></p>

<p align="center">
  <a href="https://github.com/glassesglitchstudio-lab/Gltich_code">GitHub</a>
</p>

> ⚠️ **Bu proje [Opencode](https://github.com/opencode-ai/opencode)'dan base alınmıştır, [MiMoCode](https://mimo.xiaomi.com/coder)'un özelliklerini taşır.**
> Daha fazla geliştirilecektir. LICENSE dosyasına bakın.

Glitch Code is a terminal-native AI coding assistant. It can read and write code, run commands, manage Git, and use a persistent memory system to keep a deep understanding of your project across sessions while continuously improving itself.

MiMo Auto is built in as a free-for-limited-time channel, so you can start with zero configuration. Glitch Code also supports connecting to any mainstream LLM provider API, including GlassesCat models via Ollama.

---

## Kurulum

### npm ile (Önerilen)
```bash
npm install -g glitchcode-cli
glitch
```

### GitHub Releases'dan
1. https://github.com/glassesglitchstudio-lab/Gltich_code/releases adresine git
2. Platformuna göre dosyayı indir:
   - **Windows:** `windows-x64.zip` veya `windows-x64-baseline.zip`
   - **macOS Apple Silicon:** `darwin-arm64.tar.gz`
   - **macOS Intel:** `darwin-x64.tar.gz` veya `darwin-x64-baseline.tar.gz`
   - **Linux:** `linux-x64.tar.gz`, `linux-arm64.tar.gz`, `linux-x64-musl.tar.gz` vb.
3. Arşivi aç
4. Terminal'den `glitch` komutunu çalıştır

### Kaynaktan
```bash
git clone https://github.com/glassesglitchstudio-lab/Gltich_code.git
cd Gltich_code
bun install
bun run dev
```

İlk çalıştırmada `glitch init` ile kurulumu tamamla.

<details>
<summary><strong>WSL: clipboard issues</strong></summary>

WSL'de kopyalama sorunu yaşarsan:
```bash
sudo apt install xsel
```
</details>

---

## Core Features

### Multiple Agents

| Agent | Description |
|--------|------|
| **build** | Default. Full tool permissions for development |
| **plan** | Read-only analysis mode for code exploration and solution design |
| **compose** | Orchestration mode for specs-driven development and skill-driven workflows |

Press `Tab` to switch between primary agents. Subagents are created by the system as needed.

### Persistent Memory

Cross-session memory powered by SQLite FTS5 full-text search:

- **Project memory** (`MEMORY.md`) — persistent project knowledge, rules, and architecture decisions
- **Session checkpoint** (`checkpoint.md`) — structured state snapshots maintained automatically by the checkpoint-writer subagent
- **Scratch notes** (`notes.md`) — temporary note area for agents
- **Task progress** (`tasks/<id>/progress.md`) — per-task logs

Memory is injected automatically when a session resumes, so the agent does not need to relearn project context.

### Intelligent Context Management

- **Automatic checkpoints** — decides when to save session state based on the model context window
- **Context reconstruction** — when context approaches the limit, rebuilds it from the latest checkpoint, project memory, task progress, and retained recent messages so the agent can continue the current task
- **Budgeted injection** — uses a token budget to control how much checkpoint, memory, and notes content enters context, with importance ranking

### Task Tracking

A tree-shaped task system (`T1`, `T1.1`, `T1.2`, …) that integrates automatically with the checkpoint system, so task progress is preserved when sessions resume.

### Subagent System

The primary agent can create subagents on demand. Subagents share the current session context and can work in parallel, with lifecycle tracking, cancellation, and background execution.

### Goal / Stop Condition

The `/goal` command sets a stopping condition for a session. When the agent tries to stop, an independent judge model evaluates the conversation to decide whether the condition is truly satisfied — preventing premature "optimistic stops" during autonomous work.

### Compose Mode

Compose mode provides a structured workflow for specs-driven development. It includes built-in skills for planning, execution, code review, TDD, debugging, verification, and merging — orchestrating the full lifecycle from spec to shipped code.

### Voice Input

Real-time streaming voice input powered by TenVAD and MiMo ASR. Activate with `/voice`, then speak — audio is segmented by pauses and transcribed incrementally into the input. Available for MiMo logged-in users. Requires `sox` (`brew install sox` on macOS, other platforms similar).

<details>
<summary><strong>WSLg audio setup</strong></summary>

```bash
sudo apt install -y sox pulseaudio libasound2-plugins
export PULSE_SERVER=unix:/mnt/wslg/PulseServer
```
</details>

<details>
<summary><strong>SSH remote audio (Mac → remote host)</strong></summary>

```bash
# Mac (local)
brew install pulseaudio
pulseaudio --load="module-native-protocol-tcp auth-ip-acl=127.0.0.1" --exit-idle-time=-1 --daemonize
# Add to ~/.ssh/config: RemoteForward 4713 127.0.0.1:4713

# Remote host
apt install -y pulseaudio pulseaudio-utils sox
export PULSE_SERVER=tcp:127.0.0.1:4713
# Verify: pactl info
```
</details>

<details>
<summary><strong>Non-MiMo voice providers (OpenRouter, internal API, etc.)</strong></summary>

Voice input can route through other OpenAI-compatible providers via the `voice` config field. The ASR model (`mimo-v2.5-asr`) is only available on MiMo's platform; voice control mode (`mimo-v2.5`) is available on OpenRouter and compatible relay platforms.

**OpenRouter (voice control only):**

Use `/connect` to sign in to OpenRouter, then add to your config:
```jsonc
{
  "voice": {
    "control_model": "openrouter/xiaomi/mimo-v2.5"
  }
}
```

**Internal / self-hosted relay (both ASR and voice control):**
```jsonc
{
  "provider": {
    "internal": {
      "options": {
        "baseURL": "https://your-api-gateway.example.com/v1",
        "apiKey": "sk-..."
      },
      "models": {
        "xiaomi/mimo-v2.5-asr": { "name": "MiMo-V2.5-ASR" },
        "xiaomi/mimo-v2.5": { "name": "MiMo-V2.5" }
      }
    }
  },
  "voice": {
    "asr_model": "internal/xiaomi/mimo-v2.5-asr",
    "control_model": "internal/xiaomi/mimo-v2.5"
  }
}
```

Custom providers must register at least one model in their `models` field to be recognized. The model names in `voice.*_model` are sent directly to the API — they don't need to match the registered model keys exactly.

> **Note:** Models registered under a custom provider will appear in the model selection list. Don't use ASR-only models (e.g. `mimo-v2.5-asr`) as your primary coding model.

</details>

### Dream & Distill

- **`/dream`** — scans recent session traces, extracts persistent knowledge into project memory, and removes outdated entries
- **`/distill`** — discovers repeated manual workflows in recent work and packages high-confidence candidates into reusable skills, subagents, or commands

---

## CLI Commands

### Core

| Command | Description |
|---------|-------------|
| `glitch` | Start interactive TUI session |
| `glitch run <prompt>` | Run a prompt non-interactively |
| `glitch init` | Initialize project configuration |
| `glitch upgrade` | Upgrade to latest version |

### Multi-Model Debate

```bash
glitch plus-two-coder --task "Build a REST API with Express"
glitch ptc -t "Optimize this React component" -m "anthropic/claude-sonnet-4-20250514,openai/gpt-4o"
glitch debate -t "Design a database schema" --rounds 3
```

2-3 models debate and critique each other's solutions. Each round, every model proposes a solution, then another critiques it. After N rounds, a consensus is produced.

### Code Review

```bash
glitch review                    # Review uncommitted changes
glitch review --branch main      # Review branch vs main
glitch review --pr 42            # Review a GitHub PR
glitch review --format markdown  # Output as markdown
```

### Benchmark & Analytics

```bash
glitch benchmark                 # Session cost/token stats
glitch benchmark --days 7        # Last 7 days only
glitch benchmark --sort speed    # Sort by tokens/second
```

### Session Management

```bash
glitch share                     # Export current session
glitch history                   # Search session history
glitch history "auth bug"        # Search for specific topic
```

### Provider & Models

```bash
glitch providers login           # Authenticate with a provider
glitch models                    # List all available models
glitch models anthropic          # List models for a provider
```

### Offline Mode

```bash
glitch offline setup             # Configure local models (Ollama/LMStudio)
glitch offline status            # Check offline model status
glitch offline models            # List available local models
```

### Themes

```bash
glitch theme list                # List available themes
glitch theme set neon-orange     # Switch theme
```

### TUI Slash Commands

Inside the TUI, type `/` to access:

| Slash | Description |
|-------|-------------|
| `/share` | Share session |
| `/rename` | Rename session |
| `/compact` | Summarize session |
| `/undo` | Undo last message |
| `/redo` | Redo last message |
| `/export` | Export session |
| `/ptc` | Plus Two Coder |

---

## Configuration

MiMoCode is configured via `.mimocode/mimocode.json` in the project directory (or `~/.config/mimocode/mimocode.json` globally). Key options include:

- Provider and model selection
- Agent permissions and custom agents
- Checkpoint and memory behavior
- MCP server connections
- Keybindings and theme

Max Mode (parallel best-of-N reasoning with judge selection) can be enabled via `experimental.maxMode` in the config.

---

## Development

```bash
bun install              # Install dependencies
bun run dev              # Run in development mode
bun turbo typecheck      # Type check
```

---

## Relationship to OpenCode

MiMoCode is built as a fork of [OpenCode](https://github.com/XiaomiMiMo/MiMo-Code). It keeps all core OpenCode capabilities (multiple providers, TUI, LSP, MCP, plugins) and adds persistent memory, intelligent context management, subagent orchestration, goal-driven autonomous loops, compose workflows, and self-improvement via dream/distill.

---

## Community

Scan the QR code to join the community group chat:

<p align="center">
  <img src="assets/readme/community-qrcode.jpg" alt="Community group chat QR code" width="240">
</p>

---

## License

Source code is licensed under the [MIT License](./LICENSE).

Use of MiMoCode is also subject to the [Use Restrictions](./USE_RESTRICTIONS.md).
Use of Xiaomi MiMo-hosted services is subject to the [MiMo Terms of Service](https://platform.xiaomimimo.com/docs/terms/user-agreement).
Use of the MiMo name, logo, and trademarks is subject to the MiMo Trademark Policy.
