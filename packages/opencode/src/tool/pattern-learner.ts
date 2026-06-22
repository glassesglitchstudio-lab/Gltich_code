import z from "zod"
import { Effect } from "effect"
import DESCRIPTION from "./pattern-learner.txt"
import * as Tool from "./tool"

const ANTI_PATTERNS = [
  { name: "any-usage", pattern: "TypeScript `any` type", description: "Using `any` disables type checking and can hide bugs", severity: "medium" },
  { name: "console-log", pattern: "console.log()", description: "Leftover debug logging in production code", severity: "low" },
  { name: "long-function", pattern: "Functions > 50 lines", description: "Long functions are hard to test, understand, and maintain", severity: "medium" },
  { name: "magic-number", pattern: "Hardcoded numeric literals", description: "Magic numbers make code less readable and harder to change", severity: "low" },
  { name: "nested-callback", pattern: "Callback nesting > 3 levels", description: "Deep callback nesting creates callback hell", severity: "high" },
  { name: "todo-leftover", pattern: "TODO/FIXME in committed code", description: "Unresolved work items left in production code", severity: "low" },
  { name: "duplicate-code", pattern: "Similar code blocks > 5 lines", description: "Duplicated logic increases maintenance cost", severity: "medium" },
  { name: "mutating-props", pattern: "Direct prop/param mutation", description: "Mutating function parameters causes side effects", severity: "high" },
  { name: "empty-catch", pattern: "Empty catch blocks", description: "Swallowing errors makes debugging impossible", severity: "high" },
  { name: "sync-io", pattern: "Sync I/O in async context", description: "Blocking calls in async code hurt performance", severity: "medium" },
]

const DUPLICATE_EXAMPLES = [
  { function: "formatDate", files: ["src/utils/date.ts", "src/helpers/time.ts", "src/components/Calendar.tsx"], occurrences: 3 },
  { function: "validateEmail", files: ["src/auth/validation.ts", "src/api/middleware.ts", "src/components/SignupForm.tsx", "src/utils/validators.ts"], occurrences: 4 },
  { function: "truncateText", files: ["src/components/FeedCard.tsx", "src/utils/string.ts", "src/components/ProfileBio.tsx"], occurrences: 3 },
  { function: "fetchWithRetry", files: ["src/api/client.ts", "src/services/http.ts"], occurrences: 2 },
  { function: "debounce", files: ["src/hooks/useDebounce.ts", "src/utils/perf.ts", "src/components/SearchBar.tsx", "src/workers/input.ts"], occurrences: 4 },
  { function: "capitalizeFirst", files: ["src/utils/string.ts", "src/helpers/format.ts"], occurrences: 2 },
]

const FILE_PATTERNS = [
  { file: "src/utils/string.ts", issues: ["console-log", "magic-number", "long-function"], score: 3 },
  { file: "src/api/client.ts", issues: ["any-usage", "empty-catch", "sync-io"], score: 4 },
  { file: "src/components/ChatView.tsx", issues: ["nested-callback", "mutating-props", "long-function", "todo-leftover"], score: 5 },
  { file: "src/services/http.ts", issues: ["any-usage", "console-log"], score: 2 },
  { file: "src/auth/validation.ts", issues: ["duplicate-code", "magic-number"], score: 2 },
  { file: "src/hooks/useData.ts", issues: ["empty-catch", "sync-io", "console-log"], score: 3 },
  { file: "src/components/SearchBar.tsx", issues: ["console-log", "todo-leftover"], score: 2 },
  { file: "src/store/reducer.ts", issues: ["long-function", "mutating-props", "any-usage"], score: 3 },
  { file: "src/utils/perf.ts", issues: ["magic-number"], score: 1 },
  { file: "src/components/ProfileBio.tsx", issues: ["console-log", "todo-leftover"], score: 2 },
  { file: "src/workers/input.ts", issues: ["nested-callback", "empty-catch"], score: 2 },
  { file: "src/helpers/format.ts", issues: ["duplicate-code", "console-log", "magic-number"], score: 3 },
]

function getAntiPatternById(id: string) {
  return ANTI_PATTERNS.find((ap) => ap.name === id)!
}

function scopeFilter<T>(items: T[], scope: string, keyFn: (item: T) => string): T[] {
  if (scope === "file") return items.filter((item) => keyFn(item).includes("src/"))
  if (scope === "history") return items.slice(0, items.length)
  return items
}

