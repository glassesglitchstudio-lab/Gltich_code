import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { Session } from "../../session"
import { bootstrap } from "../bootstrap"
import { Database } from "../../storage"
import { SessionTable } from "../../session/session.sql"
import { UI } from "../ui"
import { AppRuntime } from "@/effect/app-runtime"

interface BenchmarkResult {
  sessionID: string
  title: string
  totalTokens: number
  totalCost: number
  duration: number
  tokensPerSecond: number
  costPerToken: number
  toolCalls: number
  messages: number
}

export const BenchmarkCommand = cmd({
  command: "benchmark",
  describe: "Token/maliyet takibi ve performans metrikleri",
  builder: (yargs: Argv) => {
    return yargs
      .option("days", {
        describe: "Son N gun icin (varsayilan: tumu)",
        type: "number",
      })
      .option("top", {
        alias: "t",
        describe: "En iyi/kotu N session goster",
        type: "number",
        default: 5,
      })
      .option("format", {
        alias: "f",
        describe: "Cikis formati",
        type: "string",
        choices: ["table", "json", "csv"],
        default: "table",
      })
      .option("sort", {
        describe: "Siralama kriteri",
        type: "string",
        choices: ["cost", "tokens", "speed", "efficiency"],
        default: "cost",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const results = await runBenchmark(args.days)

      if (results.length === 0) {
        UI.println("Henuz session bulunmuyor.")
        return
      }

      switch (args.format) {
        case "json":
          console.log(JSON.stringify(results, null, 2))
          break
        case "csv":
          printCSV(results, args.sort, args.top)
          break
        default:
          printTable(results, args.sort, args.top)
      }
    })
  },
})

async function runBenchmark(days?: number): Promise<BenchmarkResult[]> {
  const MS_IN_DAY = 24 * 60 * 60 * 1000
  const cutoff = days ? Date.now() - days * MS_IN_DAY : 0

  const rows = Database.use((db) => db.select().from(SessionTable).all())
  const sessions = rows.map((row) => Session.fromRow(row)).filter((s) => s.time.updated >= cutoff)

  const results: BenchmarkResult[] = []

  for (const session of sessions) {
    const messages = await AppRuntime.runPromise(
      Session.Service.use((svc) => svc.messages({ sessionID: session.id, agentID: "*" })),
    )

    let totalTokens = 0
    let totalCost = 0
    let toolCalls = 0
    let firstTime = Infinity
    let lastTime = 0

    for (const msg of messages) {
      const info = msg.info as { tokens?: { input: number; output: number; reasoning?: number }; cost?: number }
      if (info.tokens) {
        totalTokens += info.tokens.input + info.tokens.output + (info.tokens.reasoning || 0)
      }
      totalCost += info.cost || 0

      for (const part of msg.parts) {
        if (part.type === "tool") toolCalls++
      }

      const msgTime = (msg as { time?: { created?: number } }).time?.created || Date.now()
      firstTime = Math.min(firstTime, msgTime)
      lastTime = Math.max(lastTime, msgTime)
    }

    const duration = (lastTime - firstTime) / 1000
    const tokensPerSecond = duration > 0 ? totalTokens / duration : 0
    const costPerToken = totalTokens > 0 ? totalCost / totalTokens : 0

    results.push({
      sessionID: session.id,
      title: session.title,
      totalTokens,
      totalCost,
      duration,
      tokensPerSecond,
      costPerToken,
      toolCalls,
      messages: messages.length,
    })
  }

  return results
}

function printTable(results: BenchmarkResult[], sort: string, top: number) {
  const sorted = sortResults(results, sort)
  const topResults = sorted.slice(0, top)

  const width = 70

  console.log("┌" + "─".repeat(width) + "┐")
  console.log(
    "│" + " BENCHMARK RAPORU".padEnd(width) + "│",
  )
  console.log("├" + "─".repeat(width) + "┤")
  console.log(
    "│" + ` Toplam: ${results.length} session`.padEnd(width) + "│",
  )
  console.log("└" + "─".repeat(width) + "┘")
  console.log()

  console.log("┌" + "─".repeat(width) + "┐")
  console.log(
    "│" + ` EN IYI ${top} (${sort.toUpperCase()})`.padEnd(width) + "│",
  )
  console.log("├" + "─".repeat(width) + "┤")

  for (const r of topResults) {
    const title = r.title.length > 25 ? r.title.substring(0, 22) + "..." : r.title
    console.log(
      "│" +
        ` ${title}`.padEnd(28) +
        ` ${formatTokens(r.totalTokens)} token`.padEnd(15) +
        ` $${r.totalCost.toFixed(2)}`.padEnd(10) +
        ` ${r.tokensPerSecond.toFixed(0)} t/s`.padEnd(12) +
        "│",
    )
  }

  console.log("└" + "─".repeat(width) + "┘")
  console.log()

  const totalTokens = results.reduce((a, r) => a + r.totalTokens, 0)
  const totalCost = results.reduce((a, r) => a + r.totalCost, 0)
  const avgTokensPerSession = totalTokens / results.length
  const avgCostPerSession = totalCost / results.length
  const avgTokensPerSecond =
    results.reduce((a, r) => a + r.tokensPerSecond, 0) / results.length

  console.log("┌" + "─".repeat(width) + "┐")
  console.log("│" + " OZET ISTATISTIKLER".padEnd(width) + "│")
  console.log("├" + "─".repeat(width) + "┤")
  console.log("│" + ` Toplam Token: ${formatTokens(totalTokens)}`.padEnd(width) + "│")
  console.log("│" + ` Toplam Maliyet: $${totalCost.toFixed(2)}`.padEnd(width) + "│")
  console.log("│" + ` Ortalama Token/Session: ${formatTokens(avgTokensPerSession)}`.padEnd(width) + "│")
  console.log("│" + ` Ortalama Maliyet/Session: $${avgCostPerSession.toFixed(4)}`.padEnd(width) + "│")
  console.log("│" + ` Ortalama Hiz: ${avgTokensPerSecond.toFixed(0)} token/saniye`.padEnd(width) + "│")
  console.log("└" + "─".repeat(width) + "┘")
}

function escapeCSV(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function printCSV(results: BenchmarkResult[], sort: string, top: number) {
  const sorted = sortResults(results, sort)
  const topResults = sorted.slice(0, top)

  console.log("session_id,title,total_tokens,total_cost,duration,tokens_per_second,cost_per_token,tool_calls,messages")
  for (const r of topResults) {
    console.log(
      `${r.sessionID},${escapeCSV(r.title)},${r.totalTokens},${r.totalCost.toFixed(4)},${r.duration.toFixed(1)},${r.tokensPerSecond.toFixed(2)},${r.costPerToken.toFixed(6)},${r.toolCalls},${r.messages}`,
    )
  }
}

function sortResults(results: BenchmarkResult[], sort: string): BenchmarkResult[] {
  switch (sort) {
    case "tokens":
      return [...results].sort((a, b) => b.totalTokens - a.totalTokens)
    case "speed":
      return [...results].sort((a, b) => b.tokensPerSecond - a.tokensPerSecond)
    case "efficiency":
      return [...results].sort((a, b) => a.costPerToken - b.costPerToken)
    case "cost":
    default:
      return [...results].sort((a, b) => b.totalCost - a.totalCost)
  }
}

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"
  if (n >= 1000) return (n / 1000).toFixed(1) + "K"
  return n.toString()
}
