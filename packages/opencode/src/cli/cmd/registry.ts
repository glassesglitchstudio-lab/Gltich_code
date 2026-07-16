import { intro, log, outro, spinner, select, confirm } from "@clack/prompts"
import type { Argv } from "yargs"

import {
  searchPlugins,
  getPlugin,
  installFromRegistry,
  publishPlugin,
  formatPlugin,
  getCategoryEmoji,
  type PluginCategory,
  type SearchOptions,
} from "../../plugin/registry"
import { Instance } from "../../project/instance"
import { UI } from "../ui"
import { cmd } from "./cmd"

// ============================================================================
// Search Command
// ============================================================================

export const RegistrySearchCommand = cmd({
  command: "search [query]",
  describe: "Search plugins in the registry",
  builder: (yargs: Argv) => {
    return yargs
      .positional("query", {
        type: "string",
        describe: "Search query",
      })
      .option("category", {
        alias: ["c"],
        type: "string",
        describe: "Filter by category (ai, devtools, ui, auth, database, search, automation, productivity)",
      })
      .option("sort", {
        alias: ["s"],
        type: "string",
        choices: ["downloads", "rating", "name", "updated"],
        default: "downloads",
        describe: "Sort results by",
      })
      .option("limit", {
        alias: ["l"],
        type: "number",
        default: 20,
        describe: "Max results to show",
      })
  },
  handler: async (args) => {
    const query = String(args.query ?? "").trim()
    const category = args.category as PluginCategory | undefined
    const sort = args.sort as SearchOptions["sort"]
    const limit = Number(args.limit) || 20

    UI.empty()
    intro("Search plugins")

    const search = spinner()
    search.start("Searching registry...")

    try {
      const result = await searchPlugins({
        query: query || undefined,
        category,
        sort,
        limit,
      })

      search.stop(`Found ${result.total} plugins`)

      if (result.plugins.length === 0) {
        log.info("No plugins found matching your criteria.")
        return
      }

      // Display results
      console.log("")
      for (const plugin of result.plugins) {
        const emoji = getCategoryEmoji(plugin.category)
        const verified = plugin.verified ? " ✓" : ""
        const featured = plugin.featured ? " ⭐" : ""
        const downloads = plugin.downloads ? ` ↓${plugin.downloads.toLocaleString()}` : ""

        console.log(`  ${emoji} ${plugin.name}${verified}${featured}`)
        console.log(`     ${plugin.description}`)
        console.log(`     v${plugin.version} by ${plugin.author}${downloads}`)
        console.log(`     Tags: ${plugin.tags.join(", ")}`)
        console.log("")
      }

      log.info(`Use "glitch registry install <name>" to install a plugin.`)
    } catch (error) {
      search.stop("Search failed")
      log.error(`Failed to search registry: ${error instanceof Error ? error.message : error}`)
      process.exitCode = 1
    }

    outro("Done")
  },
})

// ============================================================================
// Install Command
// ============================================================================

export const RegistryInstallCommand = cmd({
  command: "install <name>",
  describe: "Install a plugin from the registry",
  builder: (yargs: Argv) => {
    return yargs
      .positional("name", {
        type: "string",
        describe: "Plugin name to install",
      })
      .option("global", {
        alias: ["g"],
        type: "boolean",
        default: false,
        describe: "Install in global config",
      })
      .option("force", {
        alias: ["f"],
        type: "boolean",
        default: false,
        describe: "Force install even if already installed",
      })
  },
  handler: async (args) => {
    const name = String(args.name ?? "").trim()
    if (!name) {
      UI.error("Plugin name is required")
      process.exitCode = 1
      return
    }

    UI.empty()
    intro(`Install plugin: ${name}`)

    // First, fetch plugin info
    const search = spinner()
    search.start("Looking up plugin...")

    let plugin
    try {
      plugin = await getPlugin(name)
    } catch (error) {
      search.stop("Lookup failed")
      log.error(`Failed to fetch plugin info: ${error instanceof Error ? error.message : error}`)
      process.exitCode = 1
      return
    }

    if (!plugin) {
      search.stop("Plugin not found")
      log.error(`Plugin "${name}" not found in registry.`)
      log.info('Use "glitch registry search" to browse available plugins.')
      process.exitCode = 1
      return
    }

    search.stop(`Found: ${plugin.name} v${plugin.version}`)

    // Show plugin details
    console.log("")
    console.log(`  ${plugin.description}`)
    console.log(`  Author: ${plugin.author}`)
    console.log(`  Version: ${plugin.version}`)
    console.log(`  License: ${plugin.license ?? "Unknown"}`)
    console.log(`  Package: ${plugin.npmPackage}`)
    if (plugin.permissions?.length) {
      console.log(`  Permissions: ${plugin.permissions.join(", ")}`)
    }
    console.log("")

    // Confirm installation
    const shouldInstall = await confirm({
      message: "Install this plugin?",
      initialValue: true,
    })

    if (!shouldInstall) {
      log.info("Installation cancelled.")
      return
    }

    // Install
    const install = spinner()
    install.start("Installing plugin...")

    try {
      const result = await installFromRegistry(name, {
        global: Boolean(args.global),
        force: Boolean(args.force),
      })

      if (result.success) {
        install.stop("Plugin installed successfully")
        log.success(`Plugin "${name}" has been installed.`)
        log.info("Restart Glitch Code to activate the plugin.")
      } else {
        install.stop("Installation failed")
        log.error(result.error ?? "Unknown error")
        process.exitCode = 1
      }
    } catch (error) {
      install.stop("Installation failed")
      log.error(`Installation failed: ${error instanceof Error ? error.message : error}`)
      process.exitCode = 1
    }

    outro("Done")
  },
})

