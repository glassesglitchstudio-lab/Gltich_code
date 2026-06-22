import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { EOL } from "os"
import path from "path"
import fs from "fs"
import { Auth } from "../../auth"
import { AppRuntime } from "../../effect/app-runtime"
import { Effect } from "effect"

const GLITCH_DIR = ".glitch"
const CONFIG_FILE = "config.json"
const GITIGNORE_FILE = ".gitignore"

const PROVIDERS = [
  { value: "openai", label: "OpenAI", hint: "gpt-4o, gpt-4o-mini" },
  { value: "anthropic", label: "Anthropic", hint: "claude-sonnet-4, claude-haiku-3.5" },
  { value: "google", label: "Google", hint: "gemini-2.5-pro" },
  { value: "ollama", label: "Ollama (yerel)", hint: "WSL gerekmez, local" },
  { value: "groq", label: "Groq", hint: "hizli, ucretsiz" },
  { value: "openrouter", label: "OpenRouter", hint: "her modele tek API" },
  { value: "deepseek", label: "DeepSeek", hint: "ucuz, guclu" },
  { value: "sonnet", label: "Sonnet", hint: "Anthropic Claude Sonnet" },
] as const

function detectProjectType(root: string): string {
  const files = fs.readdirSync(root)
  if (files.some((f) => f === "package.json")) {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"))
    if (pkg.dependencies?.react || pkg.devDependencies?.react) return "React"
    if (pkg.dependencies?.next) return "Next.js"
    if (pkg.dependencies?.vue) return "Vue"
    return "Node.js"
  }
  if (files.some((f) => f === "pyproject.toml" || f === "requirements.txt")) return "Python"
  if (files.some((f) => f === "Cargo.toml")) return "Rust"
  if (files.some((f) => f === "go.mod")) return "Go"
  return "unknown"
}

function ensureGitignore(root: string) {
  const gitignorePath = path.join(root, GITIGNORE_FILE)
  const entry = ".glitch/"
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8")
    if (!content.includes(entry)) {
      fs.appendFileSync(gitignorePath, EOL + entry + EOL)
      return "added"
    }
    return "exists"
  }
  fs.writeFileSync(gitignorePath, entry + EOL)
  return "created"
}

export const InitCommand = cmd({
  command: "init",
  describe: "Projeyi Glitch Code'a tanit (.glitch/config.json olusturur)",
  builder: (yargs) => yargs,
  handler: async () => {
    prompts.intro("⚡ Glitch Code - Proje Baslangici")

    const root = process.cwd()
    const projectType = detectProjectType(root)

    prompts.log.info(`Proje: ${path.basename(root)} (${projectType})`)

    const provider = await prompts.select({
      message: "Hangi AI saglayicisini kullanmak istiyorsun?",
      options: PROVIDERS.map((p) => ({ value: p.value, label: p.label, hint: p.hint })),
    })
    if (prompts.isCancel(provider)) throw new UI.CancelledError()

    const apiKey = await prompts.password({
      message: "API anahtarin ne? (bos gecersen sonra .env'den okur)",
      placeholder: "sk-...",
      validate: (v) => {
        if (v && v.length < 10) return "Gecersiz API anahtari"
      },
    })
    if (prompts.isCancel(apiKey)) throw new UI.CancelledError()

    const instructions = await prompts.text({
      message: "Proje talimatlarin var mi? (ornek: 'Bu projede React + TypeScript kullan')",
      placeholder: "Bos birakabilirsin",
    })
    if (prompts.isCancel(instructions)) throw new UI.CancelledError()

    const model = await prompts.text({
      message: "Varsayilan model hangisi olsun?",
      initialValue: provider === "openai" ? "gpt-4o" : provider === "anthropic" ? "claude-sonnet-4-20250514" : "",
      placeholder: "Bos birak automatic secilsin",
    })
    if (prompts.isCancel(model)) throw new UI.CancelledError()

    const s = prompts.spinner()
    s.start("Glitch Code baslatiliyor...")

    const glitchDir = path.join(root, GLITCH_DIR)
    fs.mkdirSync(glitchDir, { recursive: true })

    const config = {
      version: "1.0",
      project: path.basename(root),
      type: projectType,
      provider: provider || "auto",
      model: model || "auto",
      instructions: instructions || "",
      created: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(glitchDir, CONFIG_FILE), JSON.stringify(config, null, 2))

    if (apiKey) {
      const put = (key: string, info: Auth.Info) =>
        AppRuntime.runPromise(
          Effect.gen(function* () {
            const auth = yield* Auth.Service
            yield* auth.set(key, info)
          }),
        )
      await put(provider as string, { apiKey: apiKey as string } as Auth.Info)
    }

    const gitignoreStatus = ensureGitignore(root)

    s.stop("Hazir!")

    prompts.log.success(`.glitch/config.json olusturuldu`)
    if (apiKey) prompts.log.success(`API anahtari kaydedildi (${provider})`)
    if (gitignoreStatus === "created") prompts.log.success(`.gitignore olusturuldu`)
    else if (gitignoreStatus === "added") prompts.log.info(`.glitch/ .gitignore'a eklendi`)

    prompts.outro(`
  ┌─────────────────────────────────────┐
  │  Glitch Code hazir!                 │
  │                                     │
  │  Kullanmak icin:                    │
  │    glitch run "bir API yaz"         │
  │                                     │
  │  Config: .glitch/config.json        │
  └─────────────────────────────────────┘`)
  },
})
