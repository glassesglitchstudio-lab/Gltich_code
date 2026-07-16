import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs"
import { join } from "path"
import os from "os"

// Create isolated home dir for key/trust storage
const testHome = join(os.tmpdir(), "glitchcode-signing-test-" + Math.random().toString(36).slice(2))
function trustFile(home: string) { return join(home, ".glitchcode", "trust.json") }
mkdirSync(join(testHome, ".glitchcode"), { recursive: true })

// Mock os.homedir for the signing module's path constants
const homeSpy = spyOn(os, "homedir").mockReturnValue(testHome)

// Mock Filesystem using the SAME path the signing module imports from
// The @/ alias resolves to src/, so we mock the namespace directly
const { Filesystem } = await import("../../src/util")
const writeJsonSpy = spyOn(Filesystem, "writeJson").mockImplementation(async (p: string, data: unknown) => {
  mkdirSync(join(p, ".."), { recursive: true })
  writeFileSync(p, JSON.stringify(data))
})
const existsSpy = spyOn(Filesystem, "exists").mockImplementation(async (p: string) => {
  try { require("fs").accessSync(p); return true } catch { return false }
})
// readJson MUST return synchronously — verifyPlugin calls it without await
const readJsonSpy = spyOn(Filesystem, "readJson").mockImplementation((p: string) => {
  return JSON.parse(require("fs").readFileSync(p, "utf8")) as any
})
const writeSpy = spyOn(Filesystem, "write").mockImplementation(async (p: string, content: string | Buffer | Uint8Array, _mode?: number) => {
  mkdirSync(join(p, ".."), { recursive: true })
  writeFileSync(p, content)
})
// readText MUST return synchronously — hashPackageContent calls it without await
const readTextSpy = spyOn(Filesystem, "readText").mockImplementation((p: string) => {
  return require("fs").readFileSync(p, "utf8") as any
})

const {
  generateKeyPair,
  signPlugin,
  verifyPlugin,
  saveTrustList,
  loadTrustList,
  isTrusted,
  getTrustedKey,
} = await import("../../src/plugin/signing")

afterEach(() => {
  try { rmSync(testHome, { recursive: true, force: true }) } catch {}
  mkdirSync(join(testHome, ".glitchcode"), { recursive: true })
})

