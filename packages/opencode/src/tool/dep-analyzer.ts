import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import DESCRIPTION from "./dep-analyzer.txt"
import path from "path"

function exec(cmd: string, cwd?: string): Effect.Effect<{ stdout: string; stderr: string; code: number }> {
  return Effect.promise(async () => {
    const proc = Bun.spawn(["bash", "-c", cmd], { cwd, stdout: "pipe", stderr: "pipe" })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const code = await proc.exited
    return { stdout: stdout.trim(), stderr: stderr.trim(), code }
  })
}

interface PackageJson {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function parsePackageJson(content: string): PackageJson | null {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

function findUsedImports(dir: string): Effect.Effect<Set<string>> {
  return Effect.gen(function* () {
    const used = new Set<string>()
    const { stdout } = yield* exec(
      `grep -rh "from ['\"]" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" "${dir}" 2>/dev/null || true`,
    )
    for (const line of stdout.split("\n")) {
      const match = line.match(/from\s+['"]([^'"./][^'"]*)['"]/)
      if (match) {
        const pkg = match[1].startsWith("@") ? match[1].split("/").slice(0, 2).join("/") : match[1].split("/")[0]
        used.add(pkg)
      }
    }
    return used
  })
}

export const DepAnalyzerTool = Tool.define(
  "dep-analyzer",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        operation: z
          .enum(["audit", "outdated", "unused", "summary"])
          .describe("Analysis operation to perform"),
        fix: z.boolean().optional().default(false).describe("Attempt auto-fix for outdated packages"),
      }),
      execute: (params: { operation: string; fix?: boolean }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const cwd = process.cwd()
          const pkgPath = path.join(cwd, "package.json")
          const pkgContent = yield* fs.readFileString(pkgPath)
          if (!pkgContent) {
            return {
              title: "Dep Analyzer",
              metadata: { error: true } as Tool.Metadata,
              output: "No package.json found in current directory.",
            }
          }

          const pkg = parsePackageJson(pkgContent)
          if (!pkg) {
            return {
              title: "Dep Analyzer",
              metadata: { error: true } as Tool.Metadata,
              output: "Invalid package.json format.",
            }
          }

          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
          const depCount = Object.keys(pkg.dependencies || {}).length
          const devCount = Object.keys(pkg.devDependencies || {}).length

          if (params.operation === "summary") {
            const output: string[] = [
              `# Dependency Summary: ${pkg.name || "unknown"}`,
              "",
              `- **Version:** ${pkg.version || "unspecified"}`,
              `- **Dependencies:** ${depCount}`,
              `- **Dev Dependencies:** ${devCount}`,
              `- **Total:** ${depCount + devCount}`,
              "",
              "## Production Dependencies",
              ...Object.entries(pkg.dependencies || {}).map(([name, ver]) => `  - ${name}: ${ver}`),
              "",
              "## Dev Dependencies",
              ...Object.entries(pkg.devDependencies || {}).map(([name, ver]) => `  - ${name}: ${ver}`),
            ]
            if (pkg.peerDependencies && Object.keys(pkg.peerDependencies).length > 0) {
              output.push("", "## Peer Dependencies")
              output.push(...Object.entries(pkg.peerDependencies).map(([name, ver]) => `  - ${name}: ${ver}`))
            }
            return {
              title: `Dep Summary: ${pkg.name}`,
              metadata: { deps: depCount, devDeps: devCount, total: depCount + devCount },
              output: output.join("\n"),
            }
          }

          if (params.operation === "outdated") {
            const { stdout } = yield* exec("npm outdated --json 2>/dev/null || echo '{}'", cwd)
            let outdated: Record<string, { current: string; latest: string; wanted: string }> = {}
            try {
              outdated = JSON.parse(stdout || "{}")
            } catch {
              return {
                title: "Dep Outdated",
                metadata: { error: true } as Tool.Metadata,
                output: "Could not parse npm outdated output.",
              }
            }

            const entries = Object.entries(outdated)
            if (entries.length === 0) {
              return {
                title: "Dep Outdated",
                metadata: { outdated: 0 },
                output: "All dependencies are up to date!",
              }
            }

            const output: string[] = [`# Outdated Dependencies (${entries.length})`, ""]
            for (const [name, info] of entries) {
              output.push(`- **${name}**: ${info.current} → ${info.latest} (wanted: ${info.wanted})`)
            }

            if (params.fix) {
              output.push("", "## Auto-fixing...")
              const { stdout: fixOut, code: fixCode } = yield* exec("npm update 2>&1", cwd)
              output.push(fixCode === 0 ? "Update completed successfully." : `Update failed: ${fixOut}`)
            }

            return {
              title: `Outdated: ${entries.length} packages`,
              metadata: { outdated: entries.length },
              output: output.join("\n"),
            }
          }

          if (params.operation === "audit") {
            const { stdout } = yield* exec("npm audit --json 2>/dev/null || echo '{}'", cwd)
            let audit: { vulnerabilities?: Record<string, { severity: string; title: string }> } = {}
            try {
              audit = JSON.parse(stdout || "{}")
            } catch {
              return {
                title: "Dep Audit",
                metadata: { error: true } as Tool.Metadata,
                output: "Could not parse npm audit output.",
              }
            }

            const vulns = audit.vulnerabilities || {}
            const entries = Object.entries(vulns)
            if (entries.length === 0) {
              return {
                title: "Dep Audit",
                metadata: { vulnerabilities: 0 },
                output: "No known vulnerabilities found!",
              }
            }

            const bySeverity: Record<string, string[]> = {}
            for (const [name, info] of entries) {
              const sev = info.severity || "unknown"
              if (!bySeverity[sev]) bySeverity[sev] = []
              bySeverity[sev].push(`${name}: ${info.title}`)
            }

            const output: string[] = [`# Security Audit (${entries.length} vulnerabilities)`, ""]
            for (const [sev, pkgs] of Object.entries(bySeverity)) {
              const icon = sev === "critical" || sev === "high" ? "🔴" : sev === "moderate" ? "🟡" : "🟢"
              output.push(`## ${icon} ${sev.toUpperCase()} (${pkgs.length})`)
              for (const p of pkgs) output.push(`  - ${p}`)
              output.push("")
            }

            return {
              title: `Audit: ${entries.length} vulnerabilities`,
              metadata: { vulnerabilities: entries.length, critical: bySeverity["critical"]?.length || 0 },
              output: output.join("\n"),
            }
          }

          if (params.operation === "unused") {
            const used = yield* findUsedImports(cwd)
            const declared = new Set(Object.keys(allDeps))
            const unused: string[] = []
            for (const dep of declared) {
              if (!used.has(dep)) unused.push(dep)
            }

            if (unused.length === 0) {
              return {
                title: "Dep Unused",
                metadata: { unused: 0 },
                output: "All declared dependencies appear to be used!",
              }
            }

            const output: string[] = [`# Unused Dependencies (${unused.length})`, ""]
            for (const u of unused) {
              const isDev = pkg.devDependencies?.[u]
              output.push(`- \`${u}\` ${isDev ? "(devDependency)" : "(dependency)"}`)
            }
            output.push("", "Consider removing these from package.json to reduce install size.")

            return {
              title: `Unused: ${unused.length} dependencies`,
              metadata: { unused: unused.length },
              output: output.join("\n"),
            }
          }

          return {
            title: "Dep Analyzer",
            metadata: { error: true } as Tool.Metadata,
            output: `Unknown operation: ${params.operation}`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
