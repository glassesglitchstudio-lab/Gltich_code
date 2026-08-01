import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import path from "path"
import fs from "fs"
import { Auth } from "../../auth"
import { AppRuntime } from "../../effect/app-runtime"
import { Effect } from "effect"

const GLITCHCODE_DIR = ".glitchcode"
const CONFIG_FILE = "glitchcode.json"

const PROVIDERS: Array<{ value: string; label: string; hint: string }> = [
  { value: "anthropic", label: "Anthropic", hint: "claude-sonnet-4, claude-haiku" },
  { value: "openai", label: "OpenAI", hint: "gpt-4o, gpt-4o-mini" },
  { value: "google", label: "Google", hint: "gemini-2.5-pro" },
  { value: "ollama", label: "Ollama (yerel)", hint: "hic kurulum gerekmez" },
  { value: "groq", label: "Groq", hint: "hizli, ucretsiz" },
  { value: "openrouter", label: "OpenRouter", hint: "her modele tek API" },
  { value: "deepseek", label: "DeepSeek", hint: "ucuz, guclu" },
  { value: "auto", label: "Otomatik sec", hint: "env veya config'e gore" },
]

const THEMES: Array<{ value: string; label: string; hint: string }> = [
  { value: "glitchcode", label: "Neon Turuncu", hint: "Glitch Code varsayilan" },
  { value: "cyberpunk", label: "Cyberpunk", hint: "mor/cyan neon" },
  { value: "minimal", label: "Minimal", hint: "sade, serif" },
  { value: "auto", label: "Otomatik", hint: "sistem temasina gore" },
]

const MEMORY_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: "enabled", label: "Acik", hint: "otomatik kaydetme" },
  { value: "disabled", label: "Kapali", hint: "hafiza yok" },
  { value: "manual", label: "Manuel", hint: "sadece /save ile" },
]

function ensureDirs(root: string) {
  const glitchcodeDir = path.join(root, GLITCHCODE_DIR)
  if (!fs.existsSync(glitchcodeDir)) {
    fs.mkdirSync(path.join(glitchcodeDir, "command"), { recursive: true })
    fs.mkdirSync(path.join(glitchcodeDir, "skills"), { recursive: true })
    fs.writeFileSync(path.join(glitchcodeDir, "command", "README.md"), "# Glitch Code - Commands\n")
    fs.writeFileSync(path.join(glitchcodeDir, "skills", "README.md"), "# Glitch Code - Skills\n")
  }
}

function loadExistingConfig(root: string): Record<string, unknown> | null {
  const configPath = path.join(root, GLITCHCODE_DIR, CONFIG_FILE)
  if (!fs.existsSync(configPath)) return null
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"))
  } catch {
    return null
  }
}

export async function runSetupWizard(root: string): Promise<boolean> {
  prompts.intro("⚡ Glitch Code - Ilk Kurulum")

  const existing = loadExistingConfig(root)
  if (existing) {
    const overwrite = await prompts.confirm({
      message: "Kurulum zaten yapilmis. Yeniden kurmak istiyorsun?",
      initialValue: false,
    })
    if (prompts.isCancel(overwrite) || !overwrite) {
      prompts.outro("Kurulum iptal edildi.")
      return false
    }
  }

  ensureDirs(root)

  const provider = await prompts.select({
    message: "Hangi AI saglayicisini kullanmak istiyorsun?",
    options: [
      ...PROVIDERS.map((p) => ({ value: p.value, label: p.label, hint: p.hint })),
      { value: "__skip__", label: "Atla / Sonra ayarla", hint: "sadece CLI kullan" },
    ],
  })
  if (prompts.isCancel(provider)) throw new UI.CancelledError()

  const apiKey = await prompts.password({
    message: "API anahtarin ne? (bos gecersen sonra .env'den okur)",
    validate: (v) => {
      if (v && v.length < 10) return "Gecersiz API anahtari"
    },
  })
  if (prompts.isCancel(apiKey)) throw new UI.CancelledError()

  const webSearch = await prompts.select({
    message: "Web aramasi nasil olsun?",
    options: [
      { value: "searxng", label: "SearXNG (kendi instance'in)", hint: "ucretsiz, sinirsiz" },
      { value: "mcp", label: "MCP / Exa", hint: "hazir servis" },
      { value: "none", label: "Yok / Atla", hint: "webfetch ile yetin" },
      { value: "__skip__", label: "Atla", hint: "sonra ayarla" },
    ],
  })
  if (prompts.isCancel(webSearch)) throw new UI.CancelledError()

  let searxngUrl = ""
  if (webSearch === "searxng") {
    const rawUrl = await prompts.text({
      message: "SearXNG instance URL'n ne?",
      initialValue: "http://localhost:8888",
      placeholder: "https://search.example.com",
    })
    if (prompts.isCancel(rawUrl)) throw new UI.CancelledError()
    searxngUrl = rawUrl as string
  }

  const memory = await prompts.select({
    message: "Hafiza (memory) nasil olsun?",
    options: [
      ...MEMORY_OPTIONS.map((m) => ({ value: m.value, label: m.label, hint: m.hint })),
      { value: "__skip__", label: "Atla", hint: "varsayilan: acik" },
    ],
  })
  if (prompts.isCancel(memory)) throw new UI.CancelledError()

  const theme = await prompts.select({
    message: "Tema hangisi olsun?",
    options: [
      ...THEMES.map((t) => ({ value: t.value, label: t.label, hint: t.hint })),
      { value: "__skip__", label: "Atla", hint: "varsayilan: neon turuncu" },
    ],
  })
  if (prompts.isCancel(theme)) throw new UI.CancelledError()

  const s = prompts.spinner()
  s.start("Kaydediliyor...")

  const config: Record<string, unknown> = {
    version: "1.0",
    project: path.basename(root),
    created: new Date().toISOString(),
  }

  if (provider && provider !== "__skip__") {
    config.provider = provider
    config.model = provider === "auto" ? "auto" : "auto"
  }

  if (webSearch && webSearch !== "__skip__") {
    config.websearch = {
      provider: webSearch === "none" ? "none" : webSearch,
      ...(searxngUrl ? { instanceUrl: searxngUrl } : {}),
      timeout: 30,
      maxResults: 10,
    }
  }

  if (memory && memory !== "__skip__") {
    config.memory = { mode: memory }
  }

  if (theme && theme !== "__skip__") {
    config.tui = { theme }
  }

  const configPath = path.join(root, GLITCHCODE_DIR, CONFIG_FILE)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

    if (apiKey && provider && provider !== "__skip__" && provider !== "auto") {
      try {
        const put = (key: string, info: Auth.Info) =>
          AppRuntime.runPromise(
            Effect.gen(function* () {
              const auth = yield* Auth.Service
              yield* auth.set(key, info)
            }),
          )
        await put(provider, { type: "api", key: apiKey as string } as Auth.Info)
      } catch (err) {
        prompts.log.warn("API anahtari kaydedilemedi: " + errorMessage(err))
      }
    }

  s.stop("Hazir!")

  prompts.log.success(`Kurulum tamamlandi: .glitchcode/${CONFIG_FILE}`)
  prompts.outro(`
  ┌─────────────────────────────────────┐
  │  Glitch Code hazir!                 │
  │                                     │
  │  Kullanmak icin:                    │
  │    glitch                           │
  │                                     │
  │  Ayarlar: .glitchcode/${CONFIG_FILE}  │
  └─────────────────────────────────────┘`)

  return true
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
