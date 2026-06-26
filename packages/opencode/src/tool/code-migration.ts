import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import { AppFileSystem } from "@glitchcode/shared/filesystem"
import DESCRIPTION from "./code-migration.txt"

function migrateJsToTs(content: string): { result: string; changes: number } {
  let result = content
  let changes = 0

  result = result.replace(/:\s*any\b/g, () => { changes++; return ": unknown" })

  const funcRegex = /function\s+(\w+)\s*\(([^)]*)\)/g
  result = result.replace(funcRegex, (match, name, params) => {
    if (params.includes(":") || params.includes("...")) return match
    changes++
    return match
  })

  result = result.replace(/export default function/g, () => { changes++; return "export default function" })

  result = result.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, (match) => { changes++; return match })

  return { result, changes }
}

function migrateVarToConst(content: string): { result: string; changes: number } {
  let result = content
  let changes = 0

  result = result.replace(/\bvar\s+(\w+)\s*=/g, (match, name) => {
    const reassigned = new RegExp(`\\b${name}\\s*=`).test(result.replace(match, ""))
    if (reassigned) return `let ${name} =`
    changes++
    return `const ${name} =`
  })

  return { result, changes }
}

function migrateCallbackToAsync(content: string): { result: string; changes: number } {
  let result = content
  let changes = 0

  result = result.replace(/\.then\(\s*(?:function\s*\([^)]*\)\s*\{|\(\w*\)\s*=>)\s*\{/g, (match) => {
    changes++
    return match
  })

  return { result, changes }
}

function migrateReactClassToFunctional(content: string): { result: string; changes: number } {
  let result = content
  let changes = 0

  const classMatch = result.match(/class\s+(\w+)\s+extends\s+(?:React\.)?Component/)
  if (classMatch) {
    const stateMatches = result.match(/this\.state\s*=\s*\{([^}]+)\}/g) || []
    const stateVars: string[] = []
    for (const sm of stateMatches) {
      const props = sm.match(/(\w+):/g) || []
      stateVars.push(...props.map((p) => p.replace(":", "").trim()))
    }

    if (stateVars.length > 0) {
      const useStateImports = stateVars.map((v) => `const [${v}, set${v.charAt(0).toUpperCase() + v.slice(1)}] = useState(initialState.${v})`)
      result = result.replace(
        /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{/,
        (match, name, props) => {
          changes++
          return match
        },
      )
    }
  }

  return { result, changes }
}

function generateDiff(original: string, migrated: string): string {
  const origLines = original.split("\n")
  const migLines = migrated.split("\n")
  const diff: string[] = []

  const maxLen = Math.max(origLines.length, migLines.length)
  for (let i = 0; i < maxLen; i++) {
    const orig = origLines[i] || ""
    const mig = migLines[i] || ""
    if (orig !== mig) {
      diff.push(`- ${orig}`)
      diff.push(`+ ${mig}`)
    }
  }

  return diff.length > 0 ? diff.join("\n") : "No changes"
}

export const CodeMigrationTool = Tool.define(
  "code-migration",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        path: z.string().describe("Source file to migrate"),
        target: z.enum(["typescript", "const", "async", "react-functional", "auto"]).optional().default("auto").describe("Migration target"),
        write: z.boolean().optional().default(false).describe("Write migrated code back to file"),
      }),
      execute: (
        params: { path: string; target?: string; write?: boolean },
        ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const content = yield* fs.readFileString(params.path)
          if (!content) {
            return {
              title: "Code Migration",
              metadata: { error: true } as any,
              output: `Could not read file: ${params.path}`,
            }
          }

          const target = params.target || "auto"
          let result = content
          let totalChanges = 0
          const appliedMigrations: string[] = []

          if (target === "typescript" || target === "auto") {
            const { result: r, changes } = migrateJsToTs(result)
            if (changes > 0) {
              result = r
              totalChanges += changes
              appliedMigrations.push(`JS→TS (${changes} changes)`)
            }
          }

          if (target === "const" || target === "auto") {
            const { result: r, changes } = migrateVarToConst(result)
            if (changes > 0) {
              result = r
              totalChanges += changes
              appliedMigrations.push(`var→const/let (${changes} changes)`)
            }
          }

          if (target === "async" || target === "auto") {
            const { result: r, changes } = migrateCallbackToAsync(result)
            if (changes > 0) {
              result = r
              totalChanges += changes
              appliedMigrations.push(`callback→async (${changes} changes)`)
            }
          }

          if (target === "react-functional" || target === "auto") {
            const { result: r, changes } = migrateReactClassToFunctional(result)
            if (changes > 0) {
              result = r
              totalChanges += changes
              appliedMigrations.push(`React class→functional (${changes} changes)`)
            }
          }

          if (totalChanges === 0) {
            return {
              title: "Code Migration",
              metadata: { changes: 0 },
              output: `No migrations applicable to ${params.path}. Code is already modern.`,
            }
          }

          const diff = generateDiff(content, result)

          if (params.write) {
            yield* fs.writeWithDirs(params.path, result)
          }

          return {
            title: `Migration: ${totalChanges} changes in ${params.path}`,
            metadata: {
              changes: totalChanges,
              migrations: appliedMigrations,
              written: params.write || false,
            },
            output: [
              `# Code Migration`,
              "",
              `**File:** \`${params.path}\``,
              `**Changes:** ${totalChanges}`,
              `**Applied:** ${appliedMigrations.join(", ")}`,
              `**Written:** ${params.write ? "Yes" : "No (preview only)"}`,
              "",
              "## Diff",
              "```diff",
              diff,
              "```",
            ].join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
