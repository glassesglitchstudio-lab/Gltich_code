import z from "zod"
import * as path from "path"
import { Effect } from "effect"
import * as Tool from "./tool"
import { Session } from "../session"
import DESCRIPTION from "./context-compressor.txt"
import { AppFileSystem } from "@glitchcode/shared/filesystem"

const parameters = z.object({
  session_id: z.string().optional().describe("Session ID to compress. Defaults to current session."),
  format: z.enum(["summary", "bullets", "structured"]).optional().default("summary").describe("Output format for the compressed context"),
  include_decisions: z.boolean().optional().default(true).describe("Include key decisions in the summary"),
  include_todos: z.boolean().optional().default(true).describe("Include TODOs in the summary"),
  output_path: z.string().optional().describe("Absolute path to write the compressed markdown file"),
})

export const ContextCompressorTool = Tool.define(
  "context-compressor",
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    return {
      description: DESCRIPTION,
      parameters,
      execute: (args: z.infer<typeof parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const sessionID = args.session_id ?? ctx.sessionID
          const msgs = yield* sessions.messages({ sessionID, agentID: "*" })
          if (msgs.length === 0) {
            return {
              title: "Context compressor: no messages",
              output: "Session has no messages to compress.",
              metadata: { sessionID, count: 0 },
            }
          }

          const decisions: string[] = []
          const todos: string[] = []
          const changes: string[] = []
          const errors: string[] = []
          let userText = ""
          let assistantText = ""

          for (const msg of msgs) {
            for (const part of msg.parts) {
              const text = typeof part.data === "object" && part.data !== null
                ? (part.data as any).text ?? ""
                : ""
              if (part.role === "user") {
                userText += text + "\n"
              } else {
                assistantText += text + "\n"
              }
              if (part.type === "tool" && (part.data as any)?.state?.error) {
                errors.push((part.data as any).state.error)
              }
            }
          }

          let output = `# Session Summary — ${sessionID}\n\n`
          output += `- **Messages**: ${msgs.length}\n`
          output += `- **Format**: ${args.format}\n`
          output += `- **Includes**: ${args.include_decisions ? "decisions, " : ""}${args.include_todos ? "todos" : ""}\n\n`

          const lines = [`Total messages: ${msgs.length}`]
          lines.push("")
          lines.push("## Conversation Overview")
          lines.push("")
          if (userText) {
            const preview = userText.slice(0, 500)
            lines.push(`**User input (preview):**\n${preview}`)
            lines.push("")
          }
          if (assistantText) {
            const preview = assistantText.slice(0, 500)
            lines.push(`**Assistant responses (preview):**\n${preview}`)
            lines.push("")
          }

          if (args.include_decisions && decisions.length > 0) {
            lines.push("## Key Decisions")
            for (const d of decisions) lines.push(`- ${d}`)
            lines.push("")
          }
          if (args.include_todos && todos.length > 0) {
            lines.push("## TODOs")
            for (const t of todos) lines.push(`- ${t}`)
            lines.push("")
          }
          if (changes.length > 0) {
            lines.push("## Code Changes")
            for (const c of changes) lines.push(`- ${c}`)
            lines.push("")
          }
          if (errors.length > 0) {
            lines.push("## Errors Encountered")
            for (const e of errors.slice(0, 10)) lines.push(`- ${e}`)
            if (errors.length > 10) lines.push(`- ... and ${errors.length - 10} more errors`)
            lines.push("")
          }

          output += lines.join("\n")

          if (args.output_path) {
            const fp = path.isAbsolute(args.output_path)
              ? args.output_path
              : path.join(process.cwd(), args.output_path)
            const fs = yield* AppFileSystem.Service
            yield* fs.writeWithDirs(fp, output)
            output += `\n\nCompressed context written to: ${fp}`
          }

          return {
            title: `Context compressed: ${msgs.length} messages`,
            metadata: {
              sessionID,
              count: msgs.length,
              format: args.format,
              output_path: args.output_path,
            },
            output,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
