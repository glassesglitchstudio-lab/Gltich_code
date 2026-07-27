import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { getCostRouter, CostRouter, type TaskType } from "../../provider/cost-router"
import { AppRuntime } from "@/effect/app-runtime"
import { Instance } from "../../project/instance"
import { Provider } from "../../provider"
import { Effect } from "effect"

export const CostRouterCommand = cmd({
  command: "cost-router",
  aliases: ["router", "smart-route"],
  describe: "Akilli provider/router yoneticisi - en uygun modeli onerir",
  builder: (yargs: Argv) => {
    return yargs
      .command(RouterRecommendCommand)
      .command(RouterStatsCommand)
      .command(RouterSetRateCommand)
      .command(RouterClearCommand)
      .demandCommand()
  },
  handler: async () => {},
})

export const RouterRecommendCommand = cmd({
  command: "recommend <task-type>",
  describe: "Verilen gorev tipi icin en iyi modeli oner",
  builder: (yargs: Argv) => {
    return yargs
      .positional("task-type", {
        describe: "Gorev tipi: code, reasoning, planning, review, debug, explore, chat",
        type: "string",
        choices: ["code", "reasoning", "planning", "review", "debug", "explore", "chat", "other"],
        demandOption: true,
      })
      .option("prompt", {
        alias: "p",
        describe: "Detect task type from prompt text",
        type: "string",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const router = getCostRouter()
      let taskType = args.taskType as TaskType

      if (args.prompt) {
        taskType = CostRouter.detectTaskType(args.prompt as string)
        console.log(`Detected task type: ${taskType}\n`)
      }

      await Instance.provide({
        directory: process.cwd(),
        async fn() {
          await AppRuntime.runPromise(
            Effect.gen(function* () {
              const svc = yield* Provider.Service
              const providers = yield* svc.list()

              const available: Array<{ provider: string; model: string }> = []
              for (const [pid, provider] of Object.entries(providers)) {
                for (const [modelID] of Object.entries(provider.models ?? {})) {
                  available.push({ provider: pid as string, model: modelID })
                }
              }

              const recommendations = router.recommend(taskType, available)

              if (recommendations.length === 0) {
                console.log("No recommendations available. Configure a provider first.")
                return
              }

              console.log("\n" + "=".repeat(70))
              console.log(`  COST ROUTER - ${taskType.toUpperCase()} ONERILERI`)
              console.log("=".repeat(70))
              console.log(`  ${"SIRA".padEnd(5)} ${"PROVIDER/MODEL".padEnd(35)} ${"CONF".padEnd(6)} ${"COST".padEnd(10)} ${"SURE".padEnd(8)}`)
              console.log("-".repeat(70))

              recommendations.forEach((rec, i) => {
                const rank = (i + 1).toString()
                const name = `${rec.provider}/${rec.model}`
                const conf = (rec.confidence * 100).toFixed(0) + "%"
                const cost = "$" + rec.estimatedCost.toFixed(6)
                const dur = rec.estimatedDuration.toFixed(0) + "ms"
                console.log(`  ${rank.padEnd(4)} ${name.padEnd(35)} ${conf.padEnd(6)} ${cost.padEnd(10)} ${dur.padEnd(8)}`)
                console.log(`       ${"→".padEnd(4)} ${rec.reason}`)
              })

              const best = recommendations[0]
              if (best) {
                console.log("\n" + "-".repeat(70))
                console.log(`  🏆 En iyi secim: ${best.provider}/${best.model}`)
                console.log(`     Guven: ${(best.confidence * 100).toFixed(0)}% | Tahmini cost: $${best.estimatedCost.toFixed(6)}`)
              }

              console.log("=".repeat(70) + "\n")
            }),
          )
        },
      })
    })
  },
})

export const RouterStatsCommand = cmd({
  command: "stats",
  describe: "Cost router istatistiklerini goster",
  handler: async () => {
    const router = getCostRouter()
    const stats = router.getStats()

    console.log("\n" + "=".repeat(60))
    console.log("  COST ROUTER ISTATISTIKLERI")
    console.log("=".repeat(60))
    console.log(`  Toplam harcama: $${stats.totalCost.toFixed(4)}`)
    console.log(`  Toplam token:   ${stats.totalTokens.toLocaleString()}`)
    console.log(`  Ortalama hiz:   ${stats.averageSpeed.toFixed(1)} tok/s`)
    console.log("-".repeat(60))

    for (const [provider, data] of Object.entries(stats.byProvider)) {
      console.log(`  ${provider.padEnd(20)} $${data.cost.toFixed(4)} | ${data.tokens.toLocaleString().padStart(10)} token | ${data.calls} cagri`)
    }

    console.log("=".repeat(60) + "\n")
  },
})

export const RouterSetRateCommand = cmd({
  command: "set-rate <provider> <model> <rate>",
  describe: "Model rate'ini (token basina $) ayarla",
  builder: (yargs: Argv) => {
    return yargs
      .positional("provider", { describe: "Provider adi", type: "string", demandOption: true })
      .positional("model", { describe: "Model adi", type: "string", demandOption: true })
      .positional("rate", { describe: "Token basina USD rate", type: "number", demandOption: true })
  },
  handler: async (args) => {
    const router = getCostRouter()
    router.setRate(args.provider as string, args.model as string, args.rate as number)
    console.log(`Rate set: ${args.provider}/${args.model} = $${args.rate}/token`)
  },
})

export const RouterClearCommand = cmd({
  command: "clear",
  describe: "Cost history'yi temizle",
  handler: async () => {
    const router = getCostRouter()
    router.clearHistory()
    console.log("Cost history cleared.")
  },
})