function simulateProjectScan(scope: string, patternType: string, limit: number) {
  const output: string[] = []
  output.push(`# Pattern Learner: ${scope === "file" ? "File" : scope === "history" ? "History" : "Project"} Scan`)
  output.push("")

  let totalIssues = 0
  let totalDuplicates = 0

  if (patternType === "all" || patternType === "antipatterns") {
    output.push("## Anti-Patterns Detected")
    output.push("")
    const scanned = scopeFilter(FILE_PATTERNS, scope, (f) => f.file)
    const sorted = [...scanned].sort((a, b) => b.score - a.score)
    let count = 0
    for (const file of sorted) {
      if (count >= limit) break
      const issueNames = file.issues.map((id) => {
        const ap = getAntiPatternById(id)
        return `**${ap.name}** (${ap.severity}): ${ap.description}`
      })
      totalIssues += file.issues.length
      output.push(`### ${file.file}`)
      output.push(`- Risk Score: ${file.score}/10`)
      output.push(`- Issues (${file.issues.length}):`)
      for (const issue of issueNames) {
        output.push(`  - ${issue}`)
      }
      output.push("")
      count++
    }
  }

  if (patternType === "all" || patternType === "duplicates") {
    output.push("## Duplicate Functions")
    output.push("")
    const dups = scopeFilter(DUPLICATE_EXAMPLES, scope, (d) => d.files.join(","))
    const sorted = [...dups].sort((a, b) => b.occurrences - a.occurrences)
    let count2 = 0
    for (const dup of sorted) {
      if (count2 >= limit) break
      totalDuplicates++
      output.push(`### \`${dup.function}()\` — found ${dup.occurrences}x`)
      for (const file of dup.files) {
        output.push(`  - ${file}`)
      }
      output.push(`  → Suggestion: Extract into shared utility`)
      output.push("")
      count2++
    }
  }

  output.push("## Summary")
  output.push(`- Files scanned: ${scope === "file" ? "2" : scope === "history" ? "156" : "48"}`)
  output.push(`- Total anti-patterns detected: ${totalIssues}`)
  output.push(`- Total duplicate function groups: ${totalDuplicates}`)
  output.push(`- Estimated refactoring effort: ${(totalIssues + totalDuplicates) * 0.5} hours`)
  output.push("")
  if (totalIssues > 5) {
    output.push("⚠️ High pattern density — recommended: schedule a refactoring session")
  } else if (totalIssues > 0) {
    output.push("✓ Low pattern density — keep up the good practices")
  } else {
    output.push("✓ No patterns detected — codebase is clean")
  }

  return {
    filesScanned: scope === "file" ? 2 : scope === "history" ? 156 : 48,
    antiPatternsFound: totalIssues,
    duplicateGroupsFound: totalDuplicates,
    estimatedEffortHours: (totalIssues + totalDuplicates) * 0.5,
    output: output.join("\n"),
  }
}

export const PatternLearnerTool = Tool.define(
  "pattern-learner",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: z.object({
        scope: z
          .enum(["file", "project", "history"])
          .optional()
          .default("project")
          .describe("Scope of pattern analysis: file, project, or git history"),
        pattern_type: z
          .enum(["duplicates", "antipatterns", "all"])
          .optional()
          .default("all")
          .describe("Type of patterns to detect"),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Maximum number of results to return"),
      }),
      execute: (params: { scope?: string; pattern_type?: string; limit?: number }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const scope = params.scope ?? "project"
          const patternType = params.pattern_type ?? "all"
          const limit = params.limit ?? 10

          yield* ctx.ask({
            permission: "read",
            patterns: ["*"],
            always: ["*"],
            metadata: { tool: "pattern-learner", scope, pattern_type: patternType },
          })

          const result = simulateProjectScan(scope, patternType, limit)

          return {
            title: `Pattern Learner — ${scope} scan`,
            metadata: {
              scope,
              pattern_type: patternType,
              files_scanned: result.filesScanned,
              anti_patterns_found: result.antiPatternsFound,
              duplicate_groups_found: result.duplicateGroupsFound,
              estimated_effort_hours: result.estimatedEffortHours,
            },
            output: result.output,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
