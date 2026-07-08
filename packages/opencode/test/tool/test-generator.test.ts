import { describe, expect, test } from "bun:test"
import * as fs from "fs/promises"
import os from "os"
import path from "path"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import { TestGeneratorTool } from "../../src/tool/test-generator"
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
  const dir = path.join(os.tmpdir(), "test-generator-test-" + Math.random().toString(36).slice(2))
  await fs.mkdir(dir, { recursive: true })
  try {
    await Instance.provide({ directory: dir, fn: () => fn(dir) })
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

describe("test-generator", () => {
  test("generates tests for exported functions", async () => {
    await withTmpDir(async (dir) => {
      const srcPath = path.join(dir, "math.ts")
      await fs.writeFile(srcPath, 'export function add(a: number, b: number) { return a + b }\n')

      const result = await TestGeneratorTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: srcPath, framework: "bun" as const, coverage: "comprehensive" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("Test Generation Complete")
      expect(result.output).toContain("function add")
      expect(result.metadata.exports).toBe(1)
      expect(result.metadata.functions).toBe(1)
    })
  })

  test("generates tests for exported classes", async () => {
    await withTmpDir(async (dir) => {
      const srcPath = path.join(dir, "service.ts")
      await fs.writeFile(srcPath, 'export class UserService {\n  getUser() { return null }\n}\n')

      const result = await TestGeneratorTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: srcPath, framework: "bun" as const, coverage: "comprehensive" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("class UserService")
      expect(result.metadata.classes).toBe(1)
    })
  })

  test("generates tests for exported constants", async () => {
    await withTmpDir(async (dir) => {
      const srcPath = path.join(dir, "constants.ts")
      await fs.writeFile(srcPath, 'export const MAX_RETRIES = 3\n')

      const result = await TestGeneratorTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: srcPath, framework: "bun" as const, coverage: "comprehensive" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("const MAX_RETRIES")
      expect(result.metadata.exports).toBe(1)
    })
  })

  test("returns error for missing file", async () => {
    await withTmpDir(async (dir) => {
      const result = await TestGeneratorTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: path.join(dir, "nonexistent.ts"), framework: "bun" as const, coverage: "comprehensive" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("Could not read file")
      expect(result.metadata.error).toBe(true)
    })
  })

  test("returns message when no exports found", async () => {
    await withTmpDir(async (dir) => {
      const srcPath = path.join(dir, "empty.ts")
      await fs.writeFile(srcPath, 'const internal = 42\n')

      const result = await TestGeneratorTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: srcPath, framework: "bun" as const, coverage: "comprehensive" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("No exports found")
      expect(result.metadata.exports).toBe(0)
    })
  })

  test("writes test file to default path", async () => {
    await withTmpDir(async (dir) => {
      const srcPath = path.join(dir, "utils.ts")
      await fs.writeFile(srcPath, 'export function helper() { return true }\n')

      await TestGeneratorTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: srcPath, framework: "bun" as const, coverage: "comprehensive" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )

      const testPath = path.join(dir, "utils.test.ts")
      const testContent = await fs.readFile(testPath, "utf-8")
      expect(testContent).toContain("describe")
      expect(testContent).toContain("helper")
    })
  })

  test("writes test file to custom output path", async () => {
    await withTmpDir(async (dir) => {
      const srcPath = path.join(dir, "utils.ts")
      const customOutput = path.join(dir, "__tests__", "utils.test.ts")
      await fs.writeFile(srcPath, 'export function helper() { return true }\n')

      await TestGeneratorTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: srcPath, framework: "bun" as const, coverage: "comprehensive" as const, output: customOutput }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )

      const testContent = await fs.readFile(customOutput, "utf-8")
      expect(testContent).toContain("describe")
    })
  })

  test("handles multiple exports", async () => {
    await withTmpDir(async (dir) => {
      const srcPath = path.join(dir, "multi.ts")
      await fs.writeFile(srcPath, [
        'export function add(a: number) { return a }',
        'export class Calculator {}',
        'export const PI = 3.14',
      ].join("\n"))

      const result = await TestGeneratorTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: srcPath, framework: "bun" as const, coverage: "comprehensive" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.metadata.exports).toBe(3)
      expect(result.metadata.functions).toBe(1)
      expect(result.metadata.classes).toBe(1)
    })
  })
})
