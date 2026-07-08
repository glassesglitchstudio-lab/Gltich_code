import { describe, expect, test, mock, afterEach } from "bun:test"
import * as fs from "fs/promises"
import os from "os"
import path from "path"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import { SecretScannerTool } from "../../src/tool/secret-scanner"
import { SessionID, MessageID } from "../../src/session/schema"
import { Instance } from "../../src/project/instance"

const ctx = {
  sessionID: SessionID.make("ses_test"),
  messageID: MessageID.make("message"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

async function withTmpDir(fn: (dir: string) => Promise<void>) {
  const dir = path.join(os.tmpdir(), "secret-scanner-test-" + Math.random().toString(36).slice(2))
  await fs.mkdir(dir, { recursive: true })
  try {
    await Instance.provide({ directory: dir, fn: () => fn(dir) })
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

const originalSpawn = Bun.spawn
function mockSpawn(responses: { [cmd: string]: { stdout: string; stderr: string; code: number } }) {
  Bun.spawn = ((args: string[], opts?: any) => {
    const cmd = args.join(" ")
    const matchingKey = Object.keys(responses).find((key) => cmd.includes(key))
    const resp = matchingKey ? responses[matchingKey] : { stdout: "", stderr: "", code: 0 }
    return {
      stdout: new Response(resp.stdout),
      stderr: new Response(resp.stderr),
      exited: Promise.resolve(resp.code),
    }
  }) as any
}

describe("secret-scanner", () => {
  afterEach(() => {
    Bun.spawn = originalSpawn
  })

  test("detects API keys in source code", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "config.ts")
      await fs.writeFile(filePath, 'const API_KEY = "sk-1234567890abcdefghijklmnop"\n')
      mockSpawn({
        find: { stdout: filePath, stderr: "", code: 0 },
        cat: { stdout: "", stderr: "", code: 1 },
      })

      const result = await SecretScannerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, severity: "all" as const, fix_gitignore: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("Secrets found")
      expect(result.metadata.secrets).toBeGreaterThan(0)
    })
  })

  test("detects private keys", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "key.pem")
      await fs.writeFile(filePath, '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n')
      mockSpawn({
        find: { stdout: filePath, stderr: "", code: 0 },
        cat: { stdout: "", stderr: "", code: 1 },
      })

      const result = await SecretScannerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, severity: "all" as const, fix_gitignore: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("Private Key")
    })
  })

  test("detects GitHub tokens", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "env.ts")
      await fs.writeFile(filePath, 'const token = "ghp_1234567890abcdefghij1234567890ab"\n')
      mockSpawn({
        find: { stdout: filePath, stderr: "", code: 0 },
        cat: { stdout: "", stderr: "", code: 1 },
      })

      const result = await SecretScannerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, severity: "all" as const, fix_gitignore: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("GitHub Token")
    })
  })

  test("reports no secrets in clean code", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "clean.ts")
      await fs.writeFile(filePath, 'export const add = (a: number, b: number) => a + b\n')
      mockSpawn({
        find: { stdout: filePath, stderr: "", code: 0 },
        cat: { stdout: "", stderr: "", code: 1 },
      })

      const result = await SecretScannerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, severity: "all" as const, fix_gitignore: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("no secrets detected")
      expect(result.metadata.secrets).toBe(0)
    })
  })

  test("severity filter works", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "mixed.ts")
      await fs.writeFile(filePath, [
        'const API_KEY = "sk-1234567890abcdefghijklmnop"',
        'const token = "ghp_1234567890abcdefghij1234567890ab"',
      ].join("\n"))
      mockSpawn({
        find: { stdout: filePath, stderr: "", code: 0 },
        cat: { stdout: "", stderr: "", code: 1 },
      })

      const result = await SecretScannerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, severity: "critical" as const, fix_gitignore: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.metadata.secrets).toBeGreaterThan(0)
    })
  })

  test("returns error for empty directory scan", async () => {
    await withTmpDir(async (dir) => {
      mockSpawn({
        find: { stdout: "", stderr: "", code: 0 },
      })

      const result = await SecretScannerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, severity: "all" as const, fix_gitignore: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("No files found")
      expect(result.metadata.error).toBe(true)
    })
  })
})
