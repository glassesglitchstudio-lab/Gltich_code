import { describe, expect, test, mock, afterEach } from "bun:test"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import { DbQueryTool } from "../../src/tool/db-query"
import { SessionID, MessageID } from "../../src/session/schema"
import { Instance } from "../../src/project/instance"

const projectRoot = require("path").join(import.meta.dir, "../..")

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

const originalSpawn = Bun.spawn
function mockSpawn(responses: { [cmd: string]: { stdout: string; stderr: string; code: number } }) {
  Bun.spawn = ((args: string[], opts?: any) => {
    const cmd = args.join(" ")
    const matchingKey = Object.keys(responses).find((key) => cmd.includes(key))
    const resp = matchingKey ? responses[matchingKey] : { stdout: "", stderr: "not found", code: 1 }
    return {
      stdout: new Response(resp.stdout),
      stderr: new Response(resp.stderr),
      exited: Promise.resolve(resp.code),
    }
  }) as any
}

function exec(args: { operation: "info" | "query" | "schema" | "tables"; db?: string; sql?: string }) {
  return Instance.provide({
    directory: projectRoot,
    fn: () =>
      DbQueryTool.pipe(
        Effect.flatMap((info) => info.init()),
        Effect.flatMap((tool) => tool.execute(args, ctx)),
        Effect.provide(Layer.mergeAll(Truncate.defaultLayer, Agent.defaultLayer, AppFileSystem.defaultLayer)),
        Effect.runPromise,
      ),
  })
}

describe("db-query", () => {
  afterEach(() => {
    Bun.spawn = originalSpawn
  })

  test("tables operation lists database tables", async () => {
    mockSpawn({
      "test -f": { stdout: "ok", stderr: "", code: 0 },
      ".tables": { stdout: "users  posts  comments", stderr: "", code: 0 },
    })
    const result = await exec({ operation: "tables" as const, db: "/tmp/test.db" })
    expect(result.output).toContain("users")
    expect(result.output).toContain("posts")
  })

  test("schema operation returns SQL schema", async () => {
    mockSpawn({
      "test -f": { stdout: "ok", stderr: "", code: 0 },
      ".schema": { stdout: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);", stderr: "", code: 0 },
    })
    const result = await exec({ operation: "schema" as const, db: "/tmp/test.db" })
    expect(result.output).toContain("Schema")
    expect(result.output).toContain("CREATE TABLE")
  })

  test("query operation requires sql parameter", async () => {
    mockSpawn({
      "test -f": { stdout: "ok", stderr: "", code: 0 },
    })
    const result = await exec({ operation: "query" as const, db: "/tmp/test.db" })
    expect(result.output).toContain("sql")
    expect(result.output).toContain("required")
  })

  test("returns error for missing database", async () => {
    mockSpawn({
      "test -f": { stdout: "", stderr: "", code: 1 },
    })
    const result = await exec({ operation: "tables" as const, db: "/tmp/nonexistent.db" })
    expect(result.output).toContain("not found")
    expect(result.metadata.error).toBe(true)
  })

  test("info operation returns database info", async () => {
    mockSpawn({
      "test -f": { stdout: "ok", stderr: "", code: 0 },
      "du -h": { stdout: "12M", stderr: "", code: 0 },
      "count": { stdout: "5", stderr: "", code: 0 },
      "page_count": { stdout: "3072", stderr: "", code: 0 },
      "page_size": { stdout: "4096", stderr: "", code: 0 },
    })
    const result = await exec({ operation: "info", db: "/tmp/test.db" })
    expect(result.output).toContain("Database Info")
  })
})
