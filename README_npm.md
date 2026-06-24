<h1 align="center">Glitch Code</h1>

<p align="center"><strong>Glitch Code: Terminal-Native AI Coding Assistant</strong></p>

<p align="center">
  <a href="https://github.com/glassesglitchstudio-lab/Gltich_code">GitHub</a>
</p>

---

Glitch Code is a terminal-native AI coding assistant. It can read and write code, run commands, manage Git, and use a persistent memory system to keep a deep understanding of your project across sessions while continuously improving itself.

Glitch Code supports connecting to any mainstream LLM provider API, including GlassesCat models via Ollama.

> Based on [MiMoCode](https://github.com/XiaomiMiMo/MiMo-Code) by Xiaomi MiMo Team.

---

## Quick Start

### Option 1: Install via npm (Recommended)

```bash
npm install -g glitchcode-cli
glitch
```

### Option 2: Install from GitHub Releases

Download the binary for your platform from [Releases](https://github.com/glassesglitchstudio-lab/Gltich_code/releases):

| Platform | Download |
|----------|----------|
| Linux x64 (glibc) | `linux-x64.tar.gz` |
| Linux x64 (musl/Alpine) | `linux-x64-musl.tar.gz` |
| Linux ARM64 | `linux-arm64.tar.gz` |
| macOS Intel | `darwin-x64.tar.gz` |
| macOS Apple Silicon | `darwin-arm64.tar.gz` |
| Windows x64 | `win32-x64.zip` |
| Windows ARM64 | `win32-arm64.zip` |

```bash
# Linux/macOS example
tar -xzf linux-x64.tar.gz
chmod +x bin/glitch
./bin/glitch

# Windows example
# Extract the .zip, then run bin\glitch.exe
```

The first launch guides you through configuration automatically. Supported options:
- **MiMo Auto** — anonymous channel, zero configuration
- **Xiaomi MiMo Platform** — OAuth login
- **Import from Claude Code** — migrate existing authentication in one step
- **Custom Provider** — add any OpenAI-compatible API in the TUI
- **GlassesCat via Ollama** — local models

<details>
<summary><strong>WSL: clipboard issues</strong></summary>

If you encounter garbled text when copying on WSL, install `xsel`:
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

### Dream & Distill

- **`/dream`** — scans recent session traces, extracts persistent knowledge into project memory, and removes outdated entries
- **`/distill`** — discovers repeated manual workflows in recent work and packages high-confidence candidates into reusable skills, subagents, or commands

---

## Configuration

Glitch Code is configured via `.mimocode/mimocode.json` in the project directory (or `~/.config/mimocode/mimocode.json` globally). Key options include:

- Provider and model selection
- Agent permissions and custom agents
- Checkpoint and memory behavior
- MCP server connections
- Keybindings and theme

Max Mode (parallel best-of-N reasoning with judge selection) can be enabled via `experimental.maxMode` in the config.

---

## CI/CD Pipeline

This project uses **GitHub Actions** for automated build and publish.

### How it works

1. **Tag push** — When you push a `v*` tag (e.g. `git tag v0.2.9 && git push origin v0.2.9`), the publish workflow triggers
2. **Parallel build** — 12 platform binaries are built simultaneously using matrix strategy:
   - Linux: x64, arm64, x64-baseline, x64-musl, arm64-musl, x64-musl-baseline
   - macOS: x64, arm64, x64-baseline
   - Windows: x64, arm64, x64-baseline
3. **npm publish** — The main `glitchcode-cli` package is published to npmjs.com
4. **GitHub Release** — Binary archives (`.tar.gz` for Linux/macOS, `.zip` for Windows) are attached to the GitHub Release

### Release a new version

```bash
# 1. Bump version in packages/opencode/package.json
# 2. Commit and push
git add . && git commit -m "V0.3.0: new version" && git push origin main

# 3. Create and push tag
git tag v0.3.0
git push origin v0.3.0
```

GitHub Actions will automatically build, publish to npm, and create a GitHub Release.

### Required secrets

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npmjs.com authentication token |

`GITHUB_TOKEN` is provided automatically by GitHub Actions.

### Workflow files

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/publish.yml` | `v*` tag push | Build + npm publish + GitHub Release |
| `.github/workflows/lint.yml` | push to main/dev, PRs | Run oxlint |
| `.github/workflows/test.yml` | push to main/dev, PRs | Run tests via Turborepo |
| `.github/workflows/typecheck.yml` | push to main/dev, PRs | Run TypeScript type checking |

---

## License

Source code is licensed under the [MIT License](https://github.com/glassesglitchstudio-lab/Gltich_code/blob/main/LICENSE).

Based on [MiMoCode](https://github.com/XiaomiMiMo/MiMo-Code) by Xiaomi MiMo Team.