// ============================================================================
// Info Command
// ============================================================================

export const RegistryInfoCommand = cmd({
  command: "info <name>",
  describe: "Show detailed info about a plugin",
  builder: (yargs: Argv) => {
    return yargs.positional("name", {
      type: "string",
      describe: "Plugin name",
    })
  },
  handler: async (args) => {
    const name = String(args.name ?? "").trim()
    if (!name) {
      UI.error("Plugin name is required")
      process.exitCode = 1
      return
    }

    UI.empty()
    intro(`Plugin info: ${name}`)

    const search = spinner()
    search.start("Fetching plugin info...")

    let plugin
    try {
      plugin = await getPlugin(name)
    } catch (error) {
      search.stop("Failed to fetch")
      log.error(`Failed to fetch plugin info: ${error instanceof Error ? error.message : error}`)
      process.exitCode = 1
      return
    }

    if (!plugin) {
      search.stop("Plugin not found")
      log.error(`Plugin "${name}" not found in registry.`)
      process.exitCode = 1
      return
    }

    search.stop("Found")

    // Display detailed info
    console.log("")
    console.log(`  Name:        ${plugin.name}`)
    console.log(`  Description: ${plugin.description}`)
    console.log(`  Version:     ${plugin.version}`)
    console.log(`  Author:      ${plugin.author}`)
    console.log(`  License:     ${plugin.license ?? "Unknown"}`)
    console.log(`  Category:    ${getCategoryEmoji(plugin.category)} ${plugin.category}`)
    console.log(`  Package:     ${plugin.npmPackage}`)
    console.log(`  Tags:        ${plugin.tags.join(", ")}`)
    if (plugin.downloads) console.log(`  Downloads:   ${plugin.downloads.toLocaleString()}`)
    if (plugin.rating) console.log(`  Rating:      ${"★".repeat(Math.round(plugin.rating))}${"☆".repeat(5 - Math.round(plugin.rating))} ${plugin.rating}`)
    if (plugin.homepage) console.log(`  Homepage:    ${plugin.homepage}`)
    if (plugin.repository) console.log(`  Repository:  ${plugin.repository}`)
    if (plugin.permissions?.length) console.log(`  Permissions: ${plugin.permissions.join(", ")}`)
    if (plugin.minVersion) console.log(`  Min Version: ${plugin.minVersion}`)
    if (plugin.verified) console.log(`  Verified:    ✓ Yes`)
    if (plugin.featured) console.log(`  Featured:    ⭐ Yes`)
    console.log("")

    log.info(`Use "glitch registry install ${name}" to install this plugin.`)

    outro("Done")
  },
})

// ============================================================================
// Publish Command
// ============================================================================

export const RegistryPublishCommand = cmd({
  command: "publish",
  describe: "Generate registry entry for plugin submission",
  builder: (yargs: Argv) => {
    return yargs
      .option("name", {
        type: "string",
        describe: "Plugin name",
      })
      .option("description", {
        type: "string",
        describe: "Plugin description",
      })
      .option("version", {
        type: "string",
        describe: "Plugin version",
      })
      .option("author", {
        type: "string",
        describe: "Author name",
      })
      .option("npm-package", {
        type: "string",
        describe: "npm package name",
      })
      .option("tags", {
        type: "array",
        describe: "Tags",
      })
      .option("category", {
        type: "string",
        choices: ["ai", "devtools", "ui", "auth", "database", "search", "automation", "productivity", "other"],
        describe: "Plugin category",
      })
      .option("license", {
        type: "string",
        describe: "License",
      })
      .option("homepage", {
        type: "string",
        describe: "Homepage URL",
      })
      .option("repository", {
        type: "string",
        describe: "Repository URL",
      })
  },
  handler: async (args) => {
    UI.empty()
    intro("Publish plugin to registry")

    const input = {
      name: String(args.name ?? ""),
      description: String(args.description ?? ""),
      version: String(args.version ?? "1.0.0"),
      author: String(args.author ?? ""),
      npmPackage: String(args["npm-package"] ?? ""),
      tags: (args.tags as string[]) ?? [],
      category: (args.category as PluginCategory) ?? "other",
      license: args.license as string | undefined,
      homepage: args.homepage as string | undefined,
      repository: args.repository as string | undefined,
    }

    // Validate required fields
    const missing = Object.entries(input)
      .filter(([key, value]) => !value && ["name", "description", "author", "npmPackage"].includes(key))
      .map(([key]) => key)

    if (missing.length) {
      log.error(`Missing required fields: ${missing.join(", ")}`)
      log.info("Use --name, --description, --author, --npm-package flags.")
      process.exitCode = 1
      return
    }

    try {
      const result = await publishPlugin(input)
      if (result.success) {
        log.success("Registry entry generated. Submit via PR to the GitHub repository.")
      } else {
        log.error(result.error ?? "Failed to generate entry")
        process.exitCode = 1
      }
    } catch (error) {
      log.error(`Failed: ${error instanceof Error ? error.message : error}`)
      process.exitCode = 1
    }

    outro("Done")
  },
})

// ============================================================================
// Main Registry Command
// ============================================================================

export const RegistryCommand = cmd({
  command: "registry",
  aliases: ["reg"],
  describe: "Plugin registry management",
  builder: (yargs: Argv) => {
    return yargs
      .command(RegistrySearchCommand)
      .command(RegistryInstallCommand)
      .command(RegistryInfoCommand)
      .command(RegistryPublishCommand)
      .demandCommand(1, "Specify a subcommand: search, install, info, publish")
  },
  handler: () => {},
})
