import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { AppRuntime } from "@/effect/app-runtime"
import { Instance } from "../../project/instance"
import { Provider } from "../../provider"
import { ProviderID } from "../../provider/schema"
import { Effect } from "effect"
import { generateText } from "ai"
import type { LanguageModel } from "ai"

interface BenchResult {
  model: string
  provider: string
  prompt: string
  response: string
  tokens: number
  duration: number
  tokensPerSecond: number
  responseLength: number
}

interface ModelRef {
  providerID: ProviderID
  modelID: string
  model: LanguageModel
}

export const BenchCommand = cmd({
  command: "bench",
  aliases: ["benchmark-models"],
  describe: "Ayni gorevi farkli modellere calistir ve karsilastir",
  builder: (yargs: Argv) => {
    return yargs
      .option("prompt", {
        alias: "p",
        describe: "Test prompt'u",
        type: "string",
        demandOption: true,
      })
      .option("models", {
        alias: "m",
        describe: "Karsilastirilacak modeller (virgullu)",
        type: "array",
      })
      .option("rounds", {
        alias: "r",
        describe: "Her model icin test tur sayisi",
        type: "number",
        default: 1,
      })
      .option("format", {
        alias: "f",
        describe: "Cikis formati",
        type: "string",
        choices: ["table", "json", "markdown"],
        default: "table",
      })
      .option("max-tokens", {
        describe: "Maksimum token siniri",
        type: "number",
        default: 1024,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const s = require("@clack/prompts").spinner()
      s.start("Benchmark baslatiliyor...")

      await Instance.provide({
        directory: process.cwd(),
        async fn() {
          await AppRuntime.runPromise(
            Effect.gen(function* () {
              const svc = yield* Provider.Service
              const providers = yield* svc.list()

              let selectedModels: ModelRef[] = []

              if (args.models && (args.models as string[]).length > 0) {
                selectedModels = (args.models as string[]).slice(0, 5).map((m) => {
                  const [provider, model] = m.includes("/") ? m.split("/", 2) : ["auto", m]
                  const pid = ProviderID.make(provider)
                  const providerData = providers[pid]
                  const modelData = providerData?.models?.[model]
                  return { providerID: pid, modelID: model, model: modelData as unknown as LanguageModel }
                }).filter((m) => m.model)
              } else {
                const allModels: ModelRef[] = []
                for (const [pid, provider] of Object.entries(providers)) {
                  const providerID = ProviderID.make(pid)
                  for (const [modelID, model] of Object.entries((provider as { models?: Record<string, unknown> }).models ?? {})) {
                    allModels.push({ providerID, modelID, model: model as unknown as LanguageModel })
                  }
                }
                const preferred = ["claude-sonnet", "gpt-4o", "gemini", "mimo"]
                for (const pref of preferred) {
                  if (selectedModels.length >= 3) break
                  const found = allModels.find((m) => m.modelID.toLowerCase().includes(pref))
                  if (found && !selectedModels.some((s) => s.modelID === found.modelID)) {
                    selectedModels.push(found)
                  }
                }
                for (const m of allModels) {
                  if (selectedModels.length >= 3) break
                  if (!selectedModels.some((s) => s.modelID === m.modelID)) {
                    selectedModels.push(m)
                  }
                }
              }

              if (selectedModels.length < 2) {
                s.stop("En az 2 model gerekli.")
                return
              }

              s.message(`Modeller: ${selectedModels.map((m) => `${m.providerID}/${m.modelID}`).join(", ")}`)
              s.message(`Prompt: ${(args.prompt as string).substring(0, 80)}...`)
              s.message(`Tur sayisi: ${args.rounds}`)

              const results: BenchResult[] = []
              const rounds = args.rounds as number

              for (let round = 0; round < rounds; round++) {
                s.message(`\n--- TUR ${round + 1}/${rounds} ---`)

                for (const m of selectedModels) {
                  s.message(`${m.modelID} calistiriliyor...`)

                  const startTime = Date.now()
                  try {
                    const result = yield* Effect.promise(() =>
                      generateText({
                        model: m.model,
                        messages: [{ role: "user", content: args.prompt as string }],
                      }),
                    )
                    const duration = Date.now() - startTime
                    const tokens = (result.usage as { totalTokens?: number })?.totalTokens ?? result.text.split(/\s+/).length
                    const tokensPerSecond = duration > 0 ? Math.round((tokens / duration) * 1000) : 0

                    results.push({
                      model: m.modelID,
                      provider: m.providerID as string,
                      prompt: args.prompt as string,
                      response: result.text,
                      tokens,
                      duration,
                      tokensPerSecond,
                      responseLength: result.text.length,
                    })

                    s.message(`  ${m.modelID}: ${tokens} token, ${duration}ms, ${tokensPerSecond} tok/s`)
                  } catch (err) {
                    s.message(`  ${m.modelID}: HATA - ${err instanceof Error ? err.message : String(err)}`)
                    results.push({
                      model: m.modelID,
                      provider: m.providerID as string,
                      prompt: args.prompt as string,
                      response: `HATA: ${err instanceof Error ? err.message : String(err)}`,
                      tokens: 0,
                      duration: Date.now() - startTime,
                      tokensPerSecond: 0,
                      responseLength: 0,
                    })
                  }
                }
              }

              s.stop("Benchmark tamamlandi!")

              switch (args.format) {
                case "json":
                  console.log(JSON.stringify(results, null, 2))
                  break
                case "markdown":
                  printMarkdown(results, args.prompt as string, rounds)
                  break
                default:
                  printTable(results, args.prompt as string, rounds)
              }
            }),
          )
        },
      })
    })
  },
})

