/**
 * Plugin Registry
 *
 * Remote plugin registry for discovering, searching, and installing plugins.
 * Registry data is stored as a JSON file (can be hosted on GitHub or any HTTP server).
 */
import { Global } from "../global"
import { Filesystem } from "../util"
import { mkdir } from "fs/promises"
import path from "path"

// ============================================================================
// Types
// ============================================================================

export type PluginCategory =
  | "ai"
  | "devtools"
  | "ui"
  | "auth"
  | "database"
  | "search"
  | "automation"
  | "productivity"
  | "other"

export type RegistryPlugin = {
  name: string
  description: string
  version: string
  author: string
  license?: string
  homepage?: string
  repository?: string
  tags: string[]
  category: PluginCategory
  npmPackage: string
  downloads?: number
  rating?: number
  featured?: boolean
  verified?: boolean
  permissions?: string[]
  minVersion?: string
}

export type RegistryManifest = {
  version: number
  plugins: RegistryPlugin[]
  updatedAt: string
}

export type SearchOptions = {
  query?: string
  category?: PluginCategory
  tags?: string[]
  sort?: "downloads" | "rating" | "name" | "updated"
  limit?: number
  offset?: number
}

export type SearchResult = {
  plugins: RegistryPlugin[]
  total: number
  offset: number
  limit: number
}

// ============================================================================
// Config
// ============================================================================

const DEFAULT_REGISTRY_URL = "https://raw.githubusercontent.com/glassesglitchstudio-lab/Gltich_code/main/plugins-registry.json"
const CACHE_DIR = path.join(Global.Path.cache, "plugin-registry")
const CACHE_FILE = path.join(CACHE_DIR, "registry.json")
const CACHE_TTL = 1000 * 60 * 30 // 30 minutes

// ============================================================================
// Cache
// ============================================================================

async function readCache(): Promise<RegistryManifest | null> {
  try {
    const stat = await Filesystem.statAsync(CACHE_FILE)
    if (!stat) return null

    const age = Date.now() - Number(stat.mtimeMs)
    if (age > CACHE_TTL) return null

    return await Filesystem.readJson<RegistryManifest>(CACHE_FILE)
  } catch {
    return null
  }
}

async function writeCache(manifest: RegistryManifest): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true })
    await Filesystem.writeJson(CACHE_FILE, manifest)
  } catch {
    // Ignore cache write errors
  }
}

// ============================================================================
// Registry Client
// ============================================================================

export async function fetchRegistry(url?: string): Promise<RegistryManifest> {
  // Check cache first
  const cached = await readCache()
  if (cached) return cached

  const registryUrl = url || process.env.GLITCHCODE_REGISTRY_URL || DEFAULT_REGISTRY_URL

  try {
    const response = await fetch(registryUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "glitchcode-cli",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`Registry fetch failed: ${response.status} ${response.statusText}`)
    }

    const manifest = (await response.json()) as RegistryManifest

    // Validate structure
    if (!manifest.plugins || !Array.isArray(manifest.plugins)) {
      throw new Error("Invalid registry format: missing plugins array")
    }

    // Cache the result
    await writeCache(manifest)

    return manifest
  } catch (error) {
    // If fetch fails, try to use stale cache
    const stale = await readCache()
    if (stale) return stale

    throw error
  }
}

// ============================================================================
// Search & Filter
// ============================================================================

function matchesSearch(plugin: RegistryPlugin, query: string): boolean {
  const q = query.toLowerCase()
  return (
    plugin.name.toLowerCase().includes(q) ||
    plugin.description.toLowerCase().includes(q) ||
    plugin.tags.some((tag) => tag.toLowerCase().includes(q)) ||
    plugin.author.toLowerCase().includes(q)
  )
}

function matchesFilters(plugin: RegistryPlugin, options: SearchOptions): boolean {
  if (options.category && plugin.category !== options.category) return false
  if (options.tags?.length && !options.tags.some((tag) => plugin.tags.includes(tag))) return false
  return true
}

function sortPlugins(plugins: RegistryPlugin[], sort: SearchOptions["sort"]): RegistryPlugin[] {
  const sorted = [...plugins]
  switch (sort) {
    case "downloads":
      return sorted.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0))
    case "rating":
      return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case "updated":
      // Featured first, then by downloads
      return sorted.sort((a, b) => {
        if (a.featured && !b.featured) return -1
        if (!a.featured && b.featured) return 1
        return (b.downloads ?? 0) - (a.downloads ?? 0)
      })
    default:
      // Default: featured first, then by downloads
      return sorted.sort((a, b) => {
        if (a.featured && !b.featured) return -1
        if (!a.featured && b.featured) return 1
        return (b.downloads ?? 0) - (a.downloads ?? 0)
      })
  }
}

