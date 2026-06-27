import type { Argv } from "yargs"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import path from "path"
import fs from "fs"

interface Theme {
  name: string
  description: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
    success: string
    warning: string
    error: string
  }
}

const THEMES: Theme[] = [
  {
    name: "neon-orange",
    description: "Varsayilan neon turuncu tema",
    colors: {
      primary: "#FF6B00",
      secondary: "#FF9500",
      accent: "#FFB800",
      background: "#1a1a2e",
      text: "#ffffff",
      success: "#4CAF50",
      warning: "#FFC107",
      error: "#f44336",
    },
  },
  {
    name: "cyber-blue",
    description: "Siber mavi/neon tema",
    colors: {
      primary: "#00D4FF",
      secondary: "#0099CC",
      accent: "#00FF88",
      background: "#0a0a1a",
      text: "#e0e0e0",
      success: "#00FF88",
      warning: "#FFD700",
      error: "#FF4444",
    },
  },
  {
    name: "matrix-green",
    description: "Matrix yesil terminal teması",
    colors: {
      primary: "#00FF41",
      secondary: "#00CC33",
      accent: "#39FF14",
      background: "#0d0208",
      text: "#00FF41",
      success: "#00FF41",
      warning: "#FFD700",
      error: "#FF0000",
    },
  },
  {
    name: "sunset",
    description: "Gun batimi renkleri",
    colors: {
      primary: "#FF6B6B",
      secondary: "#FFA07A",
      accent: "#FFD93D",
      background: "#1a1a2e",
      text: "#ffffff",
      success: "#6BCB77",
      warning: "#FFD93D",
      error: "#FF6B6B",
    },
  },
  {
    name: "ocean",
    description: "Okyanus mavi-yesil tema",
    colors: {
      primary: "#0077B6",
      secondary: "#00B4D8",
      accent: "#90E0EF",
      background: "#03045e",
      text: "#CAF0F8",
      success: "#48CAE4",
      warning: "#FDC500",
      error: "#E63946",
    },
  },
  {
    name: "dracula",
    description: "Dracula tema",
    colors: {
      primary: "#BD93F9",
      secondary: "#FF79C6",
      accent: "#50FA7B",
      background: "#282A36",
      text: "#F8F8F2",
      success: "#50FA7B",
      warning: "#F1FA8C",
      error: "#FF5555",
    },
  },
  {
    name: "monokai",
    description: "Monokai tema",
    colors: {
      primary: "#A6E22E",
      secondary: "#66D9EF",
      accent: "#FD971F",
      background: "#272822",
      text: "#F8F8F2",
      success: "#A6E22E",
      warning: "#E6DB74",
      error: "#F92672",
    },
  },
]

const CONFIG_FILE = ".glitchcode/theme.json"

export const ThemeCommand = cmd({
  command: "theme",
  describe: "Tema yonetimi",
  builder: (yargs: Argv) => {
    return yargs
      .command(ThemeListCommand)
      .command(ThemeSetCommand)
      .command(ThemePreviewCommand)
      .command(ThemeCreateCommand)
      .demandCommand()
  },
  handler: async () => {},
})

export const ThemeListCommand = cmd({
  command: "list",
  describe: "Mevcut temalari listele",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    const current = loadCurrentTheme()

    console.log("\n🎨 MEVCUT TEMALAR\n")

    for (const theme of THEMES) {
      const isCurrent = current === theme.name
      const marker = isCurrent ? " ✅ (aktif)" : ""
      console.log(`  ${theme.name}${marker}`)
      console.log(`    ${theme.description}`)
      console.log(`    Primary: ${theme.colors.primary} | Secondary: ${theme.colors.secondary}`)
      console.log()
    }
  },
})

export const ThemeSetCommand = cmd({
  command: "set <name>",
  describe: "Tema degistir",
  builder: (yargs: Argv) => {
    return yargs.positional("name", {
      describe: "Tema adi",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    const theme = THEMES.find((t) => t.name === args.name)
    if (!theme) {
      UI.error(`Tema bulunamadi: ${args.name}`)
      UI.println("\nMevcut temalar:")
      for (const t of THEMES) {
        UI.println(`  - ${t.name}: ${t.description}`)
      }
      process.exit(1)
    }

    saveCurrentTheme(args.name)
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Tema degistirildi: ${theme.name}` + UI.Style.TEXT_NORMAL)
    UI.println(`  Primary: ${theme.colors.primary}`)
    UI.println(`  Secondary: ${theme.colors.secondary}`)
  },
})

export const ThemePreviewCommand = cmd({
  command: "preview <name>",
  describe: "Tema onizlemesi goster",
  builder: (yargs: Argv) => {
    return yargs.positional("name", {
      describe: "Tema adi",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    const theme = THEMES.find((t) => t.name === args.name)
    if (!theme) {
      UI.error(`Tema bulunamadi: ${args.name}`)
      process.exit(1)
    }

    console.log(`\n🎨 ${theme.name.toUpperCase()} ONIZLEME\n`)
    console.log("─".repeat(40))
    console.log(`Primary:   ${theme.colors.primary}`)
    console.log(`Secondary: ${theme.colors.secondary}`)
    console.log(`Accent:    ${theme.colors.accent}`)
    console.log(`Background:${theme.colors.background}`)
    console.log(`Text:      ${theme.colors.text}`)
    console.log("─".repeat(40))
    console.log()
    console.log(`  Bu tema "${theme.description}" olarak tanimlanmis.`)
    console.log()
  },
})

export const ThemeCreateCommand = cmd({
  command: "create",
  describe: "Yeni tema olustur",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    prompts.intro("🎨 Yeni Tema Olusturma")

    const name = await prompts.text({
      message: "Tema adi:",
      placeholder: "ornek: my-theme",
    })
    if (prompts.isCancel(name)) throw new UI.CancelledError()

    const description = await prompts.text({
      message: "Tema aciklamasi:",
      placeholder: "Benim ozel temam",
    })
    if (prompts.isCancel(description)) throw new UI.CancelledError()

    const primary = await prompts.text({
      message: "Primary renk (hex):",
      initialValue: "#FF6B00",
    })
    if (prompts.isCancel(primary)) throw new UI.CancelledError()

    const secondary = await prompts.text({
      message: "Secondary renk (hex):",
      initialValue: "#FF9500",
    })
    if (prompts.isCancel(secondary)) throw new UI.CancelledError()

    const customTheme: Theme = {
      name,
      description,
      colors: {
        primary,
        secondary,
        accent: "#FFB800",
        background: "#1a1a2e",
        text: "#ffffff",
        success: "#4CAF50",
        warning: "#FFC107",
        error: "#f44336",
      },
    }

    THEMES.push(customTheme)
    saveCurrentTheme(name)

    prompts.log.success(`Tema olusturuldu: ${name}`)
    prompts.outro(`Tema aktif edildi! Degisiklikleri gormek icin glitch'i yeniden baslat.`)
  },
})

function loadCurrentTheme(): string {
  try {
    const configPath = path.join(process.cwd(), CONFIG_FILE)
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
      return config.name || "neon-orange"
    }
  } catch {}
  return "neon-orange"
}

function saveCurrentTheme(name: string) {
  const configDir = path.join(process.cwd(), ".glitchcode")
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
  fs.writeFileSync(
    path.join(configDir, "theme.json"),
    JSON.stringify({ name, updatedAt: new Date().toISOString() }, null, 2),
  )
}
