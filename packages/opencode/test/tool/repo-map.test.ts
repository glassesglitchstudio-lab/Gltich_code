import { describe, expect, test } from "bun:test"
import * as fs from "fs/promises"
import os from "os"
import path from "path"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool"
import { RepoMapTool } from "../../src/tool/repo-map"
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
  const dir = path.join(os.tmpdir(), "repo-map-test-" + Math.random().toString(36).slice(2))
  await fs.mkdir(dir, { recursive: true })
  try {
    await Instance.provide({ directory: dir, fn: () => fn(dir) })
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

describe("repo-map", () => {
  test("build operation creates index", async () => {
    await withTmpDir(async (dir) => {
      await fs.writeFile(path.join(dir, "index.ts"), 'export function main() { return "hello" }\n')
      await fs.writeFile(path.join(dir, "utils.ts"), 'export const add = (a: number, b: number) => a + b\n')

      const result = await RepoMapTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "build" as const, root: dir, depth: 2 }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("Index")
      expect(result.output).toContain("dosya")
    })
  })

  test("summary operation returns stats", async () => {
    await withTmpDir(async (dir) => {
      await fs.writeFile(path.join(dir, "main.ts"), 'export const x = 1\n')

      const result = await RepoMapTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "summary" as const, root: dir, depth: 2 }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toBeDefined()
    })
  })

  test("query requires target parameter", async () => {
    await withTmpDir(async (dir) => {
      const result = await RepoMapTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "query" as const, root: dir, depth: 2 }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("target gerekli")
    })
  })

  test("query returns file info when target exists", async () => {
    await withTmpDir(async (dir) => {
      await fs.writeFile(path.join(dir, "helper.ts"), 'export function help() {}\n')

      const result = await RepoMapTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "query" as const, target: "helper.ts", root: dir, depth: 2 }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("TypeScript")
      expect(result.output).toContain("help")
    })
  })

  test("dependents requires target parameter", async () => {
    await withTmpDir(async (dir) => {
      const result = await RepoMapTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "dependents" as const, root: dir, depth: 2 }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("target gerekli")
    })
  })

  test("dependencies requires target parameter", async () => {
    await withTmpDir(async (dir) => {
      const result = await RepoMapTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "dependencies" as const, root: dir, depth: 2 }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("target gerekli")
    })
  })

  test("impact requires target parameter", async () => {
    await withTmpDir(async (dir) => {
      const result = await RepoMapTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "impact" as const, root: dir, depth: 2 }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("target gerekli")
    })
  })

  test("routes operation returns route list", async () => {
    await withTmpDir(async (dir) => {
      await fs.writeFile(path.join(dir, "app.ts"), 'export function main() {}\n')
      const result = await RepoMapTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "routes" as const, root: dir, depth: 2 }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("route")
    })
  })

  test("search requires target parameter", async () => {
    await withTmpDir(async (dir) => {
      const result = await RepoMapTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute({ operation: "search" as const, root: dir, depth: 2 }, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer)),
        Effect.runPromise,
      )
      expect(result.output).toContain("target gerekli")
    })
  })
})
