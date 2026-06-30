import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { execSync } from "child_process"
import fs from "fs"

interface ChangelogEntry {
  hash: string
  date: string
  author: string
  type: string
  scope: string
  message: string
}

export const ChangelogCommand = cmd({
  command: "changelog",
  describe: "Git commit'lerinden otomatik CHANGELOG olustur",
  builder: (yargs: Argv) => {
    return yargs
      .option("from", {
        alias: "f",
        describe: "Baslangic tag/commit (varsayilan: son tag)",
        type: "string",
      })
      .option("to", {
        alias: "t",
        describe: "Bitis tag/commit (varsayilan: HEAD)",
        type: "string",
        default: "HEAD",
      })
      .option("output", {
        alias: "o",
        describe: "Cikis dosyasi (varsayilan: stdout)",
        type: "string",
      })
      .option("format", {
        describe: "Cikis formati",
        type: "string",
        choices: ["markdown", "conventional", "json"],
        default: "markdown",
      })
      .option("authors", {
        describe: "Yazarlari dahil et",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const s = require("@clack/prompts").spinner()
      s.start("Changelog olusturuluyor...")

      let fromRef = args.from as string | undefined
      if (!fromRef) {
        try {
          fromRef = execSync("git describe --tags --abbrev=0", { encoding: "utf-8" }).trim()
        } catch {
          const firstCommit = execSync("git rev-list --max-parents=0 HEAD", { encoding: "utf-8" }).trim()
          fromRef = firstCommit.substring(0, 7)
        }
      }

      const toRef = args.to as string
      const logFormat = "%H|%ad|%an|%s"
      const rawLog = execSync(`git log ${fromRef}..${toRef} --pretty=format:"${logFormat}" --date=short`, {
        encoding: "utf-8",
      })

      if (!rawLog.trim()) {
        s.stop(`${fromRef}..${toRef} arasinda commit bulunamadi.`)
        return
      }

      const entries: ChangelogEntry[] = rawLog
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash, date, author, ...msgParts] = line.split("|")
          const message = msgParts.join("|")
          const { type, scope } = parseConventionalCommit(message)
          return {
            hash: hash.substring(0, 7),
            date,
            author,
            type,
            scope,
            message,
          }
        })

      s.stop(`${entries.length} commit bulundu.`)

      let output: string
      switch (args.format) {
        case "json":
          output = JSON.stringify(entries, null, 2)
          break
        case "conventional":
          output = formatConventional(entries, fromRef, toRef, args.authors as boolean)
          break
        default:
          output = formatMarkdown(entries, fromRef, toRef, args.authors as boolean)
      }

      if (args.output) {
        fs.writeFileSync(args.output as string, output, "utf-8")
        console.log(`Changelog ${args.output} dosyasina yazildi.`)
      } else {
        console.log(output)
      }
    })
  },
})

function parseConventionalCommit(message: string): { type: string; scope: string } {
  const match = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)/)
  if (match) {
    return { type: match[1], scope: match[2] || "" }
  }
  return { type: "other", scope: "" }
}

function formatMarkdown(entries: ChangelogEntry[], from: string, to: string, showAuthors: boolean): string {
  const lines: string[] = []
  lines.push(`# Changelog\n`)
  lines.push(`## ${from} → ${to}\n`)

  const groups: Record<string, ChangelogEntry[]> = {}
  const typeOrder = ["feat", "fix", "refactor", "perf", "test", "docs", "style", "chore", "ci", "other"]

  for (const e of entries) {
    const group = typeOrder.includes(e.type) ? e.type : "other"
    if (!groups[group]) groups[group] = []
    groups[group].push(e)
  }

  const typeLabels: Record<string, string> = {
    feat: "Features",
    fix: "Bug Fixes",
    refactor: "Refactoring",
    perf: "Performance",
    test: "Tests",
    docs: "Documentation",
    style: "Styles",
    chore: "Chores",
    ci: "CI",
    other: "Other",
  }

  for (const type of typeOrder) {
    const group = groups[type]
    if (!group || group.length === 0) continue

    lines.push(`### ${typeLabels[type] || type}\n`)
    for (const e of group) {
      const scope = e.scope ? `**${e.scope}:** ` : ""
      const author = showAuthors ? ` (${e.author})` : ""
      lines.push(`- ${scope}${e.message.replace(/^\w+(\([^)]*\))?:\s*/, "")} \`${e.hash}\`${author}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

function formatConventional(entries: ChangelogEntry[], from: string, to: string, showAuthors: boolean): string {
  const lines: string[] = []
  lines.push(`# Changelog\n`)
  lines.push(`## [Unreleased] (${from}..${to})\n`)

  const groups: Record<string, ChangelogEntry[]> = {}
  for (const e of entries) {
    if (!groups[e.type]) groups[e.type] = []
    groups[e.type].push(e)
  }

  for (const [type, group] of Object.entries(groups)) {
    lines.push(`### ${type}`)
    for (const e of group) {
      const scope = e.scope ? `(${e.scope})` : ""
      const author = showAuthors ? ` — ${e.author}` : ""
      lines.push(`* ${type}${scope}: ${e.message.replace(/^\w+(\([^)]*\))?:\s*/, "")}${author}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}
