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
import fs from "fs"
import path from "path"
import { homedir } from "os"

interface BenchResult {
  model: string
  provider: string
  prompt: string
  response: string
  tokens: number
  duration: number
  tokensPerSecond: number
  responseLength: number
  cost: number
  score: number
}

interface ModelRef {
  providerID: ProviderID
  modelID: string
  model: LanguageModel
}

interface LeaderboardEntry {
  provider: string
  model: string
  avgTokensPerSecond: number
  avgScore: number
  totalTests: number
  avgCost: number
  avgLatency: number
}

const BENCH_HISTORY_DIR = path.join(homedir(), ".glitchcode", "bench-history")
const LEADERBOARD_FILE = path.join(BENCH_HISTORY_DIR, "leaderboard.json")

function loadLeaderboard(): LeaderboardEntry[] {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      return JSON.parse(fs.readFileSync(LEADERBOARD_FILE, "utf8"))
    }
  } catch {}
  return []
}

function saveLeaderboard(entries: LeaderboardEntry[]) {
  try {
    fs.mkdirSync(BENCH_HISTORY_DIR, { recursive: true })
    entries.sort((a, b) => b.avgScore - a.avgScore || b.avgTokensPerSecond - a.avgTokensPerSecond)
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2), "utf8")
  } catch {}
}

