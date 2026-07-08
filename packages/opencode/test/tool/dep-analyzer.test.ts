import { describe, expect, test, mock, afterEach } from "bun:test"
import * as fs from "fs/promises"
import os from "os"
import path from "path"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import { DepAnalyzerTool } from "../../src/tool/dep-analyzer"
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
  const dir = path.join(os.tmpdir(), "dep-analyzer-test-" + Math.random().toString(36).slice(2))
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

describe("dep-analyzer", () => {
  afterEach(() => {
    Bun.spawn = originalSpawn
  })

  test("summary operation returns dependency count", async () => {
    await withTmpDir(async (dir) => {
      const pkg = {
        name: "test-pkg",
        version: "1.0.0",
        dependencies: { react: "^18.0.0", lodash: "^4.0.0" },
        devDependencies: { typescript: "^5.0.0" },
      }
      await fs.writeFile(path.join(dir, "package.json"), JSON.stringify(pkg))
      mockSpawn({})

      const result = await DepAnalyzerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "summary" as const, fix: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("Dependencies")
      expect(result.output).toContain("2")
      expect(result.output).toContain("1")
    })
  })

  test("summary includes peer dependencies", async () => {
    await withTmpDir(async (dir) => {
      const pkg = {
        name: "test-pkg",
        dependencies: { react: "^18.0.0" },
        peerDependencies: { react: "^17.0.0 || ^18.0.0" },
      }
      await fs.writeFile(path.join(dir, "package.json"), JSON.stringify(pkg))
      mockSpawn({})

      const result = await DepAnalyzerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "summary" as const, fix: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("Peer Dependencies")
    })
  })

  test("returns error when no package.json exists", async () => {
    await withTmpDir(async (dir) => {
      mockSpawn({})
      const result = await DepAnalyzerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "summary" as const, fix: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("No package.json")
      expect(result.metadata.error).toBe(true)
    })
  })

  test("returns error for invalid package.json", async () => {
    await withTmpDir(async (dir) => {
      await fs.writeFile(path.join(dir, "package.json"), "not json {{{")
      mockSpawn({})

      const result = await DepAnalyzerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "summary" as const, fix: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("Invalid")
      expect(result.metadata.error).toBe(true)
    })
  })

  test("audit operation handles no vulnerabilities", async () => {
    await withTmpDir(async (dir) => {
      const pkg = { name: "safe-pkg", dependencies: {} }
      await fs.writeFile(path.join(dir, "package.json"), JSON.stringify(pkg))
      mockSpawn({
        "npm audit": { stdout: '{"vulnerabilities":{}}', stderr: "", code: 0 },
      })

      const result = await DepAnalyzerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "audit" as const, fix: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("No known vulnerabilities")
    })
  })
})
