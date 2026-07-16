import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import type { RegistryManifest, RegistryPlugin } from "../../src/plugin/registry"

// Mock data
const mockPlugins: RegistryPlugin[] = [
  {
    name: "ai-helper",
    description: "AI-powered code assistant",
    version: "1.0.0",
    author: "alice",
    tags: ["ai", "code"],
    category: "ai",
    npmPackage: "@glitchcode/ai-helper",
    downloads: 5000,
    rating: 4.8,
    featured: true,
    verified: true,
  },
  {
    name: "db-connect",
    description: "Database connection manager",
    version: "2.1.0",
    author: "bob",
    tags: ["database", "sql"],
    category: "database",
    npmPackage: "@glitchcode/db-connect",
    downloads: 12000,
    rating: 4.5,
    featured: false,
  },
  {
    name: "ui-kit",
    description: "Component library for TUI",
    version: "0.9.0",
    author: "carol",
    tags: ["ui", "components"],
    category: "ui",
    npmPackage: "@glitchcode/ui-kit",
    downloads: 8000,
    rating: 4.2,
    featured: true,
  },
  {
    name: "web-scraper",
    description: "Web scraping automation tool",
    version: "1.2.0",
    author: "alice",
    tags: ["automation", "web"],
    category: "automation",
    npmPackage: "@glitchcode/web-scraper",
    downloads: 3000,
    rating: 3.9,
    featured: false,
  },
]

const mockManifest: RegistryManifest = {
  version: 1,
  plugins: mockPlugins,
  updatedAt: "2026-01-01T00:00:00Z",
}

// Import the module
const registry = await import("../../src/plugin/registry")
const { searchPlugins, getPlugin, getFeaturedPlugins, getPluginsByCategory, getCategoryEmoji, formatPlugin } = registry

let fetchRegistrySpy: ReturnType<typeof spyOn>

beforeEach(() => {
  // Mock fetchRegistry to return our test data without network
  fetchRegistrySpy = spyOn(registry, "fetchRegistry").mockResolvedValue(mockManifest)
})

afterEach(() => {
  fetchRegistrySpy.mockRestore()
})