function updateLeaderboard(results: BenchResult[]) {
  const leaderboard = loadLeaderboard()
  const grouped: Record<string, BenchResult[]> = {}
  for (const r of results) {
    const key = `${r.provider}/${r.model}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(r)
  }
  for (const [key, group] of Object.entries(grouped)) {
    const [provider, model] = key.split("/")
    const existing = leaderboard.find(e => e.provider === provider && e.model === model)
    const entry: LeaderboardEntry = {
      provider, model,
      avgTokensPerSecond: group.reduce((a, b) => a + b.tokensPerSecond, 0) / group.length,
      avgScore: group.reduce((a, b) => a + b.score, 0) / group.length,
      totalTests: (existing?.totalTests || 0) + group.length,
      avgCost: group.reduce((a, b) => a + b.cost, 0) / group.length,
      avgLatency: group.reduce((a, b) => a + b.duration, 0) / group.length,
    }
    if (existing) {
      Object.assign(existing, entry)
      existing.totalTests = (existing.totalTests || 0) + group.length
    } else {
      leaderboard.push(entry)
    }
  }
  saveLeaderboard(leaderboard)
}

function estimateCost(provider: string, model: string, tokens: number): number {
  const rates: Record<string, number> = {
    "openai/gpt-4o": 0.00001,
    "openai/gpt-4o-mini": 0.0000015,
    "anthropic/claude-sonnet-4-20250514": 0.000015,
    "anthropic/claude-haiku": 0.0000025,
    "google/gemini-2.0-flash": 0.0000005,
    "google/gemini-2.0-pro": 0.00001,
    "deepseek/deepseek-chat": 0.000002,
    "mistral/mistral-large": 0.000008,
    "groq/llama-3.3-70b": 0.000001,
  }
  const rate = rates[`${provider}/${model}`] || 0.000005
  return tokens * rate
}

export const BenchCommand = cmd({
  command: "bench",
  aliases: ["benchmark-models", "leaderboard"],
  describe: "Multi-model benchmark + leaderboard",
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
        describe: "Karsilastirilacak modeller (virgullu, max 10)",
        type: "array",
      })
      .option("rounds", {
        alias: "r",
        describe: "Her model icin kac tur",
        type: "number",
        default: 1,
      })
      .option("format", {
        alias: "f",
        describe: "Cikis formati",
        type: "string",
        choices: ["table", "json", "markdown", "html", "leaderboard"],
        default: "table",
      })
      .option("max-tokens", {
        describe: "Maks token siniri",
        type: "number",
        default: 1024,
      })
      .option("save", {
        describe: "Sonuclari leaderboard'a kaydet",
        type: "boolean",
        default: true,
      })
  },
  handler: async (args) => {
    if (args.format === "leaderboard") {
      showLeaderboard()
      return
    }

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

              const selectedModels = selectBenchModels(args.models as string[] | undefined, providers, 10)
              if (selectedModels.length === 0) {
                s.stop("Model bulunamadi.")
                return
              }

              s.message(`${selectedModels.length} model test ediliyor...`)
              const rounds = args.rounds as number
              const prompt = args.prompt as string
              const maxOutputTokens = args.maxOutputTokens as number || args.maxTokens as number

              const allResults: BenchResult[] = []

              for (const m of selectedModels) {
                s.message(`Test: ${m.providerID}/${m.modelID}`)

                for (let r = 0; r < rounds; r++) {
                  const start = Date.now()
                  try {
                    const result = yield* Effect.promise(() =>
                      generateText({
                        model: m.model,
                        messages: [{ role: "user", content: prompt }],
                        maxOutputTokens,
                      }),
                    )

                    const duration = Date.now() - start
                    const tokens = result.usage?.totalTokens || result.text.length / 4
                    const tokensPerSecond = tokens / (duration / 1000)
                    const score = evaluateBenchResult(result.text, prompt)

                    allResults.push({
                      model: m.modelID,
                      provider: m.providerID as string,
                      prompt,
                      response: result.text,
                      tokens: Math.round(tokens),
                      duration,
                      tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
                      responseLength: result.text.length,
                      cost: estimateCost(m.providerID as string, m.modelID, Math.round(tokens)),
                      score,
                    })

                    s.message(`  ${m.modelID}: ${Math.round(tokensPerSecond)} tok/s, ${Math.round(tokens)} token, ${score}/100`)
                  } catch (err: any) {
                    s.message(`  ${m.modelID}: HATA - ${err.message}`)
                    allResults.push({
                      model: m.modelID,
                      provider: m.providerID as string,
                      prompt,
                      response: "",
                      tokens: 0,
                      duration: Date.now() - start,
                      tokensPerSecond: 0,
                      responseLength: 0,
                      cost: 0,
                      score: 0,
                    })
                  }
                }
              }

              if (args.save) {
                updateLeaderboard(allResults)
              }

              s.stop(`Benchmark tamamlandi! ${selectedModels.length} model, ${rounds} tur`)

              switch (args.format) {
                case "json":
                  printBenchJSON(allResults, prompt, rounds)
                  break
                case "markdown":
                  printBenchMarkdown(allResults, prompt, rounds)
                  break
                case "html":
                  printBenchHTML(allResults, prompt, rounds)
                  break
                default:
                  printBenchTable(allResults, prompt, rounds)
              }
            }),
          )
        },
      })
    })
  },
})

function selectBenchModels(inputModels: string[] | undefined, providers: Record<string, any>, maxModels = 10): ModelRef[] {
  if (inputModels && inputModels.length > 0) {
    return inputModels.slice(0, maxModels).map((m) => {
      const [provider, model] = m.includes("/") ? m.split("/", 2) : ["auto", m]
      const pid = ProviderID.make(provider)
      const providerData = providers[pid]
      const modelData = providerData?.models?.[model]
      return { providerID: pid, modelID: model, model: modelData as LanguageModel }
    }).filter((m) => m.model)
  }

  const allModels: ModelRef[] = []
  for (const [pid, provider] of Object.entries(providers)) {
    const providerID = ProviderID.make(pid)
    for (const [modelID, model] of Object.entries(provider.models ?? {})) {
      allModels.push({ providerID, modelID, model: model as LanguageModel })
    }
  }

  const selected: ModelRef[] = []
  const seen = new Set<string>()
  const preferred = ["claude-sonnet", "gpt-4o", "gemini", "deepseek", "mistral-large", "llama", "command", "mixtral"]

  for (const pref of preferred) {
    for (const m of allModels) {
      const key = `${m.providerID}/${m.modelID}`.toLowerCase()
      if (!seen.has(key) && key.includes(pref)) {
        seen.add(key)
        selected.push(m)
        if (selected.length >= maxModels) return selected
      }
    }
  }

  for (const m of allModels) {
    const key = `${m.providerID}/${m.modelID}`.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      selected.push(m)
      if (selected.length >= maxModels) break
    }
  }

  return selected
}

function evaluateBenchResult(response: string, prompt: string): number {
  let score = 50
  if (response.length > 50) score += 5
  if (response.length > 200) score += 5
  if (response.includes("```")) score += 10
  if (response.includes("function") || response.includes("class") || response.includes("const")) score += 5
  if (response.includes("import") || response.includes("require")) score += 5
  if (response.includes("error") || response.includes("catch") || response.includes("try")) score += 5
  if (response.includes("test") || response.includes("example")) score += 5
  if (response.includes("explain") || response.includes("aciklama") || response.includes("örnek")) score += 5
  const codeBlocks = (response.match(/```/g) || []).length
  if (codeBlocks >= 2) score += 5
  if (response.includes(prompt.substring(0, 20))) score += 5
  return Math.min(100, Math.max(0, score))
}

function showLeaderboard() {
  const entries = loadLeaderboard()
  if (entries.length === 0) {
    console.log("\n  Leaderboard bos. Once 'glitch bench --prompt ...' calistirin.\n")
    return
  }

  console.log("\n" + "=".repeat(80))
  console.log("  PROVIDER BENCHMARK LEADERBOARD")
  console.log("=".repeat(80))
  console.log(`  ${"SIRALAMA".padEnd(4)} ${"PROVIDER/MODEL".padEnd(30)} ${"SKOR".padEnd(6)} ${"TOK/S".padEnd(8)} ${"LATENCY".padEnd(9)} ${"COST".padEnd(10)} ${"TEST".padEnd(5)}`)
  console.log("-".repeat(80))

  const sorted = [...entries].sort((a, b) => b.avgScore - a.avgScore || b.avgTokensPerSecond - a.avgTokensPerSecond)
  sorted.forEach((e, i) => {
    const rank = (i + 1).toString()
    const name = `${e.provider}/${e.model}`
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : rank.padStart(2)
    console.log(`  ${medal} ${name.padEnd(30)} ${e.avgScore.toFixed(1).padStart(5)} ${e.avgTokensPerSecond.toFixed(1).padStart(7)} ${e.avgLatency.toFixed(0).padStart(7)}ms ${"$" + e.avgCost.toFixed(5).padStart(8)} ${e.totalTests.toString().padStart(4)}`)
  })

  console.log("=".repeat(80))
  console.log(`  Toplam: ${entries.length} model, ${entries.reduce((a, e) => a + e.totalTests, 0)} test\n`)
}

function printBenchTable(results: BenchResult[], prompt: string, rounds: number) {
  console.log("\n" + "=".repeat(80))
  console.log("  BENCHMARK SONUCLARI")
  console.log("=".repeat(80))
  console.log(`  Prompt: ${prompt.substring(0, 60)}${prompt.length > 60 ? "..." : ""}`)
  console.log(`  Rounds: ${rounds}`)
  console.log("-".repeat(80))
  console.log(`  ${"MODEL".padEnd(30)} ${"TOKENS".padEnd(8)} ${"SURESI".padEnd(8)} ${"TOK/S".padEnd(9)} ${"SKOR".padEnd(6)} ${"COST".padEnd(10)}`)
  console.log("-".repeat(80))

  const modelStats: Record<string, BenchResult[]> = {}
  for (const r of results) {
    const key = `${r.provider}/${r.model}`
    if (!modelStats[key]) modelStats[key] = []
    modelStats[key].push(r)
  }

  const sorted = Object.entries(modelStats).sort((a, b) => {
    const avgA = a[1].reduce((s, r) => s + r.tokensPerSecond, 0) / a[1].length
    const avgB = b[1].reduce((s, r) => s + r.tokensPerSecond, 0) / b[1].length
    return avgB - avgA
  })

  let fastest = ""
  let fastestSpeed = 0

  for (const [name, group] of sorted) {
    const avgTokens = Math.round(group.reduce((s, r) => s + r.tokens, 0) / group.length)
    const avgDuration = Math.round(group.reduce((s, r) => s + r.duration, 0) / group.length)
    const avgTps = group.reduce((s, r) => s + r.tokensPerSecond, 0) / group.length
    const avgScore = Math.round(group.reduce((s, r) => s + r.score, 0) / group.length)
    const avgCost = group.reduce((s, r) => s + r.cost, 0) / group.length

    if (avgTps > fastestSpeed) {
      fastestSpeed = avgTps
      fastest = name
    }

    const tpsStr = `${avgTps.toFixed(1)} tok/s`
    const costStr = `$${avgCost.toFixed(5)}`
    console.log(`  ${name.padEnd(30)} ${avgTokens.toString().padEnd(8)} ${(avgDuration + "ms").padEnd(8)} ${tpsStr.padEnd(9)} ${avgScore.toString().padEnd(6)} ${costStr.padEnd(10)}`)
  }

  console.log("-".repeat(80))
  console.log(`  En hizli: ${fastest} (${fastestSpeed.toFixed(1)} tok/s)`)
  console.log("=".repeat(80) + "\n")
}

function printBenchJSON(results: BenchResult[], prompt: string, rounds: number) {
  console.log(JSON.stringify({ prompt, rounds, results, timestamp: new Date().toISOString() }, null, 2))
}

function printBenchMarkdown(results: BenchResult[], prompt: string, rounds: number) {
  console.log(`# Benchmark Raporu\n`)
  console.log(`**Prompt:** ${prompt}\n`)
  console.log(`**Rounds:** ${rounds}\n`)
  console.log(`| Model | Tokens | Sure | Tok/s | Skor | Cost |`)
  console.log(`|-------|--------|------|-------|------|------|`)

  const modelStats: Record<string, BenchResult[]> = {}
  for (const r of results) {
    const key = `${r.provider}/${r.model}`
    if (!modelStats[key]) modelStats[key] = []
    modelStats[key].push(r)
  }

  for (const [name, group] of Object.entries(modelStats)) {
    const avgTokens = Math.round(group.reduce((s, r) => s + r.tokens, 0) / group.length)
    const avgDuration = Math.round(group.reduce((s, r) => s + r.duration, 0) / group.length)
    const avgTps = (group.reduce((s, r) => s + r.tokensPerSecond, 0) / group.length).toFixed(1)
    const avgScore = Math.round(group.reduce((s, r) => s + r.score, 0) / group.length)
    const avgCost = group.reduce((s, r) => s + r.cost, 0) / group.length
    console.log(`| ${name} | ${avgTokens} | ${avgDuration}ms | ${avgTps} | ${avgScore} | $${avgCost.toFixed(5)} |`)
  }
}

function printBenchHTML(results: BenchResult[], prompt: string, rounds: number) {
  const modelStats: Record<string, BenchResult[]> = {}
  for (const r of results) {
    const key = `${r.provider}/${r.model}`
    if (!modelStats[key]) modelStats[key] = []
    modelStats[key].push(r)
  }

  const rows = Object.entries(modelStats)
    .sort((a, b) => {
      const avgB = b[1].reduce((s, r) => s + r.tokensPerSecond, 0) / b[1].length
      const avgA = a[1].reduce((s, r) => s + r.tokensPerSecond, 0) / a[1].length
      return avgB - avgA
    })
    .map(([name, group], i) => {
      const avgTokens = Math.round(group.reduce((s, r) => s + r.tokens, 0) / group.length)
      const avgDuration = Math.round(group.reduce((s, r) => s + r.duration, 0) / group.length)
      const avgTps = (group.reduce((s, r) => s + r.tokensPerSecond, 0) / group.length).toFixed(1)
      const avgScore = Math.round(group.reduce((s, r) => s + r.score, 0) / group.length)
      const avgCost = group.reduce((s, r) => s + r.cost, 0) / group.length
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : ""
      return `<tr>
        <td>${medal} ${escapeHtml(name)}</td>
        <td>${avgTokens}</td>
        <td>${avgDuration}ms</td>
        <td>${avgTps}</td>
        <td><div class="bar"><div class="fill" style="width:${avgScore}%"></div></div></td>
        <td>$${avgCost.toFixed(5)}</td>
      </tr>`
    }).join("\n")

  console.log(`<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>Benchmark - Glitch Code</title>
<style>
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#121218; color:#e0e0e0; padding:2rem; }
h1 { color:#FF6B00; }
table { width:100%; border-collapse:collapse; margin-top:1rem; }
th { background:#1a1a24; color:#FF6B00; padding:0.8rem; text-align:left; border-bottom:2px solid #FF6B00; }
td { padding:0.6rem 0.8rem; border-bottom:1px solid #2a2a3a; }
tr:hover { background:#1e1e2a; }
.bar { background:#333; border-radius:4px; height:6px; width:80px; }
.fill { background:#FF6B00; height:100%; border-radius:4px; }
.meta { color:#666; font-size:0.85rem; }
</style>
</head>
<body>
<h1>⚡ Benchmark Sonuclari</h1>
<p class="meta">Prompt: ${escapeHtml(prompt)} | Rounds: ${rounds}</p>
<table>
<tr><th>Model</th><th>Token</th><th>Süre</th><th>Tok/s</th><th>Skor</th><th>Cost</th></tr>
${rows}
</table>
</body>
</html>`)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
