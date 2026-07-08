import z from "zod"
import { Effect } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./git.txt"

function exec(cmd: string, cwd?: string): Effect.Effect<{ stdout: string; stderr: string; code: number }> {
  return Effect.promise(async () => {
    const proc = Bun.spawn(["bash", "-c", cmd], { cwd, stdout: "pipe", stderr: "pipe" })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const code = await proc.exited
    return { stdout: stdout.trim(), stderr: stderr.trim(), code }
  })
}

export const GitTool = Tool.define(
  "git",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: z.object({
        operation: z
          .enum(["status", "diff", "log", "blame", "commit", "branch"])
          .describe("Git operation to perform"),
        message: z.string().optional().describe("Commit message (required for commit operation)"),
        files: z.array(z.string()).optional().describe("Specific files for diff/commit"),
        count: z.number().optional().default(5).describe("Number of log entries to show"),
        branch: z.string().optional().describe("Branch name for branch operation"),
      }),
      execute: (
        params: {
          operation: string
          message?: string
          files?: string[]
          count?: number
          branch?: string
        },
        ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const cwd = process.cwd()

          if (params.operation === "status") {
            const { stdout, stderr, code } = yield* exec("git status --short", cwd)
            if (code !== 0) {
              return {
                title: "Git Status",
                metadata: { error: true } as Tool.Metadata,
                output: `Error: ${stderr || "Not a git repository"}`,
              }
            }
            const lines = stdout ? stdout.split("\n") : []
            const staged = lines.filter((l) => l[0] !== " " && l[0] !== "?")
            const unstaged = lines.filter((l) => l[0] === " " && l[1] !== " ")
            const untracked = lines.filter((l) => l.startsWith("??"))

            const output: string[] = ["# Git Status", ""]
            if (staged.length) {
              output.push(`## Staged (${staged.length})`)
              staged.forEach((l) => output.push(`  ${l}`))
              output.push("")
            }
            if (unstaged.length) {
              output.push(`## Unstaged (${unstaged.length})`)
              unstaged.forEach((l) => output.push(`  ${l}`))
              output.push("")
            }
            if (untracked.length) {
              output.push(`## Untracked (${untracked.length})`)
              untracked.forEach((l) => output.push(`  ${l}`))
              output.push("")
            }
            if (!staged.length && !unstaged.length && !untracked.length) {
              output.push("Working tree clean — nothing to commit.")
            }

            return {
              title: "Git Status",
              metadata: {
                staged: staged.length,
                unstaged: unstaged.length,
                untracked: untracked.length,
                total: lines.length,
              },
              output: output.join("\n"),
            }
          }

          if (params.operation === "diff") {
            const fileArgs = params.files?.length ? ` -- ${params.files.join(" ")}` : ""
            const { stdout, stderr, code } = yield* exec(`git diff${fileArgs}`, cwd)
            if (code !== 0) {
              return {
                title: "Git Diff",
                metadata: { error: true } as Tool.Metadata,
                output: `Error: ${stderr}`,
              }
            }
            if (!stdout) {
              return {
                title: "Git Diff",
                metadata: { lines: 0 },
                output: "No changes to diff.",
              }
            }
            return {
              title: "Git Diff",
              metadata: { lines: stdout.split("\n").length },
              output: `# Git Diff\n\n\`\`\`diff\n${stdout}\n\`\`\``,
            }
          }

          if (params.operation === "log") {
            const count = params.count || 5
            const { stdout, stderr, code } = yield* exec(
              `git log -${count} --pretty=format:"%h|%s|%an|%ar"`,
              cwd,
            )
            if (code !== 0) {
              return {
                title: "Git Log",
                metadata: { error: true } as Tool.Metadata,
                output: `Error: ${stderr}`,
              }
            }
            const entries = stdout
              .split("\n")
              .filter(Boolean)
              .map((line) => {
                const [hash, subject, author, date] = line.split("|")
                return { hash, subject, author, date }
              })
            const output: string[] = [`# Git Log (last ${count})`, ""]
            for (const e of entries) {
              output.push(`- \`${e.hash}\` ${e.subject} — ${e.author} (${e.date})`)
            }
            return {
              title: "Git Log",
              metadata: { count: entries.length },
              output: output.join("\n"),
            }
          }

          if (params.operation === "blame") {
            if (!params.files?.length) {
              return {
                title: "Git Blame",
                metadata: { error: true } as Tool.Metadata,
                output: "Error: 'files' parameter is required for blame operation.",
              }
            }
            const file = params.files[0]
            const { stdout, stderr, code } = yield* exec(`git blame --porcelain "${file}"`, cwd)
            if (code !== 0) {
              return {
                title: "Git Blame",
                metadata: { error: true } as Tool.Metadata,
                output: `Error: ${stderr}`,
              }
            }
            const lines = stdout.split("\n")
            const blame: { line: number; hash: string; author: string; content: string }[] = []
            let current: Partial<{ hash: string; author: string; line: number; content: string }> = {}
            for (const l of lines) {
              if (l.match(/^[0-9a-f]{40}/)) {
                current.hash = l.split(" ")[0].slice(0, 8)
              } else if (l.startsWith("author ")) {
                current.author = l.slice(7)
              } else if (l.startsWith("\t")) {
                current.content = l.slice(1)
                if (current.hash && current.author && current.content !== undefined) {
                  blame.push({
                    line: blame.length + 1,
                    hash: current.hash,
                    author: current.author,
                    content: current.content,
                  })
                }
                current = {}
              }
            }
            const output: string[] = [`# Git Blame: ${file}`, ""]
            for (const b of blame.slice(0, 50)) {
              output.push(`${String(b.line).padStart(4)} │ ${b.hash} │ ${b.author.padEnd(15)} │ ${b.content}`)
            }
            if (blame.length > 50) output.push(`\n... and ${blame.length - 50} more lines`)
            return {
              title: `Git Blame: ${file}`,
              metadata: { lines: blame.length },
              output: output.join("\n"),
            }
          }

          if (params.operation === "commit") {
            if (!params.message) {
              return {
                title: "Git Commit",
                metadata: { error: true } as Tool.Metadata,
                output: "Error: 'message' parameter is required for commit operation.",
              }
            }
            yield* ctx.ask({
              permission: "git-commit",
              patterns: [`git commit -m "${params.message}"`],
              always: ["git"],
              metadata: { message: params.message, files: params.files },
            })

            const stageCmd = params.files?.length
              ? `git add ${params.files.join(" ")}`
              : "git add -A"
            const stageResult = yield* exec(stageCmd, cwd)
            if (stageResult.code !== 0) {
              return {
                title: "Git Commit",
                metadata: { error: true } as Tool.Metadata,
                output: `Stage error: ${stageResult.stderr}`,
              }
            }

            const { stdout, stderr, code } = yield* exec(
              `git commit -m "${params.message.replace(/"/g, '\\"')}"`,
              cwd,
            )
            if (code !== 0) {
              return {
                title: "Git Commit",
                metadata: { error: true } as Tool.Metadata,
                output: `Commit error: ${stderr}`,
              }
            }
            return {
              title: "Git Commit",
              metadata: { message: params.message },
              output: `Committed successfully:\n${stdout}`,
            }
          }

          if (params.operation === "branch") {
            if (!params.branch) {
              const { stdout, stderr, code } = yield* exec("git branch", cwd)
              if (code !== 0) {
                return {
                  title: "Git Branch",
                  metadata: { error: true } as Tool.Metadata,
                  output: `Error: ${stderr}`,
                }
              }
              const branches = stdout
                .split("\n")
                .map((b) => b.trim())
                .filter(Boolean)
              const output: string[] = ["# Git Branches", ""]
              for (const b of branches) {
                output.push(`- ${b.startsWith("*") ? `**${b}**` : b}`)
              }
              return {
                title: "Git Branches",
                metadata: { count: branches.length },
                output: output.join("\n"),
              }
            }

            const { stdout: checkOut } = yield* exec("git branch --list", cwd)
            const exists = checkOut.includes(params.branch)
            if (exists) {
              const { stdout, stderr, code } = yield* exec(`git checkout ${params.branch}`, cwd)
              if (code !== 0) {
                return {
                  title: "Git Branch",
                  metadata: { error: true } as Tool.Metadata,
                  output: `Error switching branch: ${stderr}`,
                }
              }
              return {
                title: "Git Branch",
                metadata: { action: "checkout", branch: params.branch },
                output: `Switched to branch: ${params.branch}\n${stdout}`,
              }
            } else {
              const { stdout, stderr, code } = yield* exec(`git checkout -b ${params.branch}`, cwd)
              if (code !== 0) {
                return {
                  title: "Git Branch",
                  metadata: { error: true } as Tool.Metadata,
                  output: `Error creating branch: ${stderr}`,
                }
              }
              return {
                title: "Git Branch",
                metadata: { action: "create", branch: params.branch },
                output: `Created and switched to new branch: ${params.branch}\n${stdout}`,
              }
            }
          }

          return {
            title: "Git",
            metadata: { error: true } as Tool.Metadata,
            output: `Unknown operation: ${params.operation}`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
