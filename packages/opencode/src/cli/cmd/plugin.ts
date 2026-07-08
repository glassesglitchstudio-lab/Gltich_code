import type { Argv } from "yargs"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import path from "path"
import fs from "fs"

interface Plugin {
  name: string
  description: string
  version: string
  author: string
  tags?: string[]
  mcpServer?: {
    command: string
    args?: string[]
    env?: Record<string, string>
  }
  enabled: boolean
}

interface RegistryPlugin {
  name: string
  description: string
  version: string
  author: string
  tags?: string[]
  mcpServer?: {
    command: string
    args?: string[]
    env?: Record<string, string>
  }
}

interface Registry {
  version: number
  plugins: RegistryPlugin[]
}

const PLUGINS_DIR = ".glitchcode/plugins"
const CONFIG_FILE = ".glitchcode/plugins.json"
const REGISTRY_FILE = path.join(__dirname, "plugin-registry.json")

function loadRegistry(): RegistryPlugin[] {
  try {
    const content = fs.readFileSync(REGISTRY_FILE, "utf-8")
    const registry: Registry = JSON.parse(content)
    return registry.plugins
  } catch {
    return []
  }
}

export const PluginMarketCommand = cmd({
  command: "plugins",
  describe: "Plugin marketi - MCP server ekleme",
  builder: (yargs: Argv) => {
    return yargs
      .command(PluginListCommand)
      .command(PluginSearchCommand)
      .command(PluginAddCommand)
      .command(PluginRemoveCommand)
      .command(PluginEnableCommand)
      .command(PluginDisableCommand)
      .demandCommand()
  },
  handler: async () => {},
})

export const PluginListCommand = cmd({
  command: "list",
  describe: "Mevcut pluginleri listele",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    const installed = loadInstalledPlugins()

    console.log("\n📦 Mevcut Pluginler\n")

    if (installed.length === 0) {
      console.log("  Henuz plugin yok. 'glitch plugins add' ile ekle.\n")
      return
    }

    for (const plugin of installed) {
      const status = plugin.enabled ? "✅" : "❌"
      console.log(`  ${status} ${plugin.name} v${plugin.version}`)
      console.log(`     ${plugin.description}\n`)
    }
  },
})

export const PluginSearchCommand = cmd({
  command: "search <query>",
  describe: "Registry'de plugin ara",
  builder: (yargs: Argv) => {
    return yargs.positional("query", {
      describe: "Arama sorgusu (ad, aciklama veya tag)",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    const registry = loadRegistry()
    const query = args.query.toLowerCase()

    const results = registry.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(query)
      const descMatch = p.description.toLowerCase().includes(query)
      const tagMatch = p.tags?.some((t) => t.toLowerCase().includes(query))
      return nameMatch || descMatch || tagMatch
    })

    if (results.length === 0) {
      console.log(`\n🔍 "${args.query}" icin sonuc bulunamadi.\n`)
      console.log("Mevcut pluginler:")
      for (const p of registry) {
        console.log(`  - ${p.name}: ${p.description}`)
      }
      return
    }

    console.log(`\n🔍 "${args.query}" icin ${results.length} sonuc:\n`)
    for (const plugin of results) {
      const tags = plugin.tags?.length ? ` [${plugin.tags.join(", ")}]` : ""
      console.log(`  ${plugin.name} v${plugin.version}${tags}`)
      console.log(`    ${plugin.description}`)
      console.log(`    Yazar: ${plugin.author}\n`)
    }
  },
})

export const PluginAddCommand = cmd({
  command: "add <name>",
  describe: "Yeni plugin ekle",
  builder: (yargs: Argv) => {
    return yargs.positional("name", {
      describe: "Plugin adi",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    const registry = loadRegistry()
    const plugin = registry.find((p) => p.name === args.name)

    if (!plugin) {
      UI.error(`Plugin bulunamadi: ${args.name}`)
      UI.println("\nMevcut pluginler:")
      for (const p of registry) {
        UI.println(`  - ${p.name}: ${p.description}`)
      }
      process.exit(1)
    }

    const installed = loadInstalledPlugins()
    if (installed.find((p) => p.name === args.name)) {
      UI.error(`Plugin zaten yuklu: ${args.name}`)
      process.exit(1)
    }

    installed.push({ ...plugin, enabled: true })
    saveInstalledPlugins(installed)

    UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Plugin eklendi: ${plugin.name}` + UI.Style.TEXT_NORMAL)
    UI.println(`  ${plugin.description}`)
    UI.println("\nYeniden baslatmak icin 'glitch' komutunu calistir.")
  },
})

export const PluginRemoveCommand = cmd({
  command: "remove <name>",
  describe: "Plugin kaldir",
  builder: (yargs: Argv) => {
    return yargs.positional("name", {
      describe: "Plugin adi",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    const installed = loadInstalledPlugins()
    const index = installed.findIndex((p) => p.name === args.name)

    if (index === -1) {
      UI.error(`Plugin bulunamadi: ${args.name}`)
      process.exit(1)
    }

    installed.splice(index, 1)
    saveInstalledPlugins(installed)

    UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Plugin kaldirildi: ${args.name}` + UI.Style.TEXT_NORMAL)
  },
})

export const PluginEnableCommand = cmd({
  command: "enable <name>",
  describe: "Plugin aktifles",
  builder: (yargs: Argv) => {
    return yargs.positional("name", {
      describe: "Plugin adi",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    const installed = loadInstalledPlugins()
    const plugin = installed.find((p) => p.name === args.name)

    if (!plugin) {
      UI.error(`Plugin bulunamadi: ${args.name}`)
      process.exit(1)
    }

    plugin.enabled = true
    saveInstalledPlugins(installed)

    UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Plugin aktif edildi: ${args.name}` + UI.Style.TEXT_NORMAL)
  },
})

export const PluginDisableCommand = cmd({
  command: "disable <name>",
  describe: "Plugin deaktif et",
  builder: (yargs: Argv) => {
    return yargs.positional("name", {
      describe: "Plugin adi",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    const installed = loadInstalledPlugins()
    const plugin = installed.find((p) => p.name === args.name)

    if (!plugin) {
      UI.error(`Plugin bulunamadi: ${args.name}`)
      process.exit(1)
    }

    plugin.enabled = false
    saveInstalledPlugins(installed)

    UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Plugin deaktif edildi: ${args.name}` + UI.Style.TEXT_NORMAL)
  },
})

function loadInstalledPlugins(): Plugin[] {
  const configPath = path.join(process.cwd(), CONFIG_FILE)
  if (!fs.existsSync(configPath)) return []
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"))
  } catch {
    return []
  }
}

function saveInstalledPlugins(plugins: Plugin[]) {
  const configDir = path.join(process.cwd(), path.dirname(CONFIG_FILE))
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
  fs.writeFileSync(path.join(process.cwd(), CONFIG_FILE), JSON.stringify(plugins, null, 2))
}
