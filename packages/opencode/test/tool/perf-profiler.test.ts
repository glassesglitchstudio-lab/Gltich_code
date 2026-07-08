import { describe, expect, test, mock, afterEach } from "bun:test"
import * as fs from "fs/promises"
import os from "os"
import path from "path"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import { PerfProfilerTool } from "../../src/tool/perf-profiler"
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
  const dir = path.join(os.tmpdir(), "perf-profiler-test-" + Math.random().toString(36).slice(2))
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

describe("perf-profiler", () => {
  afterEach(() => {
    Bun.spawn = originalSpawn
  })

  test("detects synchronous I/O calls", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "sync.ts")
      await fs.writeFile(filePath, 'import { readFileSync } from "fs"\nconst data = readFileSync("file.txt")\n')
      mockSpawn({})

      const result = await PerfProfilerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, focus: "all" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("sync-io")
      expect(result.output).toContain("Synchronous I/O")
      expect(result.metadata.issues).toBeGreaterThan(0)
    })
  })

  test("detects eval() usage as security risk", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "unsafe.ts")
      await fs.writeFile(filePath, 'const result = eval("1 + 1")\n')
      mockSpawn({})

      const result = await PerfProfilerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, focus: "all" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("security")
      expect(result.output).toContain("eval()")
    })
  })

  test("detects empty catch blocks", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "error.ts")
      await fs.writeFile(filePath, 'try { doSomething() } catch (e) {}\n')
      mockSpawn({})

      const result = await PerfProfilerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, focus: "all" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("error-handling")
      expect(result.output).toContain("Empty catch block")
    })
  })

  test("returns no issues for clean code", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "clean.ts")
      await fs.writeFile(filePath, 'export function add(a: number, b: number) { return a + b }\n')
      mockSpawn({})

      const result = await PerfProfilerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, focus: "all" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("no performance issues")
      expect(result.metadata.issues).toBe(0)
    })
  })

  test("detects memory leak patterns", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "leak.ts")
      await fs.writeFile(filePath, 'setInterval(() => { console.log("tick") }, 1000)\n')
      mockSpawn({})

      const result = await PerfProfilerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, focus: "memory" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("memory-leak")
    })
  })

  test("detects React inline styles", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "component.tsx")
      await fs.writeFile(filePath, 'const App = () => <div style={{ color: "red" }}>Hello</div>\n')
      mockSpawn({})

      const result = await PerfProfilerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: filePath, focus: "react" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("react-perf")
      expect(result.output).toContain("Inline style")
    })
  })

  test("returns error for non-existent path", async () => {
    await withTmpDir(async (dir) => {
      mockSpawn({
        find: { stdout: "", stderr: "", code: 0 },
      })
      const result = await PerfProfilerTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: path.join(dir, "nonexistent"), focus: "all" as const }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("No source files found")
    })
  })
})
