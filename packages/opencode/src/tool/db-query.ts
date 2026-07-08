import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./db-query.txt"

function execSqlite(dbPath: string, sql: string): Effect.Effect<{ stdout: string; stderr: string; code: number }> {
  return Effect.promise(async () => {
    const proc = Bun.spawn(
      ["bash", "-c", `sqlite3 "${dbPath}" "${sql.replace(/"/g, '\\"')}" 2>&1`],
      { stdout: "pipe", stderr: "pipe" },
    )
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const code = await proc.exited
    return { stdout: stdout.trim(), stderr: stderr.trim(), code }
  })
}

function execCmd(cmd: string): Effect.Effect<{ stdout: string; stderr: string; code: number }> {
  return Effect.promise(async () => {
    const proc = Bun.spawn(["bash", "-c", cmd], { stdout: "pipe", stderr: "pipe" })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const code = await proc.exited
    return { stdout: stdout.trim(), stderr: stderr.trim(), code }
  })
}

export const DbQueryTool = Tool.define(
  "db-query",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: z.object({
        operation: z.enum(["tables", "schema", "query", "info"]).describe("Database operation"),
        db: z.string().optional().describe("Path to SQLite database file"),
        sql: z.string().optional().describe("SQL query to execute (SELECT only)"),
      }),
      execute: (
        params: { operation: string; db?: string; sql?: string },
        ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const dbPath = params.db || "database.sqlite"

          const { code: exists } = yield* execCmd(`test -f "${dbPath}" && echo ok || echo no`)
          if (exists !== 0) {
            return {
              title: "DB Query",
              metadata: { error: true } as Tool.Metadata,
              output: `Database not found: ${dbPath}`,
            }
          }

          if (params.operation === "tables") {
            const { stdout, stderr, code } = yield* execSqlite(dbPath, ".tables")
            if (code !== 0) {
              return {
                title: "DB Tables",
                metadata: { error: true } as Tool.Metadata,
                output: `Error: ${stderr}`,
              }
            }
            const tables = stdout.split(/\s{2,}/).filter(Boolean)
            return {
              title: `Tables: ${tables.length}`,
              metadata: { tables: tables.length },
              output: [
                `# Database Tables: ${dbPath}`,
                "",
                ...tables.map((t) => `- \`${t}\``),
              ].join("\n"),
            }
          }

          if (params.operation === "schema") {
            const { stdout, stderr, code } = yield* execSqlite(dbPath, ".schema")
            if (code !== 0) {
              return {
                title: "DB Schema",
                metadata: { error: true } as Tool.Metadata,
                output: `Error: ${stderr}`,
              }
            }
            return {
              title: "Database Schema",
              metadata: {},
              output: [
                `# Schema: ${dbPath}`,
                "",
                "```sql",
                stdout,
                "```",
              ].join("\n"),
            }
          }

          if (params.operation === "info") {
            const { stdout: sizeOut } = yield* execCmd(`du -h "${dbPath}" | cut -f1`)
            const { stdout: tablesOut } = yield* execSqlite(dbPath, "SELECT count(*) FROM sqlite_master WHERE type='table'")
            const { stdout: pagesOut } = yield* execSqlite(dbPath, "PRAGMA page_count")
            const { stdout: pageSizeOut } = yield* execSqlite(dbPath, "PRAGMA page_size")

            return {
              title: "Database Info",
              metadata: {},
              output: [
                `# Database Info: ${dbPath}`,
                "",
                `- **Size:** ${sizeOut || "unknown"}`,
                `- **Tables:** ${tablesOut || "?"}`,
                `- **Pages:** ${pagesOut || "?"}`,
                `- **Page Size:** ${pageSizeOut || "?"} bytes`,
              ].join("\n"),
            }
          }

          if (params.operation === "query") {
            if (!params.sql) {
              return {
                title: "DB Query",
                metadata: { error: true } as Tool.Metadata,
                output: "Error: 'sql' parameter is required for query operation.",
              }
            }

            const normalizedSql = params.sql.trim().toUpperCase()
            const forbidden = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "TRUNCATE"]
            const isWrite = forbidden.some((kw) => normalizedSql.startsWith(kw))

            if (isWrite) {
              yield* ctx.ask({
                permission: "db-write",
                patterns: [params.sql],
                always: [dbPath],
                metadata: { sql: params.sql },
              })
            }

            const { stdout, stderr, code } = yield* execSqlite(dbPath, params.sql)
            if (code !== 0) {
              return {
                title: "DB Query",
                metadata: { error: true } as Tool.Metadata,
                output: `Query error: ${stderr}`,
              }
            }

            const lines = stdout.split("\n")
            const truncated = lines.length > 100 ? lines.slice(0, 100).join("\n") + `\n... (${lines.length - 100} more rows)` : stdout

            return {
              title: "Query Result",
              metadata: { rows: lines.length },
              output: [
                `# Query Result`,
                "",
                "```sql",
                params.sql,
                "```",
                "",
                `\`${lines.length} rows\``,
                "",
                "```",
                truncated,
                "```",
              ].join("\n"),
            }
          }

          return {
            title: "DB Query",
            metadata: { error: true } as Tool.Metadata,
            output: `Unknown operation: ${params.operation}`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
