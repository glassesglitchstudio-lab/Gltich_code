import { describe, expect, test, mock, afterEach } from "bun:test"
import * as fs from "fs/promises"
import os from "os"
import path from "path"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import { ApiDocGenTool } from "../../src/tool/api-doc-gen"
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
  const dir = path.join(os.tmpdir(), "api-doc-gen-test-" + Math.random().toString(36).slice(2))
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

describe("api-doc-gen", () => {
  afterEach(() => {
    Bun.spawn = originalSpawn
  })

  test("extracts Express routes", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "routes.ts")
      await fs.writeFile(filePath, [
        'app.get("/users", handler)',
        'app.post("/users", handler)',
        'app.get("/users/:id", handler)',
        'app.delete("/users/:id", handler)',
      ].join("\n"))
      mockSpawn({ find: { stdout: filePath, stderr: "", code: 0 } })

      const result = await ApiDocGenTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, title: "API" }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("4 routes")
      expect(result.output).toContain("GET")
      expect(result.output).toContain("POST")
      expect(result.output).toContain("DELETE")
      expect(result.metadata.routes).toBe(4)
    })
  })

  test("extracts NestJS decorator routes", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "controller.ts")
      await fs.writeFile(filePath, [
        '@Get("/items")',
        '@Post("/items")',
        '@Put("/items/:id")',
      ].join("\n"))
      mockSpawn({ find: { stdout: filePath, stderr: "", code: 0 } })

      const result = await ApiDocGenTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, title: "API" }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("3 routes")
      expect(result.metadata.routes).toBe(3)
    })
  })

  test("generates OpenAPI spec when output is specified", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "api.ts")
      await fs.writeFile(filePath, 'app.get("/hello", handler)\n')
      const outputPath = path.join(dir, "openapi.json")
      mockSpawn({ find: { stdout: filePath, stderr: "", code: 0 } })

      const result = await ApiDocGenTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, title: "API", output: outputPath }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("OpenAPI spec written")
      expect(result.metadata.written).toBe(true)

      const spec = JSON.parse(await fs.readFile(outputPath, "utf-8"))
      expect(spec.openapi).toBe("3.0.0")
      expect(spec.paths["/hello"]).toBeDefined()
    })
  })

  test("returns error when no files found", async () => {
    await withTmpDir(async (dir) => {
      mockSpawn({ find: { stdout: "", stderr: "", code: 1 } })

      const result = await ApiDocGenTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, title: "API" }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("No source files found")
      expect(result.metadata.error).toBe(true)
    })
  })

  test("returns message when no routes found", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "no-routes.ts")
      await fs.writeFile(filePath, 'export const x = 1\n')
      mockSpawn({ find: { stdout: filePath, stderr: "", code: 0 } })

      const result = await ApiDocGenTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, title: "API" }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("No API routes found")
      expect(result.metadata.routes).toBe(0)
    })
  })

  test("extracts route parameters", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "param-routes.ts")
      await fs.writeFile(filePath, 'app.get("/users/:userId/posts/:postId", handler)\n')
      mockSpawn({ find: { stdout: filePath, stderr: "", code: 0 } })

      const result = await ApiDocGenTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, title: "API" }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("1 routes")
    })
  })

  test("uses custom title in output", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "api.ts")
      await fs.writeFile(filePath, 'app.get("/test", handler)\n')
      const outputPath = path.join(dir, "openapi.json")
      mockSpawn({ find: { stdout: filePath, stderr: "", code: 0 } })

      await ApiDocGenTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ path: dir, title: "My API", output: outputPath }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      )

      const spec = JSON.parse(await fs.readFile(outputPath, "utf-8"))
      expect(spec.info.title).toBe("My API")
    })
  })
})
