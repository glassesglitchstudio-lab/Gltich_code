import { describe, expect, test } from "bun:test"
import * as fs from "fs/promises"
import os from "os"
import path from "path"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import { CodeMigrationTool } from "../../src/tool/code-migration"
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
  const dir = path.join(os.tmpdir(), "code-migration-test-" + Math.random().toString(36).slice(2))
  await fs.mkdir(dir, { recursive: true })
  try {
    await Instance.provide({ directory: dir, fn: () => fn(dir) })
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

function exec(dir: string, args: { path: string; target: "async" | "auto" | "const" | "react-functional" | "typescript"; write: boolean }) {
  return Instance.provide({
    directory: dir,
    fn: () =>
      CodeMigrationTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute(args, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      ),
  })
}

describe("code-migration", () => {
  test("detects no changes needed for modern code", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "modern.ts")
      await fs.writeFile(filePath, 'const x = "hello"\nfunction foo(a: string): void {}\n')
      const result = await exec(dir, { path: filePath, target: "auto" as const, write: false })
      expect(result.output).toContain("already modern")
      expect(result.metadata.changes).toBe(0)
    })
  })

  test("migrates var to const", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "legacy.js")
      await fs.writeFile(filePath, 'var x = 1\nvar y = 2\n')
      const result = await exec(dir, { path: filePath, target: "const" as const, write: false })
      expect(result.metadata.changes).toBeGreaterThan(0)
      expect(result.output).toContain("var→const")
    })
  })

  test("migrates var to let when reassigned", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "reassign.js")
      await fs.writeFile(filePath, 'var x = 1\nx = 2\n')
      const result = await exec(dir, { path: filePath, target: "const" as const, write: false })
      expect(result.output).toContain("Migration")
    })
  })

  test("writes migrated code when write=true", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "towrite.js")
      await fs.writeFile(filePath, 'var x = 1\n')
      await exec(dir, { path: filePath, target: "const" as const, write: true })
      const content = await fs.readFile(filePath, "utf-8")
      expect(content).toContain("const x")
      expect(content).not.toContain("var x")
    })
  })

  test("returns error for missing file", async () => {
    await withTmpDir(async (dir) => {
      const result = await exec(dir, { path: path.join(dir, "nonexistent.js"), target: "auto" as const, write: false })
      expect(result.output).toContain("Could not read file")
    })
  })

  test("auto mode applies multiple migrations", async () => {
    await withTmpDir(async (dir) => {
      const filePath = path.join(dir, "auto.js")
      await fs.writeFile(filePath, 'var x = 1\nvar y = 2\n')
      const result = await exec(dir, { path: filePath, target: "auto" as const, write: false })
      expect(result.metadata.changes).toBeGreaterThan(0)
    })
  })
})
