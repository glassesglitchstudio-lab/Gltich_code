import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { Session } from "../../session"
import { Database } from "../../storage"
import { SessionTable } from "../../session/session.sql"
import { AppRuntime } from "@/effect/app-runtime"

interface CostEntry {
  sessionID: string
  title: string
  totalTokens: number
  totalCost: number
  model: string
  createdAt: number
}

export const CostCommand = cmd({
  command: "cost",
  describe: "Token/maliyet takibi ve ozet raporlama",
  builder: (yargs: Argv) => {
    return yargs
      .option("days", {
        alias: "d",
        describe: "Son N gun icin (varsayilan: 7)",
        type: "number",
        default: 7,
      })
      .option("format", {
        alias: "f",
        describe: "Cikis formati",
        type: "string",
        choices: ["table", "json", "summary"],
        default: "table",
      })
      .option("model", {
        alias: "m",
        describe: "Sadece belirli modeli goster",
        type: "string",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const days = args.days as number
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

      const rows = Database.use((db) => db.select().from(SessionTable).all())
      const sessions = rows.map((row) => Session.fromRow(row)).filter((s) => s.time.updated >= cutoff)

      if (sessions.length === 0) {
        console.log(`Son ${days} gunda hicbir oturum bulunamadi.`)
        return
      }

      const entries: CostEntry[] = []
      for (const session of sessions) {
        let totalTokens = 0
        let totalCost = 0
        let model = "bilinmiyor"

        try {
          const messages = await AppRuntime.runPromise(
            Session.Service.use((svc: any) => svc.messages({ sessionID: session.id, agentID: "*" })),
          )
          for (const msg of messages as Array<{ info?: { tokens?: { input?: number; output?: number; reasoning?: number }; cost?: number; model?: string } }>) {
            const info = msg.info
            if (info?.tokens) {
              totalTokens += (info.tokens.input ?? 0) + (info.tokens.output ?? 0) + (info.tokens.reasoning ?? 0)
            }
            totalCost += info?.cost ?? 0
            if (info?.model) model = info.model
          }
        } catch (err) { console.warn('[cli.cost] session message fetch error:', err) }

        entries.push({
          sessionID: session.id,
          title: session.title || "Basliksiz",
          totalTokens,
          totalCost,
          model,
          createdAt: session.time.created,
        })
      }

      const filtered = args.model
        ? entries.filter((e) => e.model.toLowerCase().includes((args.model as string).toLowerCase()))
        : entries

      const totalTokens = filtered.reduce((sum, e) => sum + e.totalTokens, 0)
      const totalCost = filtered.reduce((sum, e) => sum + e.totalCost, 0)
      const avgTokens = filtered.length > 0 ? Math.round(totalTokens / filtered.length) : 0
      const avgCost = filtered.length > 0 ? totalCost / filtered.length : 0

      const modelStats: Record<string, { tokens: number; cost: number; count: number }> = {}
      for (const e of filtered) {
        if (!modelStats[e.model]) modelStats[e.model] = { tokens: 0, cost: 0, count: 0 }
        modelStats[e.model].tokens += e.totalTokens
        modelStats[e.model].cost += e.totalCost
        modelStats[e.model].count++
      }

      switch (args.format) {
        case "json":
          console.log(JSON.stringify({ days, totalTokens, totalCost, sessions: filtered, modelStats }, null, 2))
          break
        case "summary":
          printSummary(filtered, modelStats, days, totalTokens, totalCost)
          break
        default:
          printTable(filtered, modelStats, days, totalTokens, totalCost, avgTokens, avgCost)
      }
    })
  },
})

function printSummary(entries: CostEntry[], modelStats: Record<string, any>, days: number, totalTokens: number, totalCost: number) {
  console.log("\n" + "═".repeat(50))
  console.log("  GLITCH COST - MALIYET OZETI")
  console.log("═".repeat(50))
  console.log(`\nDonem: Son ${days} gun`)
  console.log(`Toplam Oturum: ${entries.length}`)
  console.log(`Toplam Token: ${totalTokens.toLocaleString()}`)
  console.log(`Toplam Maliyet: $${totalCost.toFixed(4)}`)
  console.log(`Gunluk Ortalama: $${(totalCost / days).toFixed(4)}`)

  console.log(`\nModel Dagilimi:`)
  for (const [model, stats] of Object.entries(modelStats)) {
    const pct = totalTokens > 0 ? ((stats.tokens / totalTokens) * 100).toFixed(1) : "0"
    console.log(`  ${model}: ${stats.tokens.toLocaleString()} token ($${stats.cost.toFixed(4)}) [%${pct}]`)
  }
  console.log("\n" + "═".repeat(50))
}

function printTable(entries: CostEntry[], modelStats: Record<string, any>, days: number, totalTokens: number, totalCost: number, avgTokens: number, avgCost: number) {
  console.log("\n" + "═".repeat(80))
  console.log("  GLITCH COST - MALIYET RAPORU")
  console.log("═".repeat(80))
  console.log(`\nDonem: Son ${days} gun | Oturum: ${entries.length}`)
  console.log(`Toplam: ${totalTokens.toLocaleString()} token | $${totalCost.toFixed(4)}`)
  console.log(`Ortalama: ${avgTokens.toLocaleString()} token/oturum | $${avgCost.toFixed(4)}/oturum\n`)

  const sorted = [...entries].sort((a, b) => b.totalCost - a.totalCost)
  const top = sorted.slice(0, 10)

  console.log("  En Maliyetli 10 Oturum:")
  console.log("  " + "─".repeat(76))
  for (const e of top) {
    const title = e.title.substring(0, 35).padEnd(35)
    const tokens = e.totalTokens.toLocaleString().padStart(8)
    const cost = `$${e.totalCost.toFixed(4)}`.padStart(10)
    console.log(`  ${title} ${tokens} tok ${cost}`)
  }

  console.log(`\n  Model Dagilimi:`)
  console.log("  " + "─".repeat(76))
  for (const [model, stats] of Object.entries(modelStats)) {
    const pct = totalTokens > 0 ? ((stats.tokens / totalTokens) * 100).toFixed(1) : "0"
    console.log(`  ${model.padEnd(30)} ${stats.tokens.toLocaleString().padStart(10)} token  %${pct}`)
  }
  console.log("\n" + "═".repeat(80))
}