describe("plugin.registry", () => {
  describe("searchPlugins", () => {
    test("returns all plugins when no options", async () => {
      const result = await searchPlugins()
      expect(result.total).toBe(4)
      expect(result.plugins.length).toBe(4)
      expect(result.offset).toBe(0)
      expect(result.limit).toBe(20)
    })

    test("filters by query matching name", async () => {
      const result = await searchPlugins({ query: "ai-helper" })
      expect(result.total).toBe(1)
      expect(result.plugins[0].name).toBe("ai-helper")
    })

    test("filters by query matching description", async () => {
      const result = await searchPlugins({ query: "database" })
      expect(result.total).toBe(1)
      expect(result.plugins[0].name).toBe("db-connect")
    })

    test("filters by query matching tags", async () => {
      const result = await searchPlugins({ query: "sql" })
      expect(result.total).toBe(1)
      expect(result.plugins[0].name).toBe("db-connect")
    })

    test("filters by query matching author", async () => {
      const result = await searchPlugins({ query: "alice" })
      expect(result.total).toBe(2)
      expect(result.plugins.map((p) => p.name)).toContain("ai-helper")
      expect(result.plugins.map((p) => p.name)).toContain("web-scraper")
    })

    test("filters by category", async () => {
      const result = await searchPlugins({ category: "ai" })
      expect(result.total).toBe(1)
      expect(result.plugins[0].category).toBe("ai")
    })

    test("sorts by downloads descending", async () => {
      const result = await searchPlugins({ sort: "downloads" })
      const downloads = result.plugins.map((p) => p.downloads ?? 0)
      expect(downloads).toEqual([12000, 8000, 5000, 3000])
    })

    test("sorts by rating descending", async () => {
      const result = await searchPlugins({ sort: "rating" })
      const ratings = result.plugins.map((p) => p.rating ?? 0)
      expect(ratings).toEqual([4.8, 4.5, 4.2, 3.9])
    })

    test("sorts by name ascending", async () => {
      const result = await searchPlugins({ sort: "name" })
      const names = result.plugins.map((p) => p.name)
      expect(names).toEqual(["ai-helper", "db-connect", "ui-kit", "web-scraper"])
    })

    test("sorts by updated puts featured first", async () => {
      const result = await searchPlugins({ sort: "updated" })
      expect(result.plugins[0].featured).toBe(true)
    })

    test("paginates with limit and offset", async () => {
      const result = await searchPlugins({ limit: 2, offset: 1 })
      expect(result.plugins.length).toBe(2)
      expect(result.total).toBe(4)
      expect(result.offset).toBe(1)
      expect(result.limit).toBe(2)
      // Default sort: featured first, then downloads desc
      // [ui-kit(8k), ai-helper(5k), db-connect(12k), web-scraper(3k)]
      // offset=1 → ai-helper, db-connect
      expect(result.plugins[0].name).toBe("ai-helper")
    })

    test("combines query and category filter", async () => {
      const result = await searchPlugins({ query: "alice", category: "automation" })
      expect(result.total).toBe(1)
      expect(result.plugins[0].name).toBe("web-scraper")
    })
  })

  describe("getPlugin", () => {
    test("returns plugin by name", async () => {
      const plugin = await getPlugin("ai-helper")
      expect(plugin).not.toBeNull()
      expect(plugin!.name).toBe("ai-helper")
      expect(plugin!.category).toBe("ai")
    })

    test("returns null for non-existing name", async () => {
      const plugin = await getPlugin("nonexistent")
      expect(plugin).toBeNull()
    })
  })

  describe("getFeaturedPlugins", () => {
    test("returns only featured plugins", async () => {
      const featured = await getFeaturedPlugins()
      expect(featured.length).toBe(2)
      expect(featured.every((p) => p.featured)).toBe(true)
      expect(featured.map((p) => p.name)).toContain("ai-helper")
      expect(featured.map((p) => p.name)).toContain("ui-kit")
    })
  })

  describe("getPluginsByCategory", () => {
    test("returns plugins in the given category", async () => {
      const aiPlugins = await getPluginsByCategory("ai")
      expect(aiPlugins.length).toBe(1)
      expect(aiPlugins[0].category).toBe("ai")
    })

    test("returns empty array for category with no plugins", async () => {
      const authPlugins = await getPluginsByCategory("auth")
      expect(authPlugins.length).toBe(0)
    })
  })

  describe("getCategoryEmoji", () => {
    test("returns emoji for known categories", () => {
      expect(getCategoryEmoji("ai")).toBe("🤖")
      expect(getCategoryEmoji("devtools")).toBe("🛠️")
      expect(getCategoryEmoji("ui")).toBe("🎨")
      expect(getCategoryEmoji("database")).toBe("🗄️")
      expect(getCategoryEmoji("automation")).toBe("⚙️")
      expect(getCategoryEmoji("other")).toBe("📦")
    })
  })

  describe("formatPlugin", () => {
    test("formats basic plugin", () => {
      const result = formatPlugin(mockPlugins[1])
      expect(result).toContain("db-connect")
      expect(result).toContain("v2.1.0")
      expect(result).toContain("Database connection manager")
      expect(result).toContain("↓12000")
    })

    test("formats featured and verified plugin", () => {
      const result = formatPlugin(mockPlugins[0])
      expect(result).toContain("✓")
      expect(result).toContain("⭐")
    })
  })

  describe("fetchRegistry", () => {
    test("is called by searchPlugins", async () => {
      fetchRegistrySpy.mockRestore()
      const freshSpy = spyOn(registry, "fetchRegistry").mockResolvedValue(mockManifest)
      try {
        await searchPlugins()
        expect(freshSpy).toHaveBeenCalledTimes(1)
      } finally {
        freshSpy.mockRestore()
      }
    })
  })
})
