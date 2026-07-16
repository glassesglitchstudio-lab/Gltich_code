import chokidar, { type FSWatcher } from "chokidar"
import path from "path"
import { pathToFileURL } from "url"
import { Log } from "../util"
import { Bus } from "../bus"
import { BusEvent } from "../bus/bus-event"
import { Filesystem } from "../util"
import { z } from "zod"

const log = Log.create({ service: "plugin.hot-reload" })

// ============================================================================
// Events
// ============================================================================

export const HotReloadEvent = {
  PluginChanged: BusEvent.define(
    "plugin.hot-reload.changed",
    z.object({
      pluginId: z.string(),
      filePath: z.string(),
      timestamp: z.number(),
    }),
  ),
  PluginReloaded: BusEvent.define(
    "plugin.hot-reload.reloaded",
    z.object({
      pluginId: z.string(),
      durationMs: z.number(),
      timestamp: z.number(),
    }),
  ),
  PluginReloadError: BusEvent.define(
    "plugin.hot-reload.error",
    z.object({
      pluginId: z.string(),
      error: z.string(),
      filePath: z.string(),
      timestamp: z.number(),
    }),
  ),
  WatcherStarted: BusEvent.define(
    "plugin.hot-reload.watcher-started",
    z.object({
      dirs: z.array(z.string()),
      timestamp: z.number(),
    }),
  ),
  WatcherStopped: BusEvent.define(
    "plugin.hot-reload.watcher-stopped",
    z.object({
      timestamp: z.number(),
    }),
  ),
} as const

// ============================================================================
// Types
// ============================================================================

export type PluginWatcherOptions = {
  /** Directories to watch for plugin changes */
  watchDirs: string[]
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number
  /** Callback invoked when a plugin is reloaded */
  onReload?: (pluginId: string) => void
  /** Callback invoked when a plugin reload fails */
  onError?: (pluginId: string, error: Error) => void
  /** Glob patterns to watch (default: *.ts, *.js, *.json) */
  patterns?: string[]
  /** Glob patterns to ignore (default: node_modules, .git) */
  ignored?: string[]
}

type PluginModule = {
  id?: string
  server?: (...args: unknown[]) => unknown
  tui?: (...args: unknown[]) => unknown
  default?: PluginModule
  dispose?: () => void | Promise<void>
  cleanup?: () => void | Promise<void>
  [key: string]: unknown
}

type ReloadEntry = {
  filePath: string
  pluginId: string
  modulePath: string
}

// ============================================================================
// Module cache utilities
// ============================================================================

function clearModuleCache(modulePath: string) {
  const resolved = require.resolve(modulePath)
  const mod = require.cache[resolved]
  if (!mod) return

  // Call dispose/cleanup if the module exports them
  try {
    const exports = mod.exports
    if (exports && typeof exports === "object") {
      if (typeof exports.dispose === "function") {
        exports.dispose()
      } else if (typeof exports.cleanup === "function") {
        exports.cleanup()
      }
    }
  } catch (err) {
    log.warn("failed to call module cleanup", { path: resolved, error: String(err) })
  }

  // Remove from cache
  delete require.cache[resolved]

  // Also clear parent modules that import this one
  if (mod.parent) {
    delete require.cache[mod.parent.id]
  }

  // Clear any children that depend on this module
  for (const [id, cached] of Object.entries(require.cache)) {
    const deps = (cached as { dependencies?: string[] } | undefined)?.dependencies
    if (deps?.includes(resolved)) {
      delete require.cache[id]
    }
  }
}

async function invalidateAndReload(modulePath: string): Promise<PluginModule> {
  clearModuleCache(modulePath)

  // Use timestamp query param to bust any ESM cache
  const fileUrl = pathToFileURL(modulePath).href
  const cacheBusted = `${fileUrl}?t=${Date.now()}`
  const mod = await import(cacheBusted)
  return (mod.default ?? mod) as PluginModule
}

function resolvePluginId(mod: PluginModule, filePath: string): string {
  if (mod.id) return mod.id
  if (mod.default?.id) return mod.default.id
  return path.basename(filePath, path.extname(filePath))
}

// ============================================================================
// PluginWatcher
// ============================================================================

export class PluginWatcher {
  private watcher: FSWatcher | null = null
  private options: Required<PluginWatcherOptions>
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  private reloadQueue = new Map<string, ReloadEntry>()
  private activeReloads = new Set<string>()
  private pluginModules = new Map<string, { modulePath: string; instance: PluginModule }>()
  private bus: Bus.Interface | null = null

  constructor(options: PluginWatcherOptions) {
    this.options = {
      watchDirs: options.watchDirs,
      debounceMs: options.debounceMs ?? 500,
      onReload: options.onReload ?? (() => {}),
      onError: options.onError ?? (() => {}),
      patterns: options.patterns ?? ["**/*.ts", "**/*.js", "**/*.json"],
      ignored: options.ignored ?? ["**/node_modules/**", "**/.git/**", "**/dist/**"],
    }
  }

