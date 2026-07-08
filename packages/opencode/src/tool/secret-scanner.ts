import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import DESCRIPTION from "./secret-scanner.txt"
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

interface SecretMatch {
  file: string
  line: number
  severity: "critical" | "high" | "medium" | "low"
  type: string
  preview: string
}

const SECRET_PATTERNS: { pattern: RegExp; type: string; severity: SecretMatch["severity"] }[] = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([A-Za-z0-9_\-]{20,})['"]/gi, type: "API Key", severity: "critical" },
  { pattern: /(?:secret|secret[_-]?key)\s*[:=]\s*['"]([A-Za-z0-9_\-]{16,})['"]/gi, type: "Secret Key", severity: "critical" },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"]/gi, type: "Password", severity: "critical" },
  { pattern: /(?:token|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]([A-Za-z0-9_\-\.]{20,})['"]/gi, type: "Token", severity: "high" },
  { pattern: /(?:AWS|aws)[_-]?(?:ACCESS|SECRET)[_-]?(?:KEY|ID)\s*[:=]\s*['"]([A-Z0-9]{16,})['"]/gi, type: "AWS Key", severity: "critical" },
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, type: "Private Key", severity: "critical" },
  { pattern: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}/g, type: "Stripe Key", severity: "critical" },
  { pattern: /ghp_[A-Za-z0-9]{36}/g, type: "GitHub Token", severity: "critical" },
  { pattern: /glpat-[A-Za-z0-9\-_]{20,}/g, type: "GitLab Token", severity: "critical" },
  { pattern: /xox[baprs]-[A-Za-z0-9\-]+/g, type: "Slack Token", severity: "critical" },
  { pattern: /(?:mysql|postgres|mongodb|redis):\/\/[^'"]+/gi, type: "Connection String", severity: "high" },
  { pattern: /(?:mongodb(\+srv)?:\/\/)[^'"]+/gi, type: "MongoDB URI", severity: "high" },
  { pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, type: "AWS Access Key ID", severity: "critical" },
  { pattern: /['"][A-Za-z0-9/+=]{40}['"]/, type: "Possible Base64 Secret", severity: "medium" },
  { pattern: /(?:firebase|firestore)[^'"]*key[^'"]*['"][^'"]+['"]/gi, type: "Firebase Key", severity: "high" },
]

function scanLine(line: string, lineNum: number, filePath: string): SecretMatch[] {
  const matches: SecretMatch[] = []
  for (const { pattern, type, severity } of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let m: RegExpExecArray | null
    while ((m = regex.exec(line)) !== null) {
      const preview = line.trim().slice(0, 80)
      matches.push({ file: filePath, line: lineNum, severity, type, preview })
    }
  }
  return matches
}

async function getGitignorePatterns(cwd: string): Promise<string[]> {
  const proc = Bun.spawn(["bash", "-c", `cat "${cwd}/.gitignore" 2>/dev/null || echo ""`], { stdout: "pipe", stderr: "pipe" })
  const content = await new Response(proc.stdout).text()
  return content.split("\n").map((l) => l.trim()).filter(Boolean)
}

function isInGitignore(filePath: string, patterns: string[]): boolean {
  const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, "/")
  for (const p of patterns) {
    const clean = p.replace(/^\!/, "").replace(/\/$/, "")
    if (relPath.startsWith(clean) || relPath.includes(clean) || relPath.match(new RegExp(clean.replace(/\*/g, ".*")))) {
      return !p.startsWith("!")
    }
  }
  return false
}

export const SecretScannerTool = Tool.define(
  "secret-scanner",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        path: z.string().optional().describe("Directory or file to scan (defaults to current directory)"),
        severity: z.enum(["all", "critical", "high", "medium", "low"]).optional().default("all").describe("Minimum severity to report"),
        fix_gitignore: z.boolean().optional().default(false).describe("Suggest .gitignore entries for exposed files"),
      }),
      execute: (
        params: { path?: string; severity?: string; fix_gitignore?: boolean },
        ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const scanPath = params.path || process.cwd()
          const minSeverity = params.severity || "all"
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }

          const { stdout, code } = yield* exec(
            `find "${scanPath}" -maxdepth 5 \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.env*" -o -name "*.yaml" -o -name "*.yml" -o -name "*.toml" -o -name "*.conf" \\) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" | head -100`,
          )

          if (code !== 0 || !stdout) {
            return {
              title: "Secret Scanner",
              metadata: { error: true } as Tool.Metadata,
              output: `No files found at: ${scanPath}`,
            }
          }

          const files = stdout.split("\n").filter(Boolean)
          const allMatches: SecretMatch[] = []

          for (const file of files) {
            const content = yield* fs.readFileString(file)
            if (!content) continue
            const lines = content.split("\n")
            for (let i = 0; i < lines.length; i++) {
              const matches = scanLine(lines[i], i + 1, file)
              allMatches.push(...matches)
            }
          }

          const filtered = minSeverity === "all"
            ? allMatches
            : allMatches.filter((m) => severityOrder[m.severity] <= severityOrder[minSeverity as keyof typeof severityOrder])

          if (filtered.length === 0) {
            return {
              title: "Secret Scanner",
              metadata: { files: files.length, secrets: 0 },
              output: `Scanned ${files.length} files — no secrets detected!`,
            }
          }

          const bySeverity: Record<string, SecretMatch[]> = {}
          for (const m of filtered) {
            if (!bySeverity[m.severity]) bySeverity[m.severity] = []
            bySeverity[m.severity].push(m)
          }

          const gitignorePatterns = yield* Effect.promise(() => getGitignorePatterns(process.cwd()))
          const exposed = filtered.filter((m) => !isInGitignore(m.file, gitignorePatterns))

          const output: string[] = [
            `# Secret Scan Results`,
            "",
            `**Files scanned:** ${files.length}`,
            `**Secrets found:** ${filtered.length}`,
            `**Exposed (not in .gitignore):** ${exposed.length}`,
            "",
          ]

          for (const [sev, matches] of Object.entries(bySeverity)) {
            const icon = sev === "critical" ? "🔴" : sev === "high" ? "🟠" : sev === "medium" ? "🟡" : "🟢"
            output.push(`## ${icon} ${sev.toUpperCase()} (${matches.length})`)
            for (const m of matches.slice(0, 5)) {
              output.push(`  - \`${path.relative(process.cwd(), m.file)}:${m.line}\` — ${m.type}`)
              output.push(`    \`${m.preview}\``)
            }
            if (matches.length > 5) output.push(`  ... and ${matches.length - 5} more`)
            output.push("")
          }

          if (params.fix_gitignore && exposed.length > 0) {
            output.push("## Suggested .gitignore additions")
            const patterns = new Set(exposed.map((m) => {
              const rel = path.relative(process.cwd(), m.file).replace(/\\/g, "/")
              return rel.split("/")[0] === ".env" ? ".env*" : rel.split("/").slice(0, 2).join("/")
            }))
            for (const p of patterns) output.push(`  ${p}`)
          }

          return {
            title: `Secret Scan: ${filtered.length} secrets in ${files.length} files`,
            metadata: {
              files: files.length,
              secrets: filtered.length,
              critical: bySeverity["critical"]?.length || 0,
              exposed: exposed.length,
            },
            output: output.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
