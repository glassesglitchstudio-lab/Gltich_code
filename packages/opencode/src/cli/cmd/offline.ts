import type { Argv } from "yargs"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { execSync } from "child_process"
import path from "path"
import fs from "fs"

interface OfflineConfig {
  provider: "ollama" | "lmstudio" | "local"
  model: string
  endpoint: string
  apiKey?: string
}

const CONFIG_FILE = ".glitchcode/offline.json"

export const OfflineCommand = cmd({
  command: "offline",
  describe: "Offline/calismali model destegi (Ollama, LMStudio)",
  builder: (yargs: Argv) => {
    return yargs
      .command(OfflineSetupCommand)
      .command(OfflineStatusCommand)
      .command(OfflineModelsCommand)
      .command(OfflineTestCommand)
      .demandCommand()
  },
  handler: async () => {},
})

export const OfflineSetupCommand = cmd({
  command: "setup",
  describe: "Offline model kurulumu",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    prompts.intro("🔌 Offline Model Kurulumu")

    const provider = await prompts.select({
      message: "Hangi offline modeli kullanacaksin?",
      options: [
        { value: "ollama", label: "Ollama", hint: "Yerel, ucretsiz, genis model destegi" },
        { value: "lmstudio", label: "LM Studio", hint: "GUI tabanli, kolay kurulum" },
        { value: "local", label: "Local API", hint: "Kendi sunucun (OpenAI uyumlu)" },
      ],
    })
    if (prompts.isCancel(provider)) throw new UI.CancelledError()

    let endpoint = ""
    let defaultModel = ""

    switch (provider) {
      case "ollama":
        endpoint = "http://localhost:11434"
        defaultModel = "llama3.1"
        const ollamaRunning = await checkOllama()
        if (!ollamaRunning) {
          prompts.log.warn("Ollama calismiyor gibi gorunuyor.")
          prompts.log.info("Kurulum: https://ollama.com")
          prompts.log.info("Sonra: ollama pull llama3.1")
        }
        break
      case "lmstudio":
        endpoint = "http://localhost:1234"
        defaultModel = "local-model"
        prompts.log.info("LM Studio'yu ac ve bir model yukle.")
        prompts.log.info("API sunucusunu baslat (Settings > Server).")
        break
      case "local":
        const customEndpoint = await prompts.text({
          message: "API endpoint:",
          placeholder: "http://localhost:8080/v1",
        })
        if (prompts.isCancel(customEndpoint)) throw new UI.CancelledError()
        endpoint = customEndpoint
        defaultModel = "default"
        break
    }

    const model = await prompts.text({
      message: "Model adi:",
      initialValue: defaultModel,
    })
    if (prompts.isCancel(model)) throw new UI.CancelledError()

    const config: OfflineConfig = {
      provider: provider as OfflineConfig["provider"],
      model,
      endpoint,
    }

    const configDir = path.join(process.cwd(), ".glitchcode")
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    fs.writeFileSync(path.join(configDir, "offline.json"), JSON.stringify(config, null, 2))

    prompts.log.success("Offline model yapilandirildi!")
    prompts.log.info(`Provider: ${provider}`)
    prompts.log.info(`Model: ${model}`)
    prompts.log.info(`Endpoint: ${endpoint}`)

    prompts.outro(`
Kullanmak icin:
  glitch run "Merhaba" --offline

Veya .glitchcode/config.json'a ekle:
{
  "provider": "${provider}",
  "model": "${model}",
  "endpoint": "${endpoint}"
}`)
  },
})

export const OfflineStatusCommand = cmd({
  command: "status",
  describe: "Offline model durumunu kontrol et",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    const config = loadOfflineConfig()

    console.log("\n🔌 OFFLINE MODEL DURUMU\n")

    if (!config) {
      console.log("  ⚠️  Offline model yapilandirmamis")
      console.log("  Kurulum icin: glitch offline setup")
      return
    }

    console.log(`  Provider: ${config.provider}`)
    console.log(`  Model: ${config.model}`)
    console.log(`  Endpoint: ${config.endpoint}`)

    const isRunning = await checkEndpoint(config.endpoint)

    if (isRunning) {
      console.log("\n  ✅ Model sunucusu calisiyor")
    } else {
      console.log("\n  ❌ Model sunucusu calismiyor")
      console.log("  Sunucuyu baslatin ve tekrar deneyin.")
    }
  },
})

export const OfflineModelsCommand = cmd({
  command: "models",
  describe: "Mevcut offline modelleri listele",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    const config = loadOfflineConfig()

    if (!config) {
      UI.error("Offline model yapilandirmamis. 'glitch offline setup' ile basla.")
      process.exit(1)
    }

    console.log("\n📦 MEVCUT MODELLER\n")

    if (config.provider === "ollama") {
      try {
        const stdout = execSync("ollama list", { encoding: "utf-8" })
        console.log(stdout)
      } catch {
        console.log("  Ollama calismiyor veya yuklu degil.")
        console.log("  Kurulum: https://ollama.com")
      }
    } else if (config.provider === "lmstudio") {
      console.log("  LM Studio'da model listesini kontrol et.")
      console.log("  Models sekmesinden model indirebilirsin.")
    } else {
      console.log(`  Endpoint: ${config.endpoint}`)
      console.log("  Model listesi icin API sunucusuna baglanin.")
    }
  },
})

export const OfflineTestCommand = cmd({
  command: "test",
  describe: "Offline model baglantisini test et",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    const config = loadOfflineConfig()

    if (!config) {
      UI.error("Offline model yapilandirmamis. 'glitch offline setup' ile basla.")
      process.exit(1)
    }

    const s = prompts.spinner()
    s.start("Test mesaji gonderiliyor...")

    try {
      const isRunning = await checkEndpoint(config.endpoint)
      if (!isRunning) {
        s.stop("Model sunucusu calismiyor!")
        process.exit(1)
      }

      s.stop("Model sunucusu calisiyor!")
      prompts.log.success(`Baglanti basarili: ${config.endpoint}`)
      prompts.log.info(`Model: ${config.model}`)
    } catch (error) {
      s.stop("Test basarisiz!")
      UI.error(`Hata: ${error}`)
    }
  },
})

async function checkOllama(): Promise<boolean> {
  try {
    execSync("ollama --version", { encoding: "utf-8" })
    return true
  } catch {
    return false
  }
}

async function checkEndpoint(endpoint: string): Promise<boolean> {
  try {
    const stdout = execSync(`curl -s -o /dev/null -w "%{http_code}" ${endpoint}`, {
      encoding: "utf-8",
      timeout: 5000,
    })
    return stdout.trim() === "200"
  } catch {
    return false
  }
}

function loadOfflineConfig(): OfflineConfig | null {
  try {
    const configPath = path.join(process.cwd(), CONFIG_FILE)
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"))
    }
  } catch {}
  return null
}
