import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import DESCRIPTION from "./perf-profiler.txt"
import path from "path"

interface Finding {
  line: number
  severity: "high" | "medium" | "low"
  category: string
  message: string
  suggestion: string
}

function analyzeFile(content: string, filePath: string, focus: string): Finding[] {
  const findings: Finding[] = []
  const lines = content.split("\n")
  const isReact = filePath.endsWith(".tsx") || filePath.endsWith(".jsx")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    if (focus === "all" || focus === "async") {
      if (/\breadFileSync\b|\bwriteFileSync\b|\bexecSync\b|\bspawnSync\b/.test(line)) {
        findings.push({
          line: lineNum,
          severity: "high",
          category: "sync-io",
          message: "Synchronous I/O in code — blocks the event loop",
          suggestion: "Use async alternatives: readFile, writeFile, exec, spawn",
        })
      }
    }

    if (focus === "all" || focus === "memory") {
      if (/\baddEventListener\b/.test(line) && !/\bremoveEventListener\b/.test(content)) {
        findings.push({
          line: lineNum,
          severity: "medium",
          category: "memory-leak",
          message: "Event listener added without cleanup",
          suggestion: "Ensure removeEventListener is called in cleanup/destroy",
        })
      }

      if (/\bsetInterval\b/.test(line) && !/\bclearInterval\b/.test(content)) {
        findings.push({
          line: lineNum,
          severity: "medium",
          category: "memory-leak",
          message: "setInterval without clearInterval cleanup",
          suggestion: "Store interval ID and clear it on unmount/dispose",
        })
      }
    }

    if (focus === "all" || focus === "react") {
      if (isReact) {
        if (/style\s*=\s*\{\s*\{/.test(line)) {
          findings.push({
            line: lineNum,
            severity: "medium",
            category: "react-perf",
            message: "Inline style object creates new reference each render",
            suggestion: "Extract to a constant or use useMemo",
          })
        }

        if (/onClick\s*=\s*\{\s*\(\)\s*=>/.test(line) || /onChange\s*=\s*\{\s*\(\)\s*=>/.test(line)) {
          findings.push({
            line: lineNum,
            severity: "low",
            category: "react-perf",
            message: "Inline arrow function in event handler",
            suggestion: "Use useCallback to prevent child re-renders",
          })
        }
      }
    }

    if (focus === "all") {
      if (/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/.test(line)) {
        findings.push({
          line: lineNum,
          severity: "high",
          category: "error-handling",
          message: "Empty catch block — errors are silently swallowed",
          suggestion: "Log the error or re-throw it",
        })
      }

      if (/\beval\s*\(/.test(line)) {
        findings.push({
          line: lineNum,
          severity: "high",
          category: "security",
          message: "eval() usage — security risk and performance hit",
          suggestion: "Use JSON.parse, Function constructor, or specific parsing logic",
        })
      }

      if (/console\.(log|debug|info)\s*\(/.test(line) && !/test|spec|mock/.test(filePath)) {
        findings.push({
          line: lineNum,
          severity: "low",
          category: "debug",
          message: "Console logging in non-test code",
          suggestion: "Remove or use a proper logger",
        })
      }
    }
  }

  if (lines.length > 500) {
    findings.push({
      line: 1,
      severity: "medium",
      category: "file-size",
      message: `File is very large (${lines.length} lines)`,
      suggestion: "Consider splitting into smaller modules",
    })
  }

  findings.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })

  return findings
}

function findSourceFiles(dir: string): Effect.Effect<string[]> {
  return Effect.gen(function* () {
    const proc = yield* Effect.promise(async () => {
      const p = Bun.spawn(
        ["bash", "-c", `find "${dir}" -maxdepth 3 \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) ! -path "*/node_modules/*" ! -path "*/dist/*" | head -30`],
        { stdout: "pipe", stderr: "pipe" },
      )
      const stdout = await new Response(p.stdout).text()
      await p.exited
      return stdout
    })
    return proc.trim().split("\n").filter(Boolean)
  })
}

export const PerfProfilerTool = Tool.define(
  "perf-profiler",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        path: z.string().describe("File or directory to analyze"),
        focus: z
          .enum(["all", "memory", "async", "react"])
          .optional()
          .default("all")
          .describe("Analysis focus area"),
      }),
      execute: (params: { path: string; focus?: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const focus = params.focus || "all"

          const exists = yield* Effect.promise(() => Bun.file(params.path).exists())
          let files: string[] = []
          if (exists) {
            files = [params.path]
          } else {
            files = yield* findSourceFiles(params.path)
          }

          if (files.length === 0) {
            return {
              title: "Perf Profiler",
              metadata: { error: true } as any,
              output: `No source files found at: ${params.path}`,
            }
          }

          const allFindings: { file: string; findings: Finding[] }[] = []
          for (const file of files) {
            const content = yield* fs.readFileString(file)
            if (!content) continue
            const findings = analyzeFile(content, file, focus)
            if (findings.length > 0) {
              allFindings.push({ file, findings })
            }
          }

          if (allFindings.length === 0) {
            return {
              title: "Perf Profiler",
              metadata: { files: files.length, issues: 0 },
              output: `Analyzed ${files.length} files — no performance issues detected!`,
            }
          }

          const totalIssues = allFindings.reduce((sum, f) => sum + f.findings.length, 0)
          const highCount = allFindings.reduce(
            (sum, f) => sum + f.findings.filter((x) => x.severity === "high").length,
            0,
          )

          const output: string[] = [`# Performance Analysis`, "", `**Files analyzed:** ${files.length}`, `**Issues found:** ${totalIssues}`, ""]

          for (const { file, findings } of allFindings) {
            output.push(`## ${path.relative(process.cwd(), file)}`)
            for (const f of findings) {
              const icon = f.severity === "high" ? "🔴" : f.severity === "medium" ? "🟡" : "🟢"
              output.push(`${icon} **L${f.line}** [${f.category}] ${f.message}`)
              output.push(`  → ${f.suggestion}`)
            }
            output.push("")
          }

          return {
            title: `Perf: ${totalIssues} issues in ${allFindings.length} files`,
            metadata: {
              files: files.length,
              issues: totalIssues,
              high: highCount,
              focus,
            },
            output: output.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