describe("plugin.signing", () => {
  describe("generateKeyPair", () => {
    test("returns publicKey and privateKey as PEM strings", () => {
      const keys = generateKeyPair()
      expect(keys.publicKey).toContain("BEGIN PUBLIC KEY")
      expect(keys.privateKey).toContain("BEGIN PRIVATE KEY")
    })

    test("generates unique keys each call", () => {
      const keys1 = generateKeyPair()
      const keys2 = generateKeyPair()
      expect(keys1.publicKey).not.toBe(keys2.publicKey)
      expect(keys1.privateKey).not.toBe(keys2.privateKey)
    })
  })

  describe("signPlugin", () => {
    let pkgDir: string

    beforeEach(() => {
      pkgDir = join(os.tmpdir(), "glitchcode-sign-pkg-" + Math.random().toString(36).slice(2))
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "test-plugin", version: "1.0.0" }))
      writeFileSync(join(pkgDir, "index.ts"), 'export default { id: "test" }')
    })

    afterEach(() => {
      rmSync(pkgDir, { recursive: true, force: true })
    })

    test("creates a signature with hash, timestamp, and publicKey", async () => {
      const keys = generateKeyPair()
      const sig = signPlugin(keys.privateKey, pkgDir)
      await Bun.sleep(50)
      expect(sig.signature).toBeDefined()
      expect(sig.signature.length).toBeGreaterThan(0)
      expect(sig.hash).toMatch(/^[a-f0-9]{64}$/)
      expect(sig.timestamp).toBeGreaterThan(0)
      expect(sig.publicKey).toContain("BEGIN PUBLIC KEY")
    })

    test("writes plugin-signature.json to package directory", async () => {
      const keys = generateKeyPair()
      signPlugin(keys.privateKey, pkgDir)
      await Bun.sleep(50)
      expect(await existsSpy(join(pkgDir, "plugin-signature.json"))).toBe(true)
    })

    test("same content produces same hash", async () => {
      const keys = generateKeyPair()
      const sig1 = signPlugin(keys.privateKey, pkgDir)
      await Bun.sleep(50)
      const sig2 = signPlugin(keys.privateKey, pkgDir)
      expect(sig1.hash).toBe(sig2.hash)
    })
  })

  describe("verifyPlugin", () => {
    let pkgDir: string

    beforeEach(() => {
      pkgDir = join(os.tmpdir(), "glitchcode-verify-pkg-" + Math.random().toString(36).slice(2))
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "test-plugin", version: "1.0.0" }))
      writeFileSync(join(pkgDir, "index.ts"), 'export default { id: "test" }')
    })

    afterEach(() => {
      rmSync(pkgDir, { recursive: true, force: true })
    })

    test("returns valid for correctly signed package", async () => {
      const keys = generateKeyPair()
      signPlugin(keys.privateKey, pkgDir)
      await Bun.sleep(50)
      const result = verifyPlugin(keys.publicKey, pkgDir)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    test("returns invalid when no signature file exists", () => {
      const keys = generateKeyPair()
      const result = verifyPlugin(keys.publicKey, pkgDir)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("No plugin-signature.json found")
    })

    test("returns invalid when content is modified after signing", async () => {
      const keys = generateKeyPair()
      signPlugin(keys.privateKey, pkgDir)
      await Bun.sleep(50)
      writeFileSync(join(pkgDir, "index.ts"), 'export default { id: "modified" }')
      const result = verifyPlugin(keys.publicKey, pkgDir)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("modified since signing")
    })

    test("returns invalid with wrong public key", async () => {
      const keys = generateKeyPair()
      signPlugin(keys.privateKey, pkgDir)
      await Bun.sleep(50)
      const wrongKeys = generateKeyPair()
      const result = verifyPlugin(wrongKeys.publicKey, pkgDir)
      expect(result.valid).toBe(false)
    })

    test("can verify signature with the correct public key", async () => {
      const keys = generateKeyPair()
      signPlugin(keys.privateKey, pkgDir)
      await Bun.sleep(50)
      // Verify with the original public key (not the derived one from readPublicKeyFromPrivate)
      const result = verifyPlugin(keys.publicKey, pkgDir)
      expect(result.valid).toBe(true)
    })
  })

  describe("saveTrustList / loadTrustList", () => {
    test("saves trust list to disk", () => {
      const trustList = { alice: "public-key-1", bob: "public-key-2" }
      saveTrustList(trustList)
      const saved = JSON.parse(readFileSync(trustFile(testHome), "utf-8"))
      expect(saved).toEqual(trustList)
    })

    test("loads trust list from disk", () => {
      const trustList = { alice: "public-key-1" }
      writeFileSync(trustFile(testHome), JSON.stringify(trustList))
      const loaded = loadTrustList()
      expect(loaded).toEqual(trustList)
    })

    test("returns empty object when trust file does not exist", () => {
      rmSync(trustFile(testHome), { force: true })
      const loaded = loadTrustList()
      expect(loaded).toEqual({})
    })
  })

  describe("isTrusted", () => {
    test("returns true for trusted author", () => {
      writeFileSync(trustFile(testHome), JSON.stringify({ alice: "key-1" }))
      expect(isTrusted("alice")).toBe(true)
    })

    test("returns false for unknown author", () => {
      writeFileSync(trustFile(testHome), JSON.stringify({ alice: "key-1" }))
      expect(isTrusted("unknown")).toBe(false)
    })

    test("returns false when trust file does not exist", () => {
      rmSync(trustFile(testHome), { force: true })
      expect(isTrusted("anyone")).toBe(false)
    })
  })

  describe("getTrustedKey", () => {
    test("returns public key for trusted author", () => {
      writeFileSync(trustFile(testHome), JSON.stringify({ alice: "public-key-1" }))
      expect(getTrustedKey("alice")).toBe("public-key-1")
    })

    test("returns undefined for unknown author", () => {
      writeFileSync(trustFile(testHome), JSON.stringify({ alice: "public-key-1" }))
      expect(getTrustedKey("unknown")).toBeUndefined()
    })
  })
})