function printTable(results: BenchResult[], prompt: string, rounds: number) {
  console.log("\n" + "═".repeat(70))
  console.log("  GLITCH BENCH - MODEL KARSILASTIRMASI")
  console.log("═".repeat(70))
  console.log(`\nPrompt: ${prompt.substring(0, 60)}...`)
  console.log(`Tur: ${rounds}\n`)

  const modelStats: Record<string, { tokens: number; duration: number; tps: number; length: number; count: number; errors: number }> = {}
  for (const r of results) {
    const key = `${r.provider}/${r.model}`
    if (!modelStats[key]) modelStats[key] = { tokens: 0, duration: 0, tps: 0, length: 0, count: 0, errors: 0 }
    modelStats[key].tokens += r.tokens
    modelStats[key].duration += r.duration
    modelStats[key].tps += r.tokensPerSecond
    modelStats[key].length += r.responseLength
    modelStats[key].count++
    if (r.response.startsWith("HATA:")) modelStats[key].errors++
  }

  console.log("  Model".padEnd(35) + "Token".padStart(8) + "Sure".padStart(10) + "Tok/s".padStart(8) + "Uzunluk".padStart(10))
  console.log("  " + "─".repeat(68))

  const sorted = Object.entries(modelStats).sort((a, b) => b[1].tps - a[1].tps)
  for (const [model, stats] of sorted) {
    const avgTokens = Math.round(stats.tokens / stats.count)
    const avgDuration = Math.round(stats.duration / stats.count)
    const avgTps = Math.round(stats.tps / stats.count)
    const avgLength = Math.round(stats.length / stats.count)
    const errStr = stats.errors > 0 ? ` [HATA:${stats.errors}]` : ""

    console.log(
      `  ${model.substring(0, 33).padEnd(35)}` +
      `${avgTokens}`.padStart(8) +
      `${avgDuration}ms`.padStart(10) +
      `${avgTps}`.padStart(8) +
      `${avgLength}`.padStart(10) +
      errStr
    )
  }

  if (sorted.length > 0) {
    const fastest = sorted[0]
    console.log(`\n  En Hizli: ${fastest[0]} (${Math.round(fastest[1].tps / fastest[1].count)} tok/s)`)
  }

  console.log("\n" + "═".repeat(70))
}

function printMarkdown(results: BenchResult[], prompt: string, rounds: number) {
  console.log(`# Glitch Bench Raporu\n`)
  console.log(`**Prompt:** ${prompt}\n`)
  console.log(`**Tur:** ${rounds}\n`)

  const modelStats: Record<string, { tokens: number; duration: number; tps: number; count: number }> = {}
  for (const r of results) {
    const key = `${r.provider}/${r.model}`
    if (!modelStats[key]) modelStats[key] = { tokens: 0, duration: 0, tps: 0, count: 0 }
    modelStats[key].tokens += r.tokens
    modelStats[key].duration += r.duration
    modelStats[key].tps += r.tokensPerSecond
    modelStats[key].count++
  }

  console.log(`## Sonuclar\n`)
  console.log(`| Model | Ort. Token | Ort. Sure | Ort. Tok/s |`)
  console.log(`|-------|-----------|----------|-----------|`)

  for (const [model, stats] of Object.entries(modelStats)) {
    const avgTps = Math.round(stats.tps / stats.count)
    console.log(`| ${model} | ${Math.round(stats.tokens / stats.count)} | ${Math.round(stats.duration / stats.count)}ms | ${avgTps} |`)
  }
}
