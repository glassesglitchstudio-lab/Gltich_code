import path from "path"
import z from "zod"
import { Effect } from "effect"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import { assertExternalDirectoryEffect } from "./external-directory"
import { SessionCwd } from "./session-cwd"
import DESCRIPTION from "./deep-file-analysis.txt"
import * as Tool from "./tool"

const MAX_FILE_SIZE = 1024 * 1024

const ANALYSIS_EXTENSIONS: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript React",
  ".js": "JavaScript",
  ".jsx": "JavaScript React",
  ".py": "Python",
  ".rs": "Rust",
  ".go": "Go",
  ".java": "Java",
  ".rb": "Ruby",
  ".php": "PHP",
  ".c": "C",
  ".cpp": "C++",
  ".h": "C/C++ Header",
  ".hpp": "C++ Header",
  ".cs": "C#",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".scala": "Scala",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".astro": "Astro",
  ".css": "CSS",
  ".scss": "SCSS",
  ".less": "Less",
  ".html": "HTML",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".md": "Markdown",
  ".toml": "TOML",
  ".sql": "SQL",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".dockerfile": "Dockerfile",
  ".proto": "Protocol Buffers",
  ".graphql": "GraphQL",
  ".prisma": "Prisma",
}

const IMPORT_PATTERNS: Record<string, RegExp[]> = {
  TypeScript: [/import\s+.*\s+from\s+['"]([^'"]+)['"]/g, /require\(['"]([^'"]+)['"]\)/g],
  JavaScript: [/import\s+.*\s+from\s+['"]([^'"]+)['"]/g, /require\(['"]([^'"]+)['"]\)/g],
  Python: [/^import\s+(\w+)/gm, /^from\s+(\w+)\s+import/gm],
  Rust: [/^use\s+([\w:]+)/gm],
  Go: [/^import\s+[""]([^""]+)[""]/gm, /^import\s+\(([^)]+)\)/gms],
  Java: [/^import\s+([\w.]+);/gm],
}

