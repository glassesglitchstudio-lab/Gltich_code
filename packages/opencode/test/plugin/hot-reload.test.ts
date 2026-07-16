import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { mkdirSync, rmSync } from "fs"
import { join } from "path"
import os from "os"

// Save and restore env/argv
const originalArgv = [...process.argv]
const originalHotReload = process.env.GLITCHCODE_HOT_RELOAD
const tmpdirBase = join(os.tmpdir(), "glitchcode-hot-reload-test-" + Math.random().toString(36).slice(2))

beforeEach(() => {
  mkdirSync(tmpdirBase, { recursive: true })
})

afterEach(() => {
  process.argv = [...originalArgv]
  if (originalHotReload !== undefined) {
    process.env.GLITCHCODE_HOT_RELOAD = originalHotReload
  } else {
    delete process.env.GLITCHCODE_HOT_RELOAD
  }
  rmSync(tmpdirBase, { recursive: true, force: true })
})

// Import the module under test
const { PluginWatcher, isHotReloadEnabled, createWatcher } = await import("../../src/plugin/hot-reload")

describe("plugin.hot-reload", () => {
  describe("PluginWatcher", () => {
    test("can be instantiated with required options", () => {
      const watcher = new PluginWatcher({
        watchDirs: [join(tmpdirBase, "plugins")],
      })
      expect(watcher).toBeDefined()
      expect(watcher.isRunning()).toBe(false)
    })

    test("returns watched dirs from constructor", () => {
      const dir1 = join(tmpdirBase, "dir1")
      const dir2 = join(tmpdirBase, "dir2")
      const watcher = new PluginWatcher({ watchDirs: [dir1, dir2] })
      const dirs = watcher.getWatchedDirs()
      expect(dirs).toEqual([dir1, dir2])
    })

    test("registers and unregisters plugins", () => {
      const watcher = new PluginWatcher({ watchDirs: [] })
      const instance = { id: "test" }
      watcher.registerPlugin("test-plugin", join(tmpdirBase, "test-plugin.ts"), instance)
      watcher.unregisterPlugin("test-plugin")
      // No error thrown
    })

    test("addDir adds directory before start", () => {
      const watcher = new PluginWatcher({ watchDirs: [] })
      const newDir = join(tmpdirBase, "new-dir")
      watcher.addDir(newDir)
      expect(watcher.getWatchedDirs()).toContain(newDir)
    })

    test("removeDir removes directory from list", () => {
      const dir1 = join(tmpdirBase, "watcher-dir1")
      const dir2 = join(tmpdirBase, "watcher-dir2")
      mkdirSync(dir1, { recursive: true })
      mkdirSync(dir2, { recursive: true })
      const watcher = new PluginWatcher({ watchDirs: [dir1, dir2] })
      watcher.removeDir(dir1)
      expect(watcher.getWatchedDirs()).not.toContain(dir1)
      expect(watcher.getWatchedDirs()).toContain(dir2)
    })

    test("removeDir is a no-op for unknown directory", () => {
      const dir1 = join(tmpdirBase, "watcher-dir1")
      mkdirSync(dir1, { recursive: true })
      const watcher = new PluginWatcher({ watchDirs: [dir1] })
      watcher.removeDir(join(tmpdirBase, "unknown"))
      expect(watcher.getWatchedDirs()).toEqual([dir1])
    })

    test("start and stop lifecycle", async () => {
      const dir = join(tmpdirBase, "lifecycle")
      mkdirSync(dir, { recursive: true })
      const watcher = new PluginWatcher({ watchDirs: [dir] })
      await watcher.start()
      expect(watcher.isRunning()).toBe(true)
      await watcher.stop()
      expect(watcher.isRunning()).toBe(false)
    })

    test("stop is a no-op when not started", async () => {
      const watcher = new PluginWatcher({ watchDirs: [] })
      await watcher.stop()
      expect(watcher.isRunning()).toBe(false)
    })
  })

  describe("isHotReloadEnabled", () => {
    test("returns false by default", () => {
      process.argv = ["node", "test"]
      delete process.env.GLITCHCODE_HOT_RELOAD
      expect(isHotReloadEnabled()).toBe(false)
    })

    test("returns true when --watch flag is present", () => {
      process.argv = ["node", "test", "--watch"]
      expect(isHotReloadEnabled()).toBe(true)
    })

    test("returns true when GLITCHCODE_HOT_RELOAD=1", () => {
      process.argv = ["node", "test"]
      process.env.GLITCHCODE_HOT_RELOAD = "1"
      expect(isHotReloadEnabled()).toBe(true)
    })

    test("returns false when GLITCHCODE_HOT_RELOAD is not '1'", () => {
      process.argv = ["node", "test"]
      process.env.GLITCHCODE_HOT_RELOAD = "true"
      expect(isHotReloadEnabled()).toBe(false)
    })
  })

  describe("createWatcher", () => {
    test("creates watcher with default .glitchcode directory", () => {
      const watcher = createWatcher()
      expect(watcher).toBeDefined()
      expect(watcher.isRunning()).toBe(false)
    })

    test("creates watcher with custom directories", () => {
      const dir = join(tmpdirBase, "custom")
      mkdirSync(dir, { recursive: true })
      const watcher = createWatcher({ watchDirs: [dir] })
      expect(watcher.getWatchedDirs()).toEqual([dir])
    })

    test("creates watcher with custom debounce", () => {
      const watcher = createWatcher({ debounceMs: 100 })
      expect(watcher).toBeDefined()
    })
  })
})