export async function searchPlugins(options: SearchOptions = {}): Promise<SearchResult> {
  const manifest = await fetchRegistry()
  let plugins = manifest.plugins

  // Apply search query
  if (options.query) {
    plugins = plugins.filter((p) => matchesSearch(p, options.query!))
  }

  // Apply filters
  plugins = plugins.filter((p) => matchesFilters(p, options))

  // Sort
  plugins = sortPlugins(plugins, options.sort)

  const total = plugins.length
  const offset = options.offset ?? 0
  const limit = options.limit ?? 20

  // Paginate
  plugins = plugins.slice(offset, offset + limit)

  return {
    plugins,
    total,
    offset,
    limit,
  }
}

export async function getPlugin(name: string): Promise<RegistryPlugin | null> {
  const manifest = await fetchRegistry()
  return manifest.plugins.find((p) => p.name === name) ?? null
}

export async function getFeaturedPlugins(): Promise<RegistryPlugin[]> {
  const manifest = await fetchRegistry()
  return manifest.plugins.filter((p) => p.featured)
}

export async function getPluginsByCategory(category: PluginCategory): Promise<RegistryPlugin[]> {
  const manifest = await fetchRegistry()
  return manifest.plugins.filter((p) => p.category === category)
}

// ============================================================================
// Install from Registry
// ============================================================================

export async function installFromRegistry(
  name: string,
  options: { global?: boolean; force?: boolean } = {},
): Promise<{ success: boolean; error?: string }> {
  const plugin = await getPlugin(name)
  if (!plugin) {
    return { success: false, error: `Plugin "${name}" not found in registry` }
  }

  // Use the existing plugin install mechanism
  const { createPlugTask } = await import("../cli/cmd/plug")
  const { Instance } = await import("../project/instance")

  const run = createPlugTask({
    mod: plugin.npmPackage,
    global: options.global,
    force: options.force,
  })

  let success = false
  await Instance.provide({
    directory: process.cwd(),
    fn: async () => {
      success = await run({
        vcs: Instance.project.vcs,
        worktree: Instance.worktree,
        directory: Instance.directory,
      })
    },
  })

  return { success }
}

// ============================================================================
// Publish to Registry (for plugin authors)
// ============================================================================

export type PublishInput = {
  name: string
  description: string
  version: string
  author: string
  npmPackage: string
  tags: string[]
  category: PluginCategory
  license?: string
  homepage?: string
  repository?: string
  permissions?: string[]
  minVersion?: string
}

export async function publishPlugin(input: PublishInput): Promise<{ success: boolean; error?: string }> {
  // For now, this generates a JSON entry that can be submitted via PR
  // In the future, this could be an API call
  const entry: RegistryPlugin = {
    name: input.name,
    description: input.description,
    version: input.version,
    author: input.author,
    npmPackage: input.npmPackage,
    tags: input.tags,
    category: input.category,
    license: input.license,
    homepage: input.homepage,
    repository: input.repository,
    permissions: input.permissions,
    minVersion: input.minVersion,
    downloads: 0,
    rating: 0,
    featured: false,
    verified: false,
  }

  // Output the JSON entry for the user to submit
  console.log("\nPlugin entry for registry submission:\n")
  console.log(JSON.stringify(entry, null, 2))
  console.log("\nSubmit this entry via PR to: https://github.com/glassesglitchstudio-lab/Gltich_code")

  return { success: true }
}

// ============================================================================
// Utility
// ============================================================================

export function getCategoryEmoji(category: PluginCategory): string {
  const emojis: Record<PluginCategory, string> = {
    ai: "🤖",
    devtools: "🛠️",
    ui: "🎨",
    auth: "🔐",
    database: "🗄️",
    search: "🔍",
    automation: "⚙️",
    productivity: "📋",
    other: "📦",
  }
  return emojis[category]
}

export function formatPlugin(plugin: RegistryPlugin): string {
  const verified = plugin.verified ? " ✓" : ""
  const featured = plugin.featured ? " ⭐" : ""
  const downloads = plugin.downloads ? ` ↓${plugin.downloads}` : ""
  return `${plugin.name}${verified}${featured} v${plugin.version} — ${plugin.description}${downloads}`
}

export * as PluginRegistry from "./registry"