const COMPLEXITY_PATTERNS: Record<string, RegExp[]> = {
  TypeScript: [/\bif\s*\(/g, /\belse\s+if\b/g, /\bswitch\s*\(/g, /\bfor\s*\(/g, /\bwhile\s*\(/g, /\bcatch\s*\(/g, /\bcase\s+/g, /\b\?\s*[\w.]+:/g, /\|\|/g, /&&/g],
  JavaScript: [/\bif\s*\(/g, /\belse\s+if\b/g, /\bswitch\s*\(/g, /\bfor\s*\(/g, /\bwhile\s*\(/g, /\bcatch\s*\(/g, /\bcase\s+/g, /\b\?\s*[\w.]+:/g, /\|\|/g, /&&/g],
  Python: [/\bif\s+/g, /\belif\s+/g, /\bfor\s+/g, /\bwhile\s+/g, /\bexcept\s+/g, /\bcase\s+/g],
  Rust: [/\bif\s+/g, /\belse\s+if\b/g, /\bmatch\s+/g, /\bfor\s+/g, /\bwhile\s+/g, /\bcatch\s+/g],
  Go: [/\bif\s+/g, /\belse\s+if\b/g, /\bswitch\s+/g, /\bfor\s+/g, /\brange\s+/g],
}

const SECURITY_PATTERNS: { pattern: RegExp; severity: string; description: string }[] = [
  { pattern: /eval\s*\(/g, severity: "high", description: "eval() usage can lead to code injection" },
  { pattern: /exec\s*\(/g, severity: "high", description: "exec() can execute arbitrary commands" },
  { pattern: /innerHTML\s*=/g, severity: "medium", description: "innerHTML assignment may cause XSS" },
  { pattern: /dangerouslySetInnerHTML/g, severity: "medium", description: "dangerouslySetInnerHTML bypasses React XSS protection" },
  { pattern: /process\.env/g, severity: "low", description: "Environment variable access - ensure no secrets exposed" },
  { pattern: /sqlite3\.exec\s*\(/g, severity: "medium", description: "Direct SQL execution without parameterization" },
  { pattern: /\.exec\s*\(/g, severity: "medium", description: "Command execution via exec()" },
  { pattern: /child_process/g, severity: "medium", description: "Child process spawning" },
  { pattern: /('|")?password('|")?\s*[:=]/gi, severity: "high", description: "Password field detected - sensitive data" },
  { pattern: /('|")?token('|")?\s*[:=]/gi, severity: "high", description: "Token field detected - sensitive data" },
  { pattern: /('|")?api[_-]?key('|")?\s*[:=]/gi, severity: "high", description: "API key field detected - sensitive data" },
  { pattern: /('|")?secret('|")?\s*[:=]/gi, severity: "high", description: "Secret field detected - sensitive data" },
  { pattern: /('|")?private[_-]?key('|")?\s*[:=]/gi, severity: "high", description: "Private key field detected" },
  { pattern: /localStorage\.setItem/g, severity: "low", description: "LocalStorage usage - ensure no sensitive data stored" },
  { pattern: /document\.cookie/g, severity: "medium", description: "Cookie access - ensure secure flags" },
]

function detectLanguage(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase()
  return ANALYSIS_EXTENSIONS[ext] ?? null
}

function countLines(content: string): number {
  return content.split("\n").length
}

function countComments(content: string, lang: string): number {
  const lines = content.split("\n")
  let commentLines = 0
  let inBlock = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (inBlock) {
      commentLines++
      if (trimmed.includes("*/") || trimmed.includes("'''") || trimmed.includes('"""')) {
        inBlock = false
      }
      continue
    }
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("--")) {
      commentLines++
      continue
    }
    if (trimmed.startsWith("/*") || trimmed.startsWith("/**")) {
      commentLines++
      if (trimmed.includes("*/") && !trimmed.startsWith("/*", trimmed.length - 2)) {
        continue
      }
      if (!trimmed.includes("*/")) {
        inBlock = true
      }
      continue
    }
    if (lang === "Python") {
      if (trimmed.startsWith("'''") || trimmed.startsWith('"""')) {
        commentLines++
        if (!trimmed.endsWith("'''") && !trimmed.endsWith('"""')) {
          inBlock = true
        }
      }
    }
  }

  return commentLines
}

function analyzePattern(content: string, patterns: RegExp[]): number {
  let count = 0
  for (const pattern of patterns) {
    const matches = content.match(pattern)
    if (matches) count += matches.length
  }
  return count
}

function extractFunctions(content: string, lang: string): { name: string; line: number }[] {
  const functions: { name: string; line: number }[] = []
  const lines = content.split("\n")

  const patterns: Record<string, RegExp> = {
    TypeScript: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    JavaScript: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    Python: /^def\s+(\w+)\s*\(/,
    Rust: /^fn\s+(\w+)/,
    Go: /^func\s+(\w+)/,
    Java: /(?:public|private|protected)?\s+\w+\s+(\w+)\s*\(/,
  }

  const funcPattern = patterns[lang]
  if (!funcPattern) return functions

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(funcPattern)
    if (match) {
      functions.push({ name: match[1], line: i + 1 })
    }
  }

  return functions
}

function extractFunctionsWithBody(content: string, lang: string): { name: string; line: number; endLine: number; length: number }[] {
  const lines = content.split("\n")
  const funcs = extractFunctions(content, lang)
  return funcs.map((fn) => {
    let endLine = lines.length
    let braceDepth = 0
    let started = false
    for (let i = fn.line; i < lines.length; i++) {
      const line = lines[i]
      for (const ch of line) {
        if (ch === "{" || ch === "(") { braceDepth++; started = true }
        if (ch === "}" || ch === ")") { braceDepth-- }
      }
      if (started && braceDepth <= 0 && i > fn.line) {
        endLine = i + 1
        break
      }
    }
    return { ...fn, endLine, length: endLine - fn.line + 1 }
  })
}

function extractClasses(content: string, lang: string): { name: string; line: number }[] {
  const classes: { name: string; line: number }[] = []
  const lines = content.split("\n")

  const patterns: Record<string, RegExp> = {
    TypeScript: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
    JavaScript: /^(?:export\s+)?class\s+(\w+)/,
    Python: /^class\s+(\w+)/,
    Rust: /^(?:pub\s+)?(?:struct|enum|trait|impl)\s+(\w+)/,
    Go: /^type\s+(\w+)\s+(?:struct|interface)/,
    Java: /(?:public|private|protected)?\s*(?:abstract\s+)?class\s+(\w+)/,
  }

  const classPattern = patterns[lang]
  if (!classPattern) return classes

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(classPattern)
    if (match) {
      classes.push({ name: match[1], line: i + 1 })
    }
  }

  return classes
}

function extractImports(content: string, lang: string): { source: string; line: number }[] {
  const imports: { source: string; line: number }[] = []
  const patterns = IMPORT_PATTERNS[lang]
  if (!patterns) return imports

  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length
      imports.push({ source: match[1], line: lineNum })
    }
  }

  return imports
}

function analyzeSecurity(content: string): { severity: string; description: string; line: number }[] {
  const findings: { severity: string; description: string; line: number }[] = []

  for (const { pattern, severity, description } of SECURITY_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length
      findings.push({ severity, description, line: lineNum })
    }
  }

  return findings
}

function findTodos(content: string): { type: string; text: string; line: number }[] {
  const todos: { type: string; text: string; line: number }[] = []
  const lines = content.split("\n")
  const pattern = /\b(TODO|FIXME|HACK|XXX|OPTIMIZE|REVIEW|WORKAROUND)\b[\s:]*(.*)$/gi

  for (let i = 0; i < lines.length; i++) {
    pattern.lastIndex = 0
    const match = pattern.exec(lines[i])
    if (match) {
      todos.push({ type: match[1].toUpperCase(), text: match[2].trim(), line: i + 1 })
    }
  }
  return todos
}

function analyzeNestingDepth(content: string): { maxDepth: number; avgDepth: number; deepBlocks: { line: number; depth: number }[] } {
  const lines = content.split("\n")
  let depth = 0
  let maxDepth = 0
  let totalDepth = 0
  let depthSamples = 0
  const deepBlocks: { line: number; depth: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*")) continue

    const opens = (trimmed.match(/\{/g) || []).length
    const closes = (trimmed.match(/\}/g) || []).length

    depth += opens - closes
    if (depth < 0) depth = 0
    if (depth > maxDepth) maxDepth = depth
    totalDepth += depth
    depthSamples++

    if (depth >= 4) {
      deepBlocks.push({ line: i + 1, depth })
    }
  }

  return {
    maxDepth,
    avgDepth: depthSamples > 0 ? Math.round((totalDepth / depthSamples) * 10) / 10 : 0,
    deepBlocks,
  }
}

function analyzeMissingErrorHandling(content: string, lang: string): { line: number; description: string }[] {
  const findings: { line: number; description: string }[] = []
  const lines = content.split("\n")

  const riskyPatterns = [
    { pattern: /\.exec\s*\(/, desc: "Command execution without try/catch wrapper" },
    { pattern: /JSON\.parse\s*\(/, desc: "JSON.parse() without try/catch may crash on malformed input" },
    { pattern: /fetch\s*\(/, desc: "fetch() without catch may cause unhandled promise rejection" },
    { pattern: /\.send\s*\(/, desc: "Network send without error handler" },
    { pattern: /readFileSync|writeFileSync|readdirSync/, desc: "Sync I/O without try/catch may crash" },
  ]

  for (let i = 0; i < lines.length; i++) {
    for (const { pattern, desc } of riskyPatterns) {
      if (lines[i].match(pattern)) {
        const blockStart = Math.max(0, i - 5)
        const block = lines.slice(blockStart, i + 1).join("\n")
        const hasTry = /\btry\b/.test(block)
        const hasCatch = /\bcatch\b/.test(block)
        if (!hasTry && !hasCatch) {
          findings.push({ line: i + 1, description: desc })
        }
      }
    }
  }
  return findings
}

function findUnusedVariables(content: string, lang: string): { name: string; line: number; reason: string }[] {
  if (lang !== "TypeScript" && lang !== "JavaScript" && lang !== "TypeScript React" && lang !== "JavaScript React") {
    return []
  }

  const unused: { name: string; line: number; reason: string }[] = []
  const lines = content.split("\n")

  const varPattern = /(?:const|let|var)\s+(\w+)/g
  const fnPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g
  const paramPattern = /\(([^)]*)\)/g

  const declared = new Map<string, number>()

  for (let i = 0; i < lines.length; i++) {
    varPattern.lastIndex = 0
    let m
    while ((m = varPattern.exec(lines[i])) !== null) {
      if (!lines[i].includes("export ") || !lines[i].trim().startsWith("export")) {
        declared.set(m[1], i + 1)
      }
    }
    fnPattern.lastIndex = 0
    while ((m = fnPattern.exec(lines[i])) !== null) {
      declared.set(m[1], i + 1)
    }
  }

  for (const [name, line] of declared) {
    const usagePattern = new RegExp(`\\b${name}\\b`, "g")
    usagePattern.lastIndex = 0
    let count = 0
    while (usagePattern.exec(content) !== null) count++
    if (count <= 2) {
      unused.push({ name, line, reason: count === 1 ? "Declared but never used" : "Only referenced in its own declaration" })
    }
  }

  return unused
}

function analyzeCircularDeps(imports: { source: string; line: number }[], content: string): string[] {
  const internal = imports.filter((i) => i.source.startsWith(".") || i.source.startsWith("/"))
  const suspects: string[] = []

  const backRefs = internal.filter((i) => {
    const normalized = i.source.replace(/^\.\.?\//, "")
    const selfRef = content.includes(`from '${normalized}'`) || content.includes(`from "${normalized}"`)
    return selfRef && i.source !== "."
  })

  if (backRefs.length > 0) {
    suspects.push(`Potential circular dependency detected: ${backRefs.map((i) => i.source).join(", ")}`)
  }

  if (internal.length > 10) {
    suspects.push(`High number of internal imports (${internal.length}) — may indicate tight coupling`)
  }

  return suspects
}

function findDuplicateBlocks(content: string): { block: string; lines: number[]; occurrences: number }[] {
  const lines = content.split("\n")
  const duplicates: { block: string; lines: number[]; occurrences: number }[] = []
  const seen = new Map<string, number[]>()

  for (let i = 0; i < lines.length - 2; i++) {
    const block = lines.slice(i, i + 3).join("\n").trim()
    if (block.length < 20) continue
    if (!seen.has(block)) seen.set(block, [])
    seen.get(block)!.push(i + 1)
  }

  for (const [block, lineNums] of seen) {
    if (lineNums.length >= 2) {
      duplicates.push({ block: block.split("\n")[0].substring(0, 60), lines: lineNums, occurrences: lineNums.length })
    }
  }

  return duplicates.sort((a, b) => b.occurrences - a.occurrences).slice(0, 5)
}

function extractTypeScriptTypes(content: string, lang: string): { name: string; kind: string; line: number }[] {
  if (lang !== "TypeScript" && lang !== "TypeScript React") return []
  const types: { name: string; kind: string; line: number }[] = []
  const lines = content.split("\n")

  const patterns = [
    { pattern: /^(?:export\s+)?interface\s+(\w+)/, kind: "interface" },
    { pattern: /^(?:export\s+)?type\s+(\w+)\s*=/, kind: "type alias" },
    { pattern: /^(?:export\s+)?enum\s+(\w+)/, kind: "enum" },
    { pattern: /^(?:export\s+)?abstract\s+class\s+(\w+)/, kind: "abstract class" },
  ]

  for (let i = 0; i < lines.length; i++) {
    for (const { pattern, kind } of patterns) {
      const match = lines[i].match(pattern)
      if (match) types.push({ name: match[1], kind, line: i + 1 })
    }
  }
  return types
}

function extractExports(content: string, lang: string): { name: string; line: number }[] {
  if (lang !== "TypeScript" && lang !== "TypeScript React" && lang !== "JavaScript" && lang !== "JavaScript React") return []
  const exports: { name: string; line: number }[] = []
  const lines = content.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const exportMatch = lines[i].match(/^export\s+(?:default\s+)?(?:const|let|var|function|class)\s+(\w+)/)
    if (exportMatch) exports.push({ name: exportMatch[1], line: i + 1 })
    const namedExport = lines[i].match(/^export\s*\{\s*([^}]+)\s*\}/)
    if (namedExport) {
      namedExport[1].split(",").map((s) => s.trim()).filter(Boolean).forEach((name) => {
        exports.push({ name, line: i + 1 })
      })
    }
  }
  return exports
}

function getFileAge(stat: { mtime?: Date; ctime?: Date }): { age: string; modified: string } {
  const now = new Date()
  const mtime = stat.mtime || now
  const diffMs = now.getTime() - mtime.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  let age: string
  if (diffDays > 365) age = `${Math.floor(diffDays / 365)} years`
  else if (diffDays > 30) age = `${Math.floor(diffDays / 30)} months`
  else if (diffDays > 0) age = `${diffDays} days`
  else if (diffHours > 0) age = `${diffHours} hours`
  else age = "less than an hour"

  return {
    age: `Last modified ${age} ago`,
    modified: mtime.toISOString().replace("T", " ").substring(0, 19),
  }
}

function checkTestCoverage(filePath: string, content: string): { hasTest: boolean; testPath: string | null; ratio: number } {
  const dir = path.dirname(filePath)
  const basename = path.basename(filePath, path.extname(filePath))
  const possibleTestNames = [
    path.join(dir, `${basename}.test${path.extname(filePath)}`),
    path.join(dir, `${basename}.spec${path.extname(filePath)}`),
    path.join(dir, `${basename}_test${path.extname(filePath)}`),
    path.join(dir, `test${path.sep}${basename}.test${path.extname(filePath)}`),
    path.join(dir, `__tests__${path.sep}${basename}.test${path.extname(filePath)}`),
  ]

  const hasInlineTests = content.includes("describe(") || content.includes("it(") || content.includes("test(")

  return {
    hasTest: hasInlineTests,
    testPath: null,
    ratio: hasInlineTests ? 1 : 0,
  }
}

export const DeepFileAnalysisTool = Tool.define(
  "deep-file-analysis",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        path: z.string().describe("The absolute path to the file to analyze"),
        detailed: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, includes line-by-line analysis for small files"),
        deep: z
          .boolean()
          .optional()
          .default(true)
          .describe("If true, enables all advanced analysis (nesting, unused vars, error handling, etc.)"),
      }),
      execute: (params: { path: string; detailed?: boolean; deep?: boolean }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const effectiveCwd = SessionCwd.get(ctx.sessionID)
          const filePath = path.isAbsolute(params.path) ? params.path : path.resolve(effectiveCwd, params.path)

          yield* ctx.ask({
            permission: "read",
            patterns: [filePath],
            always: ["*"],
            metadata: { path: filePath, tool: "deep-file-analysis" },
          })

          const stat = yield* fs.stat(filePath).pipe(Effect.catch(() => Effect.succeed(undefined)))
          if (!stat || stat.type !== "File") {
            return {
              title: path.basename(filePath),
              metadata: { error: true } as any,
              output: `File not found or is not a regular file: ${filePath}`,
            }
          }

          yield* assertExternalDirectoryEffect(ctx, filePath, { kind: "file" })

          if (stat.size > MAX_FILE_SIZE) {
            return {
              title: path.basename(filePath),
              metadata: { error: true } as any,
              output: `File too large (${(Number(stat.size) / 1024 / 1024).toFixed(1)} MB). Maximum: 1 MB`,
            }
          }

          const content = yield* fs.readFileString(filePath)
          if (!content) {
            return {
              title: path.basename(filePath),
              metadata: { error: true } as any,
              output: `Could not read file: ${filePath}`,
            }
          }

          const lang = detectLanguage(filePath) || "Unknown"
          const totalLines = countLines(content)
          const commentLines = countComments(content, lang)
          const blankLines = content.split("\n").filter((l) => l.trim() === "").length
          const codeLines = totalLines - commentLines - blankLines
          const commentRatio = totalLines > 0 ? (commentLines / totalLines) * 100 : 0

          const functions = extractFunctions(content, lang)
          const functionsDetailed = params.deep ? extractFunctionsWithBody(content, lang) : []
          const classes = extractClasses(content, lang)
          const imports = extractImports(content, lang)
          const complexityScore = analyzePattern(content, (COMPLEXITY_PATTERNS[lang] || []))
          const securityFindings = analyzeSecurity(content)

          const internalImports = imports.filter((i) => i.source.startsWith(".") || i.source.startsWith("/"))
          const externalImports = imports.filter((i) => !i.source.startsWith(".") && !i.source.startsWith("/"))

          const avgLineLength = totalLines > 0
            ? Math.round(content.split("\n").reduce((acc, l) => acc + l.length, 0) / totalLines)
            : 0

          const maxLineLength = content.split("\n").reduce((max, l) => Math.max(max, l.length), 0)

          const nesting = params.deep ? analyzeNestingDepth(content) : null
          const todos = params.deep ? findTodos(content) : []
          const errorHandling = params.deep ? analyzeMissingErrorHandling(content, lang) : []
          const unused = params.deep ? findUnusedVariables(content, lang) : []
          const circular = params.deep ? analyzeCircularDeps(imports, content) : []
          const duplicates = params.deep ? findDuplicateBlocks(content) : []
          const tsTypes = params.deep ? extractTypeScriptTypes(content, lang) : []
          const exports = params.deep ? extractExports(content, lang) : []
          const mtime = stat.mtime instanceof Date ? stat.mtime : undefined
          const fileAge = mtime ? getFileAge({ mtime }) : null
          const testInfo = checkTestCoverage(filePath, content)

          const output: string[] = []
          output.push(`# Deep File Analysis: ${path.basename(filePath)}`)
          output.push("")
          output.push(`**Path:** \`${filePath}\``)
          output.push(`**Language:** ${lang}`)
          output.push(`**Size:** ${(Number(stat.size) / 1024).toFixed(1)} KB`)
          if (fileAge) {
            output.push(`**Age:** ${fileAge.age} (${fileAge.modified})`)
          }
          output.push("")
          output.push("## Code Metrics")
          output.push(`- Total Lines: ${totalLines}`)
          output.push(`- Code Lines: ${codeLines}`)
          output.push(`- Comment Lines: ${commentLines} (${commentRatio.toFixed(1)}%)`)
          output.push(`- Blank Lines: ${blankLines}`)
          output.push(`- Avg Line Length: ${avgLineLength} chars`)
          output.push(`- Max Line Length: ${maxLineLength} chars`)
          output.push("")
          output.push("## Structure")
          output.push(`- Functions/Methods: ${functions.length}`)
          output.push(`- Classes/Types: ${classes.length}`)
          output.push(`- Total Imports: ${imports.length}`)
          output.push(`  - Internal: ${internalImports.length}`)
          output.push(`  - External: ${externalImports.length}`)
          if (tsTypes.length > 0) {
            output.push(`- TypeScript Types: ${tsTypes.length} (${tsTypes.filter(t => t.kind === "interface").length} interfaces, ${tsTypes.filter(t => t.kind === "type alias").length} type aliases)`)
          }
          if (exports.length > 0) {
            output.push(`- Module Exports: ${exports.length}`)
          }
          output.push("")

          if (params.deep && duplicates.length > 0) {
            output.push("## Duplicate Code Warning")
            for (const dup of duplicates) {
              output.push(`- Block \`${dup.block}\` appears ${dup.occurrences}x at lines ${dup.lines.join(", ")}`)
            }
            output.push("")
          }

          if (circular.length > 0) {
            output.push("## Circular Dependency Check")
            for (const c of circular) {
              output.push(`- ${c}`)
            }
            output.push("")
          }

          if (todos.length > 0) {
            output.push("## TODO/FIXME/HACK Scan")
            for (const t of todos) {
              const emoji = t.type === "FIXME" ? "FIX" : t.type === "HACK" ? "HACK" : t.type === "XXX" ? "XXX" : "TODO"
              output.push(`- L${t.line}: [${emoji}] ${t.text}`)
            }
            output.push("")
          }

          output.push("## Imports")
          if (imports.length > 0) {
            const sorted = [...imports].sort((a, b) => a.line - b.line)
            for (const imp of sorted.slice(0, 40)) {
              output.push(`  L${imp.line}: ${imp.source}`)
            }
            if (sorted.length > 40) {
              output.push(`  ... and ${sorted.length - 40} more imports`)
            }
          } else {
            output.push("  No imports detected")
          }

          output.push("")
          output.push("## Function Map")
          if (functions.length > 0) {
            if (params.deep && functionsDetailed.length > 0) {
              const longest = [...functionsDetailed].sort((a, b) => b.length - a.length)[0]
              for (const fn of functionsDetailed) {
                const warning = fn.length > 50 ? " (long)" : ""
                const isLongest = fn.name === longest.name ? " (largest)" : ""
                output.push(`  L${fn.line}: \`${fn.name}\` — ${fn.length} lines${warning}${isLongest}`)
              }
            } else {
              for (const fn of functions) {
                output.push(`  L${fn.line}: \`${fn.name}\``)
              }
            }
          } else {
            output.push("  No functions detected")
          }

          if (classes.length > 0) {
            output.push("")
            output.push("## Class/Type Map")
            for (const cls of classes) {
              output.push(`  L${cls.line}: \`${cls.name}\``)
            }
          }

          if (tsTypes.length > 0) {
            output.push("")
            output.push("## TypeScript Types")
            for (const t of tsTypes) {
              output.push(`  L${t.line}: ${t.kind} \`${t.name}\``)
            }
          }

          if (nesting) {
            output.push("")
            output.push("## Nesting Depth Analysis")
            output.push(`- Maximum nesting depth: ${nesting.maxDepth}`)
            output.push(`- Average nesting depth: ${nesting.avgDepth}`)
            if (nesting.deepBlocks.length > 0) {
              output.push(`- Deeply nested blocks (depth >= 4): ${nesting.deepBlocks.length}`)
              for (const b of nesting.deepBlocks.slice(0, 10)) {
                output.push(`  L${b.line}: depth ${b.depth}`)
              }
              if (nesting.deepBlocks.length > 10) {
                output.push(`  ... and ${nesting.deepBlocks.length - 10} more`)
              }
            }
            if (nesting.maxDepth >= 4) {
              output.push("- Warning: Deep nesting detected — consider refactoring")
            }
          }

          output.push("")
          output.push("## Complexity Analysis")
          output.push(`- Cyclomatic complexity score: ${complexityScore}`)
          if (complexityScore > 20) {
            output.push("- High complexity — consider refactoring")
          } else if (complexityScore > 10) {
            output.push("- Moderate complexity")
          } else {
            output.push("- Low complexity")
          }

          if (params.deep && errorHandling.length > 0) {
            output.push("")
            output.push("## Missing Error Handling")
            for (const e of errorHandling) {
              output.push(`  L${e.line}: ${e.description}`)
            }
          }

          if (params.deep && unused.length > 0) {
            output.push("")
            output.push("## Unused Variables / Dead Code")
            for (const u of unused) {
              output.push(`  L${u.line}: \`${u.name}\` — ${u.reason}`)
            }
          }

          if (securityFindings.length > 0) {
            output.push("")
            output.push("## Security Scan")

            const high = securityFindings.filter((f) => f.severity === "high")
            const medium = securityFindings.filter((f) => f.severity === "medium")
            const low = securityFindings.filter((f) => f.severity === "low")

            if (high.length > 0) {
              output.push(`\n### High Severity (${high.length})`)
              for (const f of high) {
                output.push(`  L${f.line}: ${f.description}`)
              }
            }
            if (medium.length > 0) {
              output.push(`\n### Medium Severity (${medium.length})`)
              for (const f of medium) {
                output.push(`  L${f.line}: ${f.description}`)
              }
            }
            if (low.length > 0) {
              output.push(`\n### Low Severity (${low.length})`)
              for (const f of low) {
                output.push(`  L${f.line}: ${f.description}`)
              }
            }
          } else {
            output.push("\n## Security Scan")
            output.push("No security issues detected")
          }

          output.push("")
          output.push("## Test Coverage")
          if (testInfo.hasTest) {
            output.push("- Inline tests detected (describe/it/test patterns)")
          } else {
            output.push("- No test patterns detected in this file")
          }

          output.push("")
          output.push("## Summary")
          const issues: string[] = []
          if (complexityScore > 20) issues.push("- High complexity: Consider breaking down into smaller functions")
          if (commentRatio < 5 && codeLines > 100) issues.push("- Low documentation: Consider adding more comments")
          if (maxLineLength > 120) issues.push(`- Long lines: Max line length is ${maxLineLength} chars — consider formatting`)
          if (functions.length > 20) issues.push(`- Large file: ${functions.length} functions — consider splitting into modules`)
          if (nesting && nesting.maxDepth >= 4) issues.push("- Deep nesting detected — consider flattening logic")
          if (securityFindings.some((f) => f.severity === "high")) issues.push("- Security issues: High severity findings detected — review immediately")
          if (todos.length > 0) issues.push(`- Pending work: ${todos.length} TODO/FIXME markers remain`)
          if (unused.length > 0) issues.push(`- Dead code: ${unused.length} potentially unused variables`)
          if (errorHandling.length > 0) issues.push(`- Error handling: ${errorHandling.length} risky operations without try/catch`)
          if (params.deep && functionsDetailed.filter(f => f.length > 50).length > 0) issues.push(`- Long functions: ${functionsDetailed.filter(f => f.length > 50).length} functions exceed 50 lines`)

          if (issues.length > 0) {
            output.push(...issues)
          } else {
            output.push("No significant issues detected")
          }

          return {
            title: path.basename(filePath),
            metadata: {
              error: false,
              language: lang,
              lines: totalLines,
              functions: functions.length,
              classes: classes.length,
              imports: imports.length,
              complexity: complexityScore,
              securityFindings: securityFindings.length,
              nestingDepth: nesting?.maxDepth ?? 0,
              todos: todos.length,
              unusedVars: unused.length,
              missingErrorHandling: errorHandling.length,
              duplicateBlocks: duplicates.length,
            },
            output: output.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

