import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import { History } from "@/history"
import DESCRIPTION from "./self-supervision.txt"

export const SelfSupervisionTool = Tool.define(
  "self-supervision",
  Effect.gen(function* () {
    const history = yield* History.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        mode: z
          .enum(["subagent-scan", "agent-flaws", "prompt-audit", "consistency-check"])
          .describe("Supervision mode to run"),
        session_id: z
          .string()
          .optional()
          .describe("Specific session to audit (defaults to current)"),
        depth: z
          .number()
          .optional()
          .default(10)
          .describe("Number of recent messages to scan"),
      }),
      execute: (params: { mode: string; session_id?: string; depth?: number }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const limit = Math.min(params.depth ?? 10, 50)

          const hits = yield* history.search({
            scope: "project",
            session_id: params.session_id || ctx.sessionID,
            limit,
          })

          const lines: string[] = []
          lines.push(`# Self-Supervision: ${params.mode}`)
          lines.push(`Session: ${params.session_id || ctx.sessionID}`)
          lines.push(`Scanned: ${hits.length} messages`)
          lines.push("")

          let findings = 0
          let warnings = 0

          if (params.mode === "subagent-scan") {
            lines.push("## Subagent Error Scan")
            lines.push("Analyzing subagent outputs for common error patterns...")
            lines.push("")

            const errorPatterns = [
              /(error|exception|failed|failure|crash|timeout)/gi,
              /(cannot|can't|unable to|not found|missing)/gi,
              /(undefined|null|NaN|undefined is not)/gi,
              /(permission denied|access denied|EACCES|EPERM)/gi,
              /(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOENT)/gi,
              /(syntax error|unexpected token|unexpected identifier)/gi,
              /(TypeError|ReferenceError|RangeError)/gi,
            ]

            for (const hit of hits) {
              if (hit.kind !== "assistant_text" && hit.kind !== "tool_call") continue
              for (let i = 0; i < errorPatterns.length; i++) {
                const matches = hit.content.match(errorPatterns[i])
                if (matches) {
                  lines.push(`L${hit.messageID}: ${matches.length}x error pattern hit — "${matches[0]}"`)
                  lines.push(`  Context: ${hit.content.substring(0, 200)}`)
                  findings++
                  break
                }
              }
            }

            if (findings === 0) {
              lines.push("No error patterns detected in subagent outputs.")
            }
          }

          if (params.mode === "agent-flaws") {
            lines.push("## Agent Flaw Review")
            lines.push("Cross-referencing agent outputs against task requirements...")
            lines.push("")

            const flawPatterns = [
              { pattern: /(TODO|FIXME|HACK|XXX)/gi, severity: "medium", desc: "Unresolved work markers" },
              { pattern: /(workaround|hacky|temporary|quick fix)/gi, severity: "low", desc: "Potential technical debt" },
              { pattern: /(as any|@ts-ignore|@ts-expect-error|// @ts-nocheck)/g, severity: "medium", desc: "Type safety bypass" },
              { pattern: /(console\.log|console\.debug)/g, severity: "low", desc: "Debug logging in production code" },
              { pattern: /(.{200,})/g, severity: "medium", desc: "Extremely long line (>200 chars)" },
              { pattern: /(hardcoded|hard-coded)/gi, severity: "low", desc: "Hardcoded values detected" },
            ]

            for (const hit of hits) {
              if (hit.kind !== "assistant_text" && hit.kind !== "tool_output") continue
              for (const fp of flawPatterns) {
                const matches = hit.content.match(fp.pattern)
                if (matches) {
                  const sev = fp.severity === "high" ? "!" : fp.severity === "medium" ? "!" : "i"
                  lines.push(`[${sev}] ${fp.desc} (${matches.length}x)`)
                  lines.push(`  ${hit.content.substring(0, 150)}`)
                  findings++
                  if (fp.severity === "high" || fp.severity === "medium") warnings++
                  break
                }
              }
            }

            if (findings === 0) {
              lines.push("No significant flaws detected in agent outputs.")
            }
          }

          if (params.mode === "prompt-audit") {
            lines.push("## Prompt Quality Audit")
            lines.push("Analyzing user prompts for clarity and completeness...")
            lines.push("")

            const promptIssues = [
              { pattern: /^.{0,10}$/gm, severity: "warning", desc: "Overly short prompts (less context)" },
              { pattern: /(şey|thing|that|it|bunu|şunu)/gi, severity: "hint", desc: "Ambiguous references detected" },
              { pattern: /(lütfen|please)/gi, severity: "info", desc: "Politeness uses token budget" },
              { pattern: /(yap|do|make|write|create|add)/gi, severity: "info", desc: "Vague action verbs — be more specific" },
              { pattern: /(düzelt|fix|bug|hata|error)/gi, severity: "info", desc: "Bug fix request — consider adding reproduction steps" },
            ]

            for (const hit of hits) {
              if (hit.kind !== "user_text") continue
              for (const pi of promptIssues) {
                const matches = hit.content.match(pi.pattern)
                if (matches) {
                  lines.push(`[${pi.severity}] ${pi.desc}`)
                  lines.push(`  Prompt: ${hit.content.substring(0, 200)}`)
                  findings++
                  break
                }
              }
            }

            if (findings === 0) {
              lines.push("All prompts appear well-formed.")
            }
          }

          if (params.mode === "consistency-check") {
            lines.push("## Consistency Check")
            lines.push("Scanning conversation for plan vs output mismatches...")
            lines.push("")

            const consistencyPatterns = [
              { pattern: /(I will|I'll|I'm going to|I plan to)/gi, severity: "info", desc: "Promise made — verify delivery" },
              { pattern: /(doesn't work|not working|not implemented|missing)/gi, severity: "high", desc: "Missing or broken feature" },
              { pattern: /(actually|however|but wait|on second thought)/gi, severity: "medium", desc: "Contradictory statement" },
              { pattern: /(TODO|FIXME|HACK|XXX|WIP)/gi, severity: "high", desc: "Incomplete work marker" },
            ]

            for (const hit of hits) {
              if (hit.kind !== "assistant_text" && hit.kind !== "user_text") continue
              for (const cp of consistencyPatterns) {
                const matches = hit.content.match(cp.pattern)
                if (matches) {
                  const sev = cp.severity === "high" ? "!!" : cp.severity === "medium" ? "!" : "i"
                  lines.push(`[${sev}] ${cp.desc} (${matches.length}x)`)
                  lines.push(`  ${hit.kind} L${hit.messageID}: ${hit.content.substring(0, 200)}`)
                  findings++
                  if (cp.severity === "high" || cp.severity === "medium") warnings++
                  break
                }
              }
            }

            if (findings === 0) {
              lines.push("No consistency issues detected — plan and output appear aligned.")
            }
          }

          lines.push("")
          lines.push("## Summary")
          lines.push(`- Total issues found: ${findings}`)
          lines.push(`- Warnings: ${warnings}`)
          if (warnings > 0) {
            lines.push("- Action recommended: Review flagged items above")
          } else if (findings > 0) {
            lines.push("- Minor items flagged — no urgent action needed")
          } else {
            lines.push("- Clean scan — no issues detected")
          }

          return {
            title: `Self-Supervision: ${params.mode}`,
            metadata: {
              mode: params.mode,
              messagesScanned: hits.length,
              findings,
              warnings,
              consistencyPromises: params.mode === "consistency-check"
                ? hits.filter(h => /(I will|I'll|I'm going to|I plan to)/gi.test(h.content)).length
                : undefined,
              consistencyContradictions: params.mode === "consistency-check"
                ? hits.filter(h => /(actually|however|but wait|on second thought)/gi.test(h.content)).length
                : undefined,
            },
            output: lines.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
