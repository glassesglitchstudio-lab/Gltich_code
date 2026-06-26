import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./api-tester.txt"

interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
}

function parseHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":")
    if (idx > 0) {
      headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
  }
  return headers
}

export const ApiTesterTool = Tool.define(
  "api-tester",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: z.object({
        url: z.string().describe("Request URL (e.g. https://api.example.com/users)"),
        method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]).optional().default("GET").describe("HTTP method"),
        headers: z.string().optional().describe("Headers as key:value pairs, one per line"),
        body: z.string().optional().describe("Request body (JSON string for POST/PUT)"),
        timeout: z.number().optional().default(10000).describe("Request timeout in ms"),
      }),
      execute: (
        params: { url: string; method?: string; headers?: string; body?: string; timeout?: number },
        ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const method = (params.method || "GET").toUpperCase()
          const headers: Record<string, string> = {
            "User-Agent": "GlitchCode-APITester/0.2.27",
            Accept: "application/json",
          }

          if (params.headers) {
            const custom = parseHeaders(params.headers)
            Object.assign(headers, custom)
          }

          if (params.body && method !== "GET" && method !== "HEAD") {
            try {
              JSON.parse(params.body)
              headers["Content-Type"] = "application/json"
            } catch {
              headers["Content-Type"] = "text/plain"
            }
          }

          const startTime = Date.now()
          let result: HttpResponse

          try {
            const init: RequestInit = {
              method,
              headers,
              signal: AbortSignal.timeout(params.timeout || 10000),
            }
            if (params.body && method !== "GET" && method !== "HEAD") {
              init.body = params.body
            }

            const response = yield* Effect.promise(() => fetch(params.url, init))
            const elapsed = Date.now() - startTime
            const body = yield* Effect.promise(() => response.text())

            const respHeaders: Record<string, string> = {}
            response.headers.forEach((v, k) => { respHeaders[k] = v })

            result = {
              status: response.status,
              statusText: response.statusText,
              headers: respHeaders,
              body,
              time: elapsed,
            }
          } catch (err: any) {
            const elapsed = Date.now() - startTime
            const output: string[] = [
              `# API Request Failed`,
              "",
              `**URL:** \`${params.url}\``,
              `**Method:** ${method}`,
              `**Time:** ${elapsed}ms`,
              "",
              `## Error`,
              `\`\`\``,
              err?.message || String(err),
              `\`\`\``,
            ]
            return {
              title: `API Error: ${method} ${new URL(params.url).hostname}`,
              metadata: { error: true } as any,
              output: output.join("\n"),
            }
          }

          const output: string[] = [
            `# API Response`,
            "",
            `**URL:** \`${params.url}\``,
            `**Method:** ${method}`,
            `**Status:** ${result.status} ${result.statusText}`,
            `**Time:** ${result.time}ms`,
            "",
            `## Response Headers`,
          ]

          for (const [k, v] of Object.entries(result.headers)) {
            output.push(`- **${k}:** ${v}`)
          }

          output.push("", "## Response Body")

          let prettyBody = result.body
          try {
            prettyBody = JSON.stringify(JSON.parse(result.body), null, 2)
          } catch { /* keep raw */ }

          const truncated = prettyBody.length > 3000 ? prettyBody.slice(0, 3000) + "\n... (truncated)" : prettyBody
          output.push(`\`\`\`json\n${truncated}\n\`\`\``)

          const statusIcon = result.status < 300 ? "✅" : result.status < 400 ? "🟡" : "🔴"

          return {
            title: `${statusIcon} ${result.status} ${method} ${new URL(params.url).hostname}`,
            metadata: {
              status: result.status,
              method,
              time: result.time,
              bodyLength: result.body.length,
            },
            output: output.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
