import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import DESCRIPTION from "./api-doc-gen.txt"
import path from "path"

interface ApiRoute {
  method: string
  path: string
  params: string[]
  description: string
  file: string
  line: number
}

function extractRoutes(content: string, filePath: string): ApiRoute[] {
  const routes: ApiRoute[] = []
  const lines = content.split("\n")

  const patterns = [
    { regex: /\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/gi, framework: "express" },
    { regex: /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi, framework: "express" },
    { regex: /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi, framework: "express" },
    { regex: /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi, framework: "nest" },
    { regex: /\.(route|api)\s*\(\s*['"`]([^'"`]+)['"`]/gi, framework: "generic" },
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const { regex } of patterns) {
      const r = new RegExp(regex.source, regex.flags)
      let m: RegExpExecArray | null
      while ((m = r.exec(line)) !== null) {
        const method = m[1].toUpperCase()
        const routePath = m[2]
        const params = (routePath.match(/:(\w+)/g) || []).map((p) => p.slice(1))
        const descMatch = line.match(/\/\/\s*(.+)/)
        routes.push({
          method,
          path: routePath,
          params,
          description: descMatch?.[1]?.trim() || "",
          file: filePath,
          line: i + 1,
        })
      }
    }
  }

  return routes
}

function generateOpenApiSpec(
  routes: ApiRoute[],
  title: string,
): Record<string, unknown> {
  const paths: Record<string, unknown> = {}

  for (const route of routes) {
    if (!paths[route.path]) paths[route.path] = {}
    const operation: Record<string, unknown> = {
      summary: route.description || `${route.method} ${route.path}`,
      parameters: route.params.map((p) => ({
        name: p,
        in: "path",
        required: true,
        schema: { type: "string" },
      })),
      responses: {
        "200": { description: "Success" },
        "400": { description: "Bad Request" },
        "404": { description: "Not Found" },
        "500": { description: "Internal Server Error" },
      },
    }
    const existing = (paths[route.path] || {}) as Record<string, unknown>
    paths[route.path] = {
      ...existing,
      [route.method.toLowerCase()]: operation,
    }
  }

  return {
    openapi: "3.0.0",
    info: {
      title,
      version: "1.0.0",
      description: `Auto-generated API documentation from ${routes.length} routes`,
    },
    paths,
  }
}

export const ApiDocGenTool = Tool.define(
  "api-doc-gen",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        path: z.string().describe("Directory or file to scan for API routes"),
        title: z.string().optional().default("API Documentation").describe("API title for OpenAPI spec"),
        output: z.string().optional().describe("Output file path for OpenAPI JSON"),
      }),
      execute: (
        params: { path: string; title?: string; output?: string },
        ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const { stdout, code } = yield* Effect.promise(async () => {
            const proc = Bun.spawn(
              ["bash", "-c", `find "${params.path}" -maxdepth 5 \\( -name "*.ts" -o -name "*.js" \\) ! -path "*/node_modules/*" ! -path "*/dist/*" | head -50`],
              { stdout: "pipe", stderr: "pipe" },
            )
            const stdout = await new Response(proc.stdout).text()
            const c = await proc.exited
            return { stdout: stdout.trim(), code: c }
          })

          if (code !== 0 || !stdout) {
            return {
              title: "API Doc Generator",
              metadata: { error: true } as Tool.Metadata,
              output: `No source files found at: ${params.path}`,
            }
          }

          const files = stdout.split("\n").filter(Boolean)
          const allRoutes: ApiRoute[] = []

          for (const file of files) {
            const content = yield* fs.readFileString(file)
            if (!content) continue
            const routes = extractRoutes(content, file)
            allRoutes.push(...routes)
          }

          if (allRoutes.length === 0) {
            return {
              title: "API Doc Generator",
              metadata: { routes: 0 },
              output: `No API routes found in ${files.length} files. Checked for Express/Fastify/Hono patterns.`,
            }
          }

          const spec = generateOpenApiSpec(allRoutes, params.title || "API Documentation")
          const specJson = JSON.stringify(spec, null, 2)

          if (params.output) {
            yield* fs.writeWithDirs(params.output, specJson)
          }

          const byMethod: Record<string, number> = {}
          for (const r of allRoutes) {
            byMethod[r.method] = (byMethod[r.method] || 0) + 1
          }

          const output: string[] = [
            `# API Documentation Generated`,
            "",
            `**Files scanned:** ${files.length}`,
            `**Routes found:** ${allRoutes.length}`,
            "",
            "## Routes by Method",
            ...Object.entries(byMethod).map(([m, c]) => `- **${m}:** ${c}`),
            "",
            "## All Routes",
            ...allRoutes.map((r) => `- \`${r.method} ${r.path}\` — ${r.file}:${r.line}`),
          ]

          if (params.output) {
            output.push("", `OpenAPI spec written to: \`${params.output}\``)
          }

          return {
            title: `API Docs: ${allRoutes.length} routes`,
            metadata: {
              routes: allRoutes.length,
              methods: byMethod,
              written: !!params.output,
            },
            output: output.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
