import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import os from "os"

// Create a temp dir for the permission store
const testHome = join(os.tmpdir(), "glitchcode-perms-test-" + Math.random().toString(36).slice(2))
const permsFile = join(testHome, ".glitchcode", "plugin-permissions.json")

beforeEach(() => {
  mkdirSync(join(testHome, ".glitchcode"), { recursive: true })
})

afterEach(() => {
  rmSync(testHome, { recursive: true, force: true })
})

// Mock Filesystem to use our test paths
const { Filesystem } = await import("../../src/util")

// We need to mock permissionsFilePath. Since it uses process.env.HOME,
// we mock HOME to our test dir.
const homeEnvKey = process.platform === "win32" ? "USERPROFILE" : "HOME"
const originalHome = process.env[homeEnvKey]
process.env[homeEnvKey] = testHome

// Import the module under test
const {
  parsePermissions,
  checkPermission,
  permissionDescription,
  savePluginPermissions,
  loadPluginPermissions,
  PermissionCategory,
} = await import("../../src/plugin/permissions")

afterEach(() => {
  if (originalHome !== undefined) {
    process.env[homeEnvKey] = originalHome
  } else {
    delete process.env[homeEnvKey]
  }
})

function createPluginDir(dirName: string, pkgData: Record<string, unknown>) {
  const dir = join(testHome, dirName)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkgData, null, 2))
  return dir
}

describe("plugin.permissions", () => {
  describe("parsePermissions", () => {
    test("reads required permissions from package.json", async () => {
      const dir = createPluginDir("plugin-a", {
        name: "plugin-a",
        glitchcode: {
          permissions: ["filesystem:read", "network:http"],
        },
      })
      const perms = await parsePermissions(dir)
      expect(perms.required).toEqual(["filesystem:read", "network:http"])
      expect(perms.optional).toBeUndefined()
    })

    test("reads optional permissions (ending with ?)", async () => {
      const dir = createPluginDir("plugin-b", {
        name: "plugin-b",
        glitchcode: {
          permissions: ["filesystem:write", "shell:exec?"],
        },
      })
      const perms = await parsePermissions(dir)
      expect(perms.required).toEqual(["filesystem:write"])
      expect(perms.optional).toEqual(["shell:exec"])
    })

    test("returns empty required when no glitchcode field", async () => {
      const dir = createPluginDir("plugin-c", { name: "plugin-c" })
      const perms = await parsePermissions(dir)
      expect(perms.required).toEqual([])
    })

    test("returns empty required when permissions is not an array", async () => {
      const dir = createPluginDir("plugin-d", {
        name: "plugin-d",
        glitchcode: { permissions: "invalid" },
      })
      const perms = await parsePermissions(dir)
      expect(perms.required).toEqual([])
    })

    test("skips non-string entries in permissions array", async () => {
      const dir = createPluginDir("plugin-e", {
        name: "plugin-e",
        glitchcode: { permissions: ["filesystem:read", 123, null, "network:http"] },
      })
      const perms = await parsePermissions(dir)
      expect(perms.required).toEqual(["filesystem:read", "network:http"])
    })

    test("handles missing package.json gracefully", async () => {
      const dir = join(testHome, "nonexistent-plugin")
      mkdirSync(dir, { recursive: true })
      const perms = await parsePermissions(dir)
      expect(perms.required).toEqual([])
    })

    test("reads from file path (not directory)", async () => {
      const dir = createPluginDir("plugin-f", {
        name: "plugin-f",
        glitchcode: { permissions: ["tool:register"] },
      })
      const pkgPath = join(dir, "package.json")
      const perms = await parsePermissions(pkgPath)
      expect(perms.required).toEqual(["tool:register"])
    })
  })

  describe("checkPermission", () => {
    test("all required permissions granted", () => {
      const result = checkPermission(
        ["filesystem:read", "network:http", "shell:exec"],
        ["filesystem:read", "network:http"],
      )
      expect(result.allowed).toEqual(["filesystem:read", "network:http"])
      expect(result.denied).toEqual([])
    })

    test("some required permissions denied", () => {
      const result = checkPermission(
        ["filesystem:read"],
        ["filesystem:read", "shell:exec"],
      )
      expect(result.allowed).toEqual(["filesystem:read"])
      expect(result.denied).toEqual(["shell:exec"])
    })

    test("all required permissions denied", () => {
      const result = checkPermission([], ["filesystem:read", "shell:exec"])
      expect(result.allowed).toEqual([])
      expect(result.denied).toEqual(["filesystem:read", "shell:exec"])
    })

    test("empty required returns empty lists", () => {
      const result = checkPermission(["filesystem:read"], [])
      expect(result.allowed).toEqual([])
      expect(result.denied).toEqual([])
    })
  })

  describe("permissionDescription", () => {
    test("returns description for known permissions", () => {
      expect(permissionDescription("filesystem:read")).toBe("Read files from the filesystem")
      expect(permissionDescription("network:http")).toBe("Make HTTP requests")
      expect(permissionDescription("shell:exec")).toBe("Execute shell commands")
      expect(permissionDescription("tool:register")).toBe("Register new tools")
      expect(permissionDescription("auth:read")).toBe("Read authentication credentials")
    })

    test("returns raw string for unknown permissions", () => {
      expect(permissionDescription("custom:permission")).toBe("custom:permission")
    })
  })

  describe("PermissionCategory", () => {
    test("defines filesystem permissions", () => {
      expect(PermissionCategory.Filesystem.Read).toBe("filesystem:read")
      expect(PermissionCategory.Filesystem.Write).toBe("filesystem:write")
      expect(PermissionCategory.Filesystem.Execute).toBe("filesystem:execute")
    })

    test("defines network permissions", () => {
      expect(PermissionCategory.Network.Http).toBe("network:http")
      expect(PermissionCategory.Network.Https).toBe("network:https")
      expect(PermissionCategory.Network.WebSocket).toBe("network:websocket")
    })

    test("defines shell permissions", () => {
      expect(PermissionCategory.Shell.Exec).toBe("shell:exec")
      expect(PermissionCategory.Shell.Spawn).toBe("shell:spawn")
    })

    test("defines tool permissions", () => {
      expect(PermissionCategory.Tool.Register).toBe("tool:register")
      expect(PermissionCategory.Tool.Execute).toBe("tool:execute")
    })
  })

  describe("savePluginPermissions / loadPluginPermissions", () => {
    test("saves and loads permissions for a plugin", async () => {
      await savePluginPermissions("my-plugin", ["filesystem:read", "network:http"])
      const loaded = await loadPluginPermissions("my-plugin")
      expect(loaded).toEqual(["filesystem:read", "network:http"])
    })

    test("returns empty array for unknown plugin", async () => {
      const loaded = await loadPluginPermissions("nonexistent-plugin")
      expect(loaded).toEqual([])
    })

    test("overwrites permissions for same plugin", async () => {
      await savePluginPermissions("my-plugin", ["filesystem:read"])
      await savePluginPermissions("my-plugin", ["shell:exec"])
      const loaded = await loadPluginPermissions("my-plugin")
      expect(loaded).toEqual(["shell:exec"])
    })

    test("stores permissions for multiple plugins independently", async () => {
      await savePluginPermissions("plugin-a", ["filesystem:read"])
      await savePluginPermissions("plugin-b", ["network:http"])
      expect(await loadPluginPermissions("plugin-a")).toEqual(["filesystem:read"])
      expect(await loadPluginPermissions("plugin-b")).toEqual(["network:http"])
    })
  })
})
