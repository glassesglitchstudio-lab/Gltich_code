import { Config } from "effect"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

function number(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const GLITCHCODE_EXPERIMENTAL = truthy("GLITCHCODE_EXPERIMENTAL")

// Defaults to false. When enabled, glitchcode runs in pure-glitch mode:
//   — does NOT inherit Claude Code's settings (CLAUDE.md, ~/.claude/skills, etc.)
//   — does NOT pick up provider API keys from environment variables
//   — falls back to the glitch-auto model as the default
// Set GLITCHCODE_MIMO_ONLY=true to disable .claude inheritance and env-based
// provider auto-detection.
const GLITCHCODE_MIMO_ONLY = truthy("GLITCHCODE_MIMO_ONLY")
const GLITCHCODE_DISABLE_CLAUDE_CODE_ENV = truthy("GLITCHCODE_DISABLE_CLAUDE_CODE")
const GLITCHCODE_DISABLE_CLAUDE_CODE = GLITCHCODE_MIMO_ONLY || GLITCHCODE_DISABLE_CLAUDE_CODE_ENV

const GLITCHCODE_DISABLE_EXTERNAL_SKILLS = truthy("GLITCHCODE_DISABLE_EXTERNAL_SKILLS")
const GLITCHCODE_DISABLE_CLAUDE_CODE_SKILLS =
  GLITCHCODE_DISABLE_EXTERNAL_SKILLS || GLITCHCODE_DISABLE_CLAUDE_CODE || truthy("GLITCHCODE_DISABLE_CLAUDE_CODE_SKILLS")
const copy = process.env["GLITCHCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  GLITCHCODE_AUTO_SHARE: truthy("GLITCHCODE_AUTO_SHARE"),
  GLITCHCODE_AUTO_HEAP_SNAPSHOT: truthy("GLITCHCODE_AUTO_HEAP_SNAPSHOT"),
  GLITCHCODE_GIT_BASH_PATH: process.env["GLITCHCODE_GIT_BASH_PATH"],
  GLITCHCODE_CONFIG: process.env["GLITCHCODE_CONFIG"],
  GLITCHCODE_CONFIG_CONTENT: process.env["GLITCHCODE_CONFIG_CONTENT"],

  GLITCHCODE_DISABLE_AUTOUPDATE: truthy("GLITCHCODE_DISABLE_AUTOUPDATE"),

  // Defaults to false (rotation enabled). When enabled, the active log file is
  // never archived to <name>.log.<stamp> on hitting MAX_FILE_SIZE — it grows in
  // place. Useful when an external tool tails/manages the single log file.
  GLITCHCODE_DISABLE_LOG_ROTATION: truthy("GLITCHCODE_DISABLE_LOG_ROTATION"),

  // Defaults to true (analytics enabled). Set GLITCHCODE_ENABLE_ANALYSIS=false
  // to opt out of POSTing model_call/tool_call/agent_request metrics.
  GLITCHCODE_ENABLE_ANALYSIS: !falsy("GLITCHCODE_ENABLE_ANALYSIS"),
  GLITCHCODE_ALWAYS_NOTIFY_UPDATE: truthy("GLITCHCODE_ALWAYS_NOTIFY_UPDATE"),
  GLITCHCODE_DISABLE_PRUNE: truthy("GLITCHCODE_DISABLE_PRUNE"),
  GLITCHCODE_DISABLE_TERMINAL_TITLE: truthy("GLITCHCODE_DISABLE_TERMINAL_TITLE"),
  GLITCHCODE_SHOW_TTFD: truthy("GLITCHCODE_SHOW_TTFD"),
  GLITCHCODE_PERMISSION: process.env["GLITCHCODE_PERMISSION"],
  GLITCHCODE_DISABLE_DEFAULT_PLUGINS: truthy("GLITCHCODE_DISABLE_DEFAULT_PLUGINS"),
  GLITCHCODE_DISABLE_LSP_DOWNLOAD: truthy("GLITCHCODE_DISABLE_LSP_DOWNLOAD"),
  GLITCHCODE_ENABLE_EXPERIMENTAL_MODELS: truthy("GLITCHCODE_ENABLE_EXPERIMENTAL_MODELS"),
  GLITCHCODE_DISABLE_AUTOCOMPACT: truthy("GLITCHCODE_DISABLE_AUTOCOMPACT"),
  GLITCHCODE_DISABLE_MODELS_FETCH: truthy("GLITCHCODE_DISABLE_MODELS_FETCH"),
  GLITCHCODE_DISABLE_MOUSE: truthy("GLITCHCODE_DISABLE_MOUSE"),
  GLITCHCODE_OUTPUT_LENGTH_CONTINUATION_LIMIT: number("GLITCHCODE_OUTPUT_LENGTH_CONTINUATION_LIMIT") ?? 3,
  GLITCHCODE_INVALID_OUTPUT_CONTINUATION_LIMIT: number("GLITCHCODE_INVALID_OUTPUT_CONTINUATION_LIMIT") ?? 2,

  // Caps applied to image attachments before a prompt is sent. Both default to
  // undefined (no limit). GLITCHCODE_MAX_PROMPT_IMAGES bounds how many images may
  // be sent per request (oldest excess images are dropped); GLITCHCODE_MAX_PROMPT_IMAGE_SIZE
  // bounds the decoded byte size of a single image. Values must be positive integers.
  GLITCHCODE_MAX_PROMPT_IMAGES: number("GLITCHCODE_MAX_PROMPT_IMAGES"),
  GLITCHCODE_MAX_PROMPT_IMAGE_SIZE: number("GLITCHCODE_MAX_PROMPT_IMAGE_SIZE"),
  GLITCHCODE_MIMO_ONLY,
  GLITCHCODE_DISABLE_PROVIDER_ENV: GLITCHCODE_MIMO_ONLY || truthy("GLITCHCODE_DISABLE_PROVIDER_ENV"),
  GLITCHCODE_DISABLE_CLAUDE_CODE,
  get GLITCHCODE_DISABLE_CLAUDE_CODE_MCP() {
    // MCP compatibility stays on in glitch-only mode so users can reuse Claude Code
    // MCP servers without inheriting prompts, skills, or provider env keys.
    return GLITCHCODE_DISABLE_CLAUDE_CODE_ENV || truthy("GLITCHCODE_DISABLE_CLAUDE_CODE_MCP")
  },
  GLITCHCODE_DISABLE_CLAUDE_CODE_PROMPT: GLITCHCODE_DISABLE_CLAUDE_CODE || truthy("GLITCHCODE_DISABLE_CLAUDE_CODE_PROMPT"),
  // Defaults to false (enabled): markdown commands under ~/.claude/commands and
  // {project}/.claude/commands load as slash commands. Independent of the
  // glitch-only master switch. Set GLITCHCODE_DISABLE_CLAUDE_CODE_COMMANDS=true to disable.
  GLITCHCODE_DISABLE_CLAUDE_CODE_COMMANDS: truthy("GLITCHCODE_DISABLE_CLAUDE_CODE_COMMANDS"),
  GLITCHCODE_DISABLE_CLAUDE_CODE_SKILLS,
  GLITCHCODE_DISABLE_EXTERNAL_SKILLS,
  GLITCHCODE_DISABLE_CODEX_SKILLS: GLITCHCODE_DISABLE_EXTERNAL_SKILLS || truthy("GLITCHCODE_DISABLE_CODEX_SKILLS"),
  GLITCHCODE_DISABLE_OPENCODE_SKILLS: GLITCHCODE_DISABLE_EXTERNAL_SKILLS || truthy("GLITCHCODE_DISABLE_OPENCODE_SKILLS"),
  GLITCHCODE_FAKE_VCS: process.env["GLITCHCODE_FAKE_VCS"],

  // When enabled, skips all git subprocess calls during project discovery
  // (which git, rev-parse --git-common-dir, rev-parse --show-toplevel) and
  // branch detection. The project is treated as a non-git directory rooted at
  // the working directory. Use to avoid touching git in restricted/sandboxed
  // environments or where git startup probing is undesirable.
  GLITCHCODE_DISABLE_GIT: truthy("GLITCHCODE_DISABLE_GIT"),
  GLITCHCODE_SERVER_PASSWORD: process.env["GLITCHCODE_SERVER_PASSWORD"],
  GLITCHCODE_SERVER_USERNAME: process.env["GLITCHCODE_SERVER_USERNAME"],
  GLITCHCODE_ENABLE_QUESTION_TOOL: truthy("GLITCHCODE_ENABLE_QUESTION_TOOL"),

  // Experimental
  GLITCHCODE_EXPERIMENTAL,
  GLITCHCODE_EXPERIMENTAL_FILEWATCHER: Config.boolean("GLITCHCODE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  GLITCHCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("GLITCHCODE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  GLITCHCODE_EXPERIMENTAL_ICON_DISCOVERY: GLITCHCODE_EXPERIMENTAL || truthy("GLITCHCODE_EXPERIMENTAL_ICON_DISCOVERY"),
  GLITCHCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("GLITCHCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  GLITCHCODE_ENABLE_EXA: truthy("GLITCHCODE_ENABLE_EXA") || GLITCHCODE_EXPERIMENTAL || truthy("GLITCHCODE_EXPERIMENTAL_EXA"),
  GLITCHCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS: number("GLITCHCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  GLITCHCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: number("GLITCHCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  GLITCHCODE_EXPERIMENTAL_OXFMT: GLITCHCODE_EXPERIMENTAL || truthy("GLITCHCODE_EXPERIMENTAL_OXFMT"),
  GLITCHCODE_EXPERIMENTAL_LSP_TY: truthy("GLITCHCODE_EXPERIMENTAL_LSP_TY"),
  GLITCHCODE_EXPERIMENTAL_LSP_TOOL: GLITCHCODE_EXPERIMENTAL || truthy("GLITCHCODE_EXPERIMENTAL_LSP_TOOL"),
  // Defaults to true: dynamic workflow + built-in deep-research are on by default.
  // Set GLITCHCODE_EXPERIMENTAL_WORKFLOW_TOOL=false to opt out. The env-var name is
  // kept for backwards compat (long-running experiments still pass it as `1`).
  GLITCHCODE_EXPERIMENTAL_WORKFLOW_TOOL: !falsy("GLITCHCODE_EXPERIMENTAL_WORKFLOW_TOOL"),
  GLITCHCODE_EXPERIMENTAL_MARKDOWN: !falsy("GLITCHCODE_EXPERIMENTAL_MARKDOWN"),
  GLITCHCODE_MODELS_URL: process.env["GLITCHCODE_MODELS_URL"],
  GLITCHCODE_MODELS_PATH: process.env["GLITCHCODE_MODELS_PATH"],
  GLITCHCODE_DISABLE_EMBEDDED_WEB_UI: truthy("GLITCHCODE_DISABLE_EMBEDDED_WEB_UI"),
  GLITCHCODE_DB: process.env["GLITCHCODE_DB"],

  // Defaults to true — all channels share a single glitchcode.db. The per-channel
  // DB isolation (glitchcode-{channel}.db) is unnecessary for glitchcode since we
  // don't ship multiple release channels yet. Use GLITCHCODE_HOME to isolate dev
  // environments instead. Set GLITCHCODE_DISABLE_CHANNEL_DB=false to restore
  // per-channel isolation.
  GLITCHCODE_DISABLE_CHANNEL_DB: !falsy("GLITCHCODE_DISABLE_CHANNEL_DB"),
  GLITCHCODE_SKIP_MIGRATIONS: truthy("GLITCHCODE_SKIP_MIGRATIONS"),
  GLITCHCODE_STRICT_CONFIG_DEPS: truthy("GLITCHCODE_STRICT_CONFIG_DEPS"),

  GLITCHCODE_WORKSPACE_ID: process.env["GLITCHCODE_WORKSPACE_ID"],
  GLITCHCODE_EXPERIMENTAL_HTTPAPI: truthy("GLITCHCODE_EXPERIMENTAL_HTTPAPI"),
  GLITCHCODE_EXPERIMENTAL_WORKSPACES: GLITCHCODE_EXPERIMENTAL || truthy("GLITCHCODE_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get GLITCHCODE_DISABLE_COMPOSE_SKILLS() {
    return truthy("GLITCHCODE_DISABLE_COMPOSE_SKILLS")
  },
  get GLITCHCODE_DISABLE_PROJECT_CONFIG() {
    return truthy("GLITCHCODE_DISABLE_PROJECT_CONFIG")
  },
  get GLITCHCODE_TUI_CONFIG() {
    return process.env["GLITCHCODE_TUI_CONFIG"]
  },
  get GLITCHCODE_CONFIG_DIR() {
    return process.env["GLITCHCODE_CONFIG_DIR"]
  },
  get GLITCHCODE_HOME() {
    return process.env["GLITCHCODE_HOME"]
  },
  get GLITCHCODE_PURE() {
    return truthy("GLITCHCODE_PURE")
  },
  get GLITCHCODE_PLUGIN_META_FILE() {
    return process.env["GLITCHCODE_PLUGIN_META_FILE"]
  },
  get GLITCHCODE_CLIENT() {
    return process.env["GLITCHCODE_CLIENT"] ?? "cli"
  },
}
