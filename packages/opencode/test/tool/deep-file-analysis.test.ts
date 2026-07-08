import { describe, expect, test } from "bun:test"
import * as fs from "fs/promises"
import os from "os"
import path from "path"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import { DeepFileAnalysisTool } from "../../src/tool/deep-file-analysis"
import { SessionID, MessageID } from "../../src/session/schema"
import { Instance } from "../../src/project/instance"
import { SessionCwd } from "../../src/tool/session-cwd"

const sessionID = SessionID.make("ses_test")
const ctx = {
  sessionID,
  messageID: MessageID.make("message"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

async function withTmpDir(fn: (dir: string) => Promise<void>) {
  const dir = path.join(os.tmpdir(), "deep-file-analysis-test-" + Math.random().toString(36).slice(2))
  await fs.mkdir(dir, { recursive: true })
  try {
    SessionCwd.set(sessionID, dir)
    await Instance.provide({ directory: dir, fn: () => fn(dir) })
  } finally {
    SessionCwd.clear(sessionID)
    await fs.rm(dir, { recursive: true, force: true })
  }
}

describe("deep-file-analysis", () => {
  test("analyzes TypeScript file structure", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "app.ts")
      await fs.writeFile(filePath, [
        'import { Router } from "express"',
        'import { UserService } from "./services/user"',
        "",
        'export function main() { return "hello" }',
        "",
        "export class App {",
        "  constructor() {}",
        "  start() {}",
        "}",
      ].join("\n"))

      const result = await DeepFileAnalysisTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, detailed: false, deep: true }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("TypeScript")
      expect(result.output).toContain("Functions/Methods")
      expect(result.output).toContain("Imports")
      expect(result.output).toContain("Code Metrics")
      expect(result.metadata.language).toBe("TypeScript")
    })
  })

  test("detects security issues", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "unsafe.ts")
      await fs.writeFile(filePath, 'const result = eval("code")\nconst x = exec("cmd")\n')

      const result = await DeepFileAnalysisTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, detailed: false, deep: true }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("Security Scan")
      expect(result.output).toContain("eval()")
      expect(result.metadata.securityFindings).toBeGreaterThan(0)
    })
  })

  test("detects TODO/FIXME comments", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "todo.ts")
      await fs.writeFile(filePath, [
        "// TODO: implement this",
        "// FIXME: broken",
        "const x = 1",
      ].join("\n"))

      const result = await DeepFileAnalysisTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, detailed: false, deep: true }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("TODO/FIXME/HACK Scan")
      expect(result.output).toContain("implement this")
      expect(result.metadata.todos).toBe(2)
    })
  })

  test("returns error for missing file", async () => {
    await withTmpDir(async (dir) => {
      const result = await DeepFileAnalysisTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: path.join(dir, "nonexistent.ts"), detailed: false, deep: true }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("File not found")
      expect(result.metadata.error).toBe(true)
    })
  })

  test("handles large file (over 1MB) with error", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "huge.ts")
      const content = "x".repeat(1024 * 1024 + 100)
      await fs.writeFile(filePath, content)

      const result = await DeepFileAnalysisTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, detailed: false, deep: true }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("File too large")
      expect(result.metadata.error).toBe(true)
    })
  })

  test("detects Python file structure", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "app.py")
      await fs.writeFile(filePath, [
        "import os",
        "import sys",
        "",
        "def main():",
        "    pass",
        "",
        "class Service:",
        "    def run(self):",
        "        pass",
      ].join("\n"))

      const result = await DeepFileAnalysisTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, detailed: false, deep: true }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("Python")
      expect(result.output).toContain("Functions/Methods")
      expect(result.metadata.language).toBe("Python")
    })
  })

  test("deep=false disables advanced analysis", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "simple.ts")
      await fs.writeFile(filePath, '// TODO: fix this\nconst x = 1\n')

      const result = await DeepFileAnalysisTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, detailed: false, deep: false }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).not.toContain("TODO/FIXME/HACK Scan")
    })
  })
})