  /**
   * Start watching plugin directories for changes.
   */
  async start(bus?: Bus.Interface): Promise<void> {
    if (this.watcher) {
      log.warn("watcher already started")
      return
    }

    this.bus = bus ?? null

    const watchPatterns = this.options.watchDirs.flatMap((dir) =>
      this.options.patterns.map((pattern) => path.join(dir, pattern)),
    )

    if (watchPatterns.length === 0) {
      log.warn("no directories to watch")
      return
    }

    this.watcher = chokidar.watch(watchPatterns, {
      ignored: this.options.ignored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    })

    this.watcher.on("change", (filePath) => this.handleChange(filePath))
    this.watcher.on("add", (filePath) => this.handleChange(filePath))
    this.watcher.on("unlink", (filePath) => this.handleRemove(filePath))
    this.watcher.on("error", (error) => {
      log.error("watcher error", { error: String(error) })
    })

    // chokidar 4.x uses the 'ready' event, not a promise-returning method
    await new Promise<void>((resolve) => {
      this.watcher!.once("ready", resolve)
    })

    log.info("plugin watcher started", { dirs: this.options.watchDirs })

    if (this.bus) {
      await this.bus.publish(HotReloadEvent.WatcherStarted, {
        dirs: this.options.watchDirs,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * Stop watching and clean up all resources.
   */
  async stop(): Promise<void> {
    if (!this.watcher) return

    // Clear all pending debounce timers
    for (const timer of Array.from(this.debounceTimers.values())) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()
    this.reloadQueue.clear()
    this.activeReloads.clear()

    await this.watcher.close()
    this.watcher = null

    log.info("plugin watcher stopped")

    if (this.bus) {
      await this.bus.publish(HotReloadEvent.WatcherStopped, {
        timestamp: Date.now(),
      })
    }
  }

  /**
   * Add a directory to the watch list.
   */
  async addDir(dir: string): Promise<void> {
    if (!this.watcher) {
      this.options.watchDirs.push(dir)
      return
    }

    const normalized = path.resolve(dir)
    if (this.options.watchDirs.includes(normalized)) return

    this.options.watchDirs.push(normalized)

    const patterns = this.options.patterns.map((pattern) => path.join(normalized, pattern))
    this.watcher.add(patterns)

    log.info("added directory to watch", { dir: normalized })
  }

  /**
   * Remove a directory from the watch list.
   */
  async removeDir(dir: string): Promise<void> {
    const normalized = path.resolve(dir)
    const index = this.options.watchDirs.indexOf(normalized)
    if (index === -1) return

    this.options.watchDirs.splice(index, 1)

    if (this.watcher) {
      const patterns = this.options.patterns.map((pattern) => path.join(normalized, pattern))
      this.watcher.unwatch(patterns)
    }

    log.info("removed directory from watch", { dir: normalized })
  }

  /**
   * Register a plugin module for tracking. Call this after initial plugin load
   * so the watcher knows which module to invalidate on change.
   */
  registerPlugin(pluginId: string, modulePath: string, instance: PluginModule): void {
    this.pluginModules.set(pluginId, { modulePath, instance })
  }

  /**
   * Unregister a plugin from tracking.
   */
  unregisterPlugin(pluginId: string): void {
    this.pluginModules.delete(pluginId)
  }

  /**
   * Get the list of currently watched directories.
   */
  getWatchedDirs(): string[] {
    return [...this.options.watchDirs]
  }

  /**
   * Check if the watcher is currently active.
   */
  isRunning(): boolean {
    return this.watcher !== null
  }

  // ==========================================================================
  // Internal handlers
  // ==========================================================================

  private async handleChange(filePath: string): Promise<void> {
    const normalized = path.resolve(filePath)
    const dir = this.findPluginDir(normalized)
    if (!dir) return

    const pluginId = this.resolvePluginIdForPath(normalized, dir)
    if (!pluginId) return

    // Debounce rapid changes to the same file
    const existing = this.debounceTimers.get(normalized)
    if (existing) clearTimeout(existing)

    this.debounceTimers.set(
      normalized,
      setTimeout(() => {
        this.debounceTimers.delete(normalized)
        this.enqueueReload(pluginId, normalized, dir)
      }, this.options.debounceMs),
    )
  }

  private handleRemove(filePath: string): void {
    const normalized = path.resolve(filePath)
    log.info("plugin file removed", { path: normalized })

    const timer = this.debounceTimers.get(normalized)
    if (timer) {
      clearTimeout(timer)
      this.debounceTimers.delete(normalized)
    }
  }

  private findPluginDir(filePath: string): string | null {
    for (const dir of this.options.watchDirs) {
      const normalized = path.resolve(dir)
      if (Filesystem.contains(normalized, filePath)) {
        return normalized
      }
    }
    return null
  }

  private resolvePluginIdForPath(filePath: string, pluginDir: string): string | null {
    const relative = path.relative(pluginDir, filePath)
    const parts = relative.split(path.sep)

    // For files in subdirectories, use the top-level directory as plugin ID
    if (parts.length > 1) {
      return parts[0]
    }

    // For files at the root of the plugin dir, use the filename without extension
    return path.basename(filePath, path.extname(filePath))
  }

  private enqueueReload(pluginId: string, filePath: string, pluginDir: string): void {
    // Don't queue if already actively reloading this plugin
    if (this.activeReloads.has(pluginId)) {
      log.debug("reload already in progress, skipping", { pluginId })
      return
    }

    const modulePath = path.join(pluginDir, pluginId)
    this.reloadQueue.set(pluginId, { filePath, pluginId, modulePath })

    // Process the queue
    this.processReloadQueue()
  }

  private async processReloadQueue(): Promise<void> {
    for (const [pluginId, entry] of Array.from(this.reloadQueue.entries())) {
      if (this.activeReloads.has(pluginId)) continue

      this.reloadQueue.delete(pluginId)
      this.activeReloads.add(pluginId)

      try {
        await this.reloadPlugin(entry)
      } finally {
        this.activeReloads.delete(pluginId)
      }
    }
  }

  private async reloadPlugin(entry: ReloadEntry): Promise<void> {
    const start = Date.now()

    log.info("reloading plugin", { pluginId: entry.pluginId, file: entry.filePath })

    // Publish change event
    if (this.bus) {
      await this.bus.publish(HotReloadEvent.PluginChanged, {
        pluginId: entry.pluginId,
        filePath: entry.filePath,
        timestamp: Date.now(),
      })
    }

    try {
      // Find the module path from the registered plugins
      const registered = this.pluginModules.get(entry.pluginId)
      const modulePath = registered?.modulePath ?? entry.modulePath

      // Invalidate cache and re-import
      const newModule = await invalidateAndReload(modulePath)
      const newId = resolvePluginId(newModule, entry.filePath)

      // Update the tracked module
      this.pluginModules.set(entry.pluginId, {
        modulePath,
        instance: newModule,
      })

      const durationMs = Date.now() - start

      log.info("plugin reloaded", {
        pluginId: entry.pluginId,
        newId,
        durationMs,
      })

      // Publish reload event
      if (this.bus) {
        await this.bus.publish(HotReloadEvent.PluginReloaded, {
          pluginId: entry.pluginId,
          durationMs,
          timestamp: Date.now(),
        })
      }

      // Invoke callback
      this.options.onReload(entry.pluginId)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      log.error("failed to reload plugin", {
        pluginId: entry.pluginId,
        error: err.message,
        file: entry.filePath,
      })

      // Publish error event
      if (this.bus) {
        await this.bus.publish(HotReloadEvent.PluginReloadError, {
          pluginId: entry.pluginId,
          error: err.message,
          filePath: entry.filePath,
          timestamp: Date.now(),
        })
      }

      // Invoke error callback
      this.options.onError(entry.pluginId, err)
    }
  }
}

// ============================================================================
// Convenience: create and start a watcher from env/config
// ============================================================================

export type CreateWatcherOptions = {
  watchDirs?: string[]
  debounceMs?: number
  onReload?: (pluginId: string) => void
  onError?: (pluginId: string, error: Error) => void
}

/**
 * Create a PluginWatcher from common configuration.
 * If no dirs are provided, defaults to the .glitchcode directory.
 */
export function createWatcher(options: CreateWatcherOptions = {}): PluginWatcher {
  const dirs = options.watchDirs ?? [path.join(process.cwd(), ".glitchcode")]
  return new PluginWatcher({
    watchDirs: dirs,
    debounceMs: options.debounceMs,
    onReload: options.onReload,
    onError: options.onError,
  })
}

/**
 * Check if hot reload is enabled via the --watch flag or env var.
 */
export function isHotReloadEnabled(): boolean {
  return process.argv.includes("--watch") || process.env.GLITCHCODE_HOT_RELOAD === "1"
}

/**
 * Get plugin directories to watch from the project structure.
 * Scans .glitchcode directories at project root and global config.
 */
export async function getPluginDirectories(): Promise<string[]> {
  const dirs: string[] = []
  const cwd = process.cwd()

  // Project-local plugin directory
  const localDir = path.join(cwd, ".glitchcode")
  if (await Filesystem.exists(localDir)) {
    dirs.push(localDir)
  }

  // Global plugin directory
  const { Global } = await import("../global")
  const globalDir = path.join(Global.Path.config, "plugins")
  if (await Filesystem.exists(globalDir)) {
    dirs.push(globalDir)
  }

  return dirs
}

/**
 * Start a hot-reload watcher with default configuration.
 * Convenience function for the common case.
 */
export async function startHotReload(
  bus?: Bus.Interface,
  options?: CreateWatcherOptions,
): Promise<PluginWatcher> {
  const dirs = options?.watchDirs ?? (await getPluginDirectories())
  const watcher = createWatcher({ ...options, watchDirs: dirs })
  await watcher.start(bus)
  return watcher
}

export * as PluginHotReload from "./hot-reload"
