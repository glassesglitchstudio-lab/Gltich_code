import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import { AppRuntime } from "@/effect/app-runtime"
import { execSync } from "child_process"

interface ReviewResult {
  file: string
  issues: ReviewIssue[]
  score: number
}

interface ReviewIssue {
  severity: "error" | "warning" | "info"
  line?: number
  message: string
  suggestion?: string
}

export const ReviewCommand = cmd({
  command: "review",
  describe: "Otomatik PR/kod incelemesi",
  builder: (yargs: Argv) => {
    return yargs
      .option("pr", {
        describe: "PR numarasi (GitHub'dan)",
        type: "number",
      })
      .option("branch", {
        describe: "Incelenecek branch (varsayilan: mevcut)",
        type: "string",
      })
      .option("files", {
        alias: "f",
        describe: "Belirli dosyalari incele",
        type: "array",
      })
      .option("format", {
        describe: "Cikis formati",
        type: "string",
        choices: ["table", "json", "markdown"],
        default: "table",
      })
      .option("severity", {
        describe: "Minimum severity seviyesi",
        type: "string",
        choices: ["error", "warning", "info"],
        default: "info",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const s = require("@clack/prompts").spinner()
      s.start("Kod inceleniyor...")

      let files: string[] = []

      if (args.files) {
        files = args.files as string[]
      } else if (args.branch) {
        files = await getChangedFiles(args.branch)
      } else {
        files = await getChangedFiles("HEAD")
      }

      if (files.length === 0) {
        s.stop("Inlenecek dosya bulunamadi.")
        return
      }

      const results: ReviewResult[] = []

      for (const file of files) {
        if (!file.endsWith(".ts") && !file.endsWith(".tsx") && !file.endsWith(".js") && !file.endsWith(".jsx")) {
          continue
        }

        const issues = await reviewFile(file)
        if (issues.length > 0) {
          const score = calculateScore(issues)
          results.push({ file, issues, score })
        }
      }

      s.stop(`Inceleme tamamlandi: ${results.length} dosya`)

      switch (args.format) {
        case "json":
          console.log(JSON.stringify(results, null, 2))
          break
        case "markdown":
          printMarkdown(results)
          break
        default:
          printTable(results, args.severity)
      }
    })
  },
})

async function getChangedFiles(ref: string): Promise<string[]> {
  try {
    const stdout = execSync(`git diff --name-only ${ref}~1 ${ref}`, { encoding: "utf-8" })
    return stdout.trim().split("\n").filter(Boolean)
  } catch {
    try {
      const stdout = execSync("git diff --name-only HEAD", { encoding: "utf-8" })
      return stdout.trim().split("\n").filter(Boolean)
    } catch {
      return []
    }
  }
}

async function reviewFile(filePath: string): Promise<ReviewIssue[]> {
  const issues: ReviewIssue[] = []

  try {
    const fs = require("fs")
    if (!fs.existsSync(filePath)) return issues

    const content = fs.readFileSync(filePath, "utf-8")
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      if (line.length > 120) {
        issues.push({
          severity: "warning",
          line: lineNum,
          message: `Satir cok uzun (${line.length} karakter)`,
          suggestion: "Maksimum 120 karakter onerilir",
        })
      }

      if (line.includes("any") && line.includes(":")) {
        issues.push({
          severity: "warning",
          line: lineNum,
          message: "'any' tipi kullanilmis",
          suggestion: "Daha spesifik bir tip kullanin",
        })
      }

      if (line.includes("console.log") && !filePath.includes("test")) {
        issues.push({
          severity: "info",
          line: lineNum,
          message: "console.log kullanilmis",
          suggestion: "Production'da logging kutuphanesi kullanin",
        })
      }

      if (line.includes("TODO") || line.includes("FIXME") || line.includes("HACK")) {
        issues.push({
          severity: "info",
          line: lineNum,
          message: "Bitirilmemis isaret bulundu",
        })
      }

      if (line.includes("eval(")) {
        issues.push({
          severity: "error",
          line: lineNum,
          message: "eval() kullanilmis - guvenlik riski",
          suggestion: "Guvenli alternatifler kullanin",
        })
      }

      if (line.match(/password|secret|api[_-]?key/i) && line.includes("=")) {
        issues.push({
          severity: "error",
          line: lineNum,
          message: "Hassas bilgi kod icinde olabilir",
          suggestion: "Ortam degiskenleri veya .env dosyasi kullanin",
        })
      }
    }
  } catch {}

  return issues
}

function calculateScore(issues: ReviewIssue[]): number {
  let score = 100
  for (const issue of issues) {
    switch (issue.severity) {
      case "error":
        score -= 15
        break
      case "warning":
        score -= 5
        break
      case "info":
        score -= 1
        break
    }
  }
  return Math.max(0, score)
}

function printTable(results: ReviewResult[], minSeverity: string) {
  const severityOrder = { error: 0, warning: 1, info: 2 }
  const minOrder = severityOrder[minSeverity as keyof typeof severityOrder]

  console.log("\n🔍 KOD INCELEME RAPORU\n")

  let totalIssues = 0
  let totalScore = 0

  for (const result of results) {
    const filteredIssues = result.issues.filter(
      (i) => severityOrder[i.severity] <= minOrder,
    )

    if (filteredIssues.length === 0) continue

    console.log(`📄 ${result.file} (Skor: ${result.score}/100)`)
    console.log("─".repeat(50))

    for (const issue of filteredIssues) {
      const icon = issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️"
      const lineInfo = issue.line ? ` Satir ${issue.line}:` : ""
      console.log(`  ${icon}${lineInfo} ${issue.message}`)
      if (issue.suggestion) {
        console.log(`     💡 ${issue.suggestion}`)
      }
      totalIssues++
    }

    console.log()
    totalScore += result.score
  }

  const avgScore = results.length > 0 ? totalScore / results.length : 100

  console.log("═".repeat(50))
  console.log(`\n📊 OZET`)
  console.log(`   Toplam Dosya: ${results.length}`)
  console.log(`   Toplam Sorun: ${totalIssues}`)
  console.log(`   Ortalama Skor: ${avgScore.toFixed(0)}/100`)
  console.log()
}

function printMarkdown(results: ReviewResult[]) {
  console.log("# 🔍 Kod Inceleme Raporu\n")

  for (const result of results) {
    console.log(`## 📄 ${result.file}`)
    console.log(`**Skor:** ${result.score}/100\n`)

    for (const issue of result.issues) {
      const icon = issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️"
      const lineInfo = issue.line ? ` (Satir ${issue.line})` : ""
      console.log(`- ${icon} **${issue.severity.toUpperCase()}${lineInfo}:** ${issue.message}`)
      if (issue.suggestion) {
        console.log(`  - 💡 ${issue.suggestion}`)
      }
    }

    console.log()
  }
}
