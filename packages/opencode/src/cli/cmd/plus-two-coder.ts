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

export interface CoderOpinion {
  model: string
  provider: string
  solution: string
  critique: string
  score: number
}

export interface DebateRound {
  round: number
  opinions: CoderOpinion[]
  consensus?: string
  voteResults?: VoteResult[]
}

export interface VoteResult {
  model: string
  provider: string
  votedFor: string
  reason: string
}

interface ModelRef {
  providerID: ProviderID
  modelID: string
  model: LanguageModel
}

const DEBATE_HISTORY_DIR = path.join(homedir(), ".glitchcode", "debate-history")

function saveDebateResult(task: string, rounds: DebateRound[], models: string[]) {
  try {
    fs.mkdirSync(DEBATE_HISTORY_DIR, { recursive: true })
    const filename = `debate-${Date.now()}.json`
    const data = JSON.stringify({ task, models, rounds, timestamp: new Date().toISOString() }, null, 2)
    fs.writeFileSync(path.join(DEBATE_HISTORY_DIR, filename), data, "utf8")
  } catch {}
}

export const PlusTwoCoderCommand = cmd({
  command: "plus-two-coder",
  aliases: ["ptc", "debate"],
  describe: "N-Way AI Debate: 2-5 model tartisarak en iyi cozumu uretir",
  builder: (yargs: Argv) => {
    return yargs
      .option("task", {
        alias: "t",
        describe: "Yapilacak gorev/kod istegi",
        type: "string",
        demandOption: true,
      })
      .option("models", {
        alias: "m",
        describe: "Kullanilacak modeller (virgullu, max 5, orn: anthropic/claude-sonnet-4-20250514,openai/gpt-4o)",
        type: "array",
      })
      .option("rounds", {
        alias: "r",
        describe: "Tartisma tur sayisi",
        type: "number",
        default: 2,
      })
      .option("format", {
        describe: "Cikis formati",
        type: "string",
        choices: ["terminal", "json", "markdown", "html"],
        default: "terminal",
      })
      .option("vote", {
        describe: "Oy verme mekanizmasi (consensus, majority, weighted)",
        type: "string",
        choices: ["consensus", "majority", "weighted", "none"],
        default: "weighted",
      })
      .option("max-models", {
        describe: "Maksimum model sayisi (2-5)",
        type: "number",
        default: 5,
      })
      .option("save", {
        describe: "Sonucu debate-history klasorune kaydet",
        type: "boolean",
        default: true,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const s = require("@clack/prompts").spinner()
      s.start("N-Way Debate baslatiliyor...")

      await Instance.provide({
        directory: process.cwd(),
        async fn() {
          await AppRuntime.runPromise(
            Effect.gen(function* () {
              const svc = yield* Provider.Service
              const providers = yield* svc.list()

              const maxModels = Math.min(Math.max(args.maxModels as number, 2), 5)
              const selectedModels = selectModels(args.models as string[] | undefined, providers, maxModels)
              if (selectedModels.length < 2) {
                s.stop("En az 2 model secilmeli.")
                return
              }

              s.message(`Modeller (${selectedModels.length}): ${selectedModels.map((m) => `${m.providerID}/${m.modelID}`).join(", ")}`)
              s.message(`Gorev: ${args.task}`)
              s.message(`Turlar: ${args.rounds} | Oy: ${args.vote}`)

              const rounds: DebateRound[] = []
              let currentContext = args.task as string
              let previousAvgScore = 0

              for (let round = 0; round < (args.rounds as number); round++) {
                s.message(`\n--- TUR ${round + 1} ---`)

                const opinions: CoderOpinion[] = []

                for (let i = 0; i < selectedModels.length; i++) {
                  const m = selectedModels[i]
                  s.message(`${m.providerID}/${m.modelID} cozum uretiyor...`)

                  const prompt = round === 0
                    ? buildInitialPrompt(args.task as string)
                    : buildDebatePrompt(args.task as string, opinions, currentContext)

                  const solution = yield* Effect.promise(() =>
                    generateText({
                      model: m.model,
                      messages: [{ role: "user", content: prompt }],
                    }),
                  )

                  const nextModel = selectedModels[(i + 1) % selectedModels.length]
                  const critiqueResult = yield* Effect.promise(() =>
                    generateText({
                      model: nextModel.model,
                      messages: [{ role: "user", content: buildCritiquePrompt(args.task as string, solution.text) }],
                    }),
                  )

                  const scorerModel = selectedModels[(i + 2) % selectedModels.length]
                  const score = yield* Effect.promise(() =>
                    scoreWithLLM({
                      solution: solution.text,
                      critique: critiqueResult.text,
                      task: args.task as string,
                      model: m.model,
                      scorer: scorerModel.model,
                    }),
                  )

                  opinions.push({
                    model: m.modelID,
                    provider: m.providerID as string,
                    solution: solution.text,
                    critique: critiqueResult.text,
                    score,
                  })

                  s.message(`  ${m.modelID}: ${score}/100`)
                }

                opinions.sort((a, b) => b.score - a.score)

                let voteResults: VoteResult[] | undefined
                const voteMode = args.vote as string
                if (voteMode !== "none") {
                  voteResults = yield* Effect.promise(() => runVote(args.task as string, opinions, selectedModels, voteMode))
                  if (voteResults) {
                    const sorted = [...voteResults].sort((a,b) => b.votedFor.localeCompare(a.votedFor))
                    const winner = sorted[0]?.votedFor
                    s.message(`  Kazanan: ${winner || "belirlenemedi"}`)
                  }
                }

                rounds.push({ round: round + 1, opinions, voteResults })

                const currentAvgScore = opinions.reduce((a, b) => a + b.score, 0) / opinions.length
                const diff = Math.abs(currentAvgScore - previousAvgScore)
                if (round > 0 && diff < 3) {
                  s.message(`Skorlar yaklasti (fark: ${diff.toFixed(1)}), erken sonlandirildi.`)
                  break
                }
                previousAvgScore = currentAvgScore

                currentContext = buildConsensusContext(opinions)
              }

              const lastRound = rounds[rounds.length - 1]
              const opinionsSummary = lastRound.opinions
                .map((o) => `${o.provider}/${o.model} (Skor: ${o.score}):\n${o.solution.substring(0, 300)}`)
                .join("\n\n")

              const consensusPrompt = `Sen bir AI moderatörüsün. ${selectedModels.length} modelin goruslerini inceledin.

GOREV: ${args.task}

TUM GORUSLER:
${opinionsSummary}

Simdi nihai konsensusu acikla. Her modelin guclu ve zayif yonlerini degerlendir.

Cevabini su formatta ver:
## Nihai Cozum
[final solution - tam kod]

## Model Karsilastirmasi
[Her modelin guclu ve zayif yonlerini kisa kisa listele]

## Neden Bu Cozum?
[Bu cozumun digerlerinden neden daha iyi oldugunu acikla]

## Uygulama Adimlari
[adim adim uygulama talimatlari - kod ornekleriyle]`

              const primary = selectedModels[0]
              const consensusResult = yield* Effect.promise(() =>
                generateText({
                  model: primary.model,
                  messages: [{ role: "user", content: consensusPrompt }],
                }),
              )

              lastRound.consensus = consensusResult.text

              s.stop(`Tartisma tamamlandi! ${selectedModels.length} model, ${rounds.length} tur`)

              if (args.save) {
                saveDebateResult(args.task as string, rounds, selectedModels.map(m => `${m.providerID}/${m.modelID}`))
              }

              switch (args.format) {
                case "json":
                  printJSON(rounds, args.task as string)
                  break
                case "markdown":
                  printMarkdown(rounds, args.task as string)
                  break
                case "html":
                  printHTML(rounds, args.task as string, selectedModels.map(m => `${m.providerID}/${m.modelID}`))
                  break
                default:
                  printTerminal(rounds, args.task as string)
              }
            }),
          )
        },
      })
    })
  },
})

export function selectModels(inputModels: string[] | undefined, providers: Record<string, any>, maxModels = 5): ModelRef[] {
  if (inputModels && inputModels.length >= 2) {
    return inputModels.slice(0, maxModels).map((m) => {
      const [provider, model] = m.includes("/") ? m.split("/", 2) : ["auto", m]
      const pid = ProviderID.make(provider)
      const providerData = providers[pid]
      const modelData = providerData?.models?.[model]
      return {
        providerID: pid,
        modelID: model,
        model: modelData as LanguageModel,
      }
    }).filter((m) => m.model)
  }

  const allModels: ModelRef[] = []
  for (const [pid, provider] of Object.entries(providers)) {
    const providerID = ProviderID.make(pid)
    for (const [modelID, model] of Object.entries(provider.models ?? {})) {
      allModels.push({
        providerID,
        modelID,
        model: model as LanguageModel,
      })
    }
  }

  if (allModels.length < 2) return allModels.slice(0, 2)

  const selected: ModelRef[] = []
  const seen = new Set<string>()
  const preferred = ["claude", "gpt", "gemini", "deepseek", "mistral"]

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

export function buildInitialPrompt(task: string): string {
  return `Sen bir uzman yazilimciisin. Asagidaki gorevi cozmek icin en iyi cozumu uret.

GOREV: ${task}

Kurallar:
- Cozumu acikla
- Neden bu yontemi sectigini belirt
- Potansiyel sorunlari belirt
- Alternatif yontemler de oner

Cevabini su formatta ver:
## Cozum
[your solution]

## Gerekce
[your reasoning]

## Alternatifler
[alternative approaches]`
}

export function buildDebatePrompt(task: string, previousOpinions: CoderOpinion[], context: string): string {
  const opinionsText = previousOpinions
    .map((o) => `### ${o.provider}/${o.model} (Skor: ${o.score})\n${o.solution}\nElestiri: ${o.critique}`)
    .join("\n\n")

  return `Sen bir uzman yazilimciisin. Diger modellerin cozumlerini inceledin ve elestirdin.
Simdi kendi en iyi cozumunu guncel baglamma gore uret.

GOREV: ${task}

ONCEKI COZUMLER VE ELESTIRILER:
${opinionsText}

GUNCEL BAGLAM:
${context}

Kurallar:
- Diger modellerin zayif yanlarini guclendir
- Daha iyi bir cozum uret
- Neden senin cozumun daha iyi oldugunu acikla

Cevabini su formatta ver:
## Cozum
[your improved solution]

## Neden Daha Iyi
[why this is better]

## Risk Analizi
[potential risks]`
}

export function buildCritiquePrompt(task: string, solution: string): string {
  return `Sen sert bir kod reviewcusun. Asagidaki cozumu elestir.

GOREV: ${task}
SUNULAN COZUM:
${solution}

Kurallar:
- Bulunabilir sorunlari belirt
- Performans sorunlarini acikla
- Guvenlik aciklarini kontrol et
- Kod kalitesini degerlendir

Cevabini su formatta ver:
## Elestiri
[elestiri]

## Duzeltme Onerileri
[suggestions]

SKOR: Bu cozumu 0-100 arasi degerlendir. Asagidaki JSON formatinda cevap ver:
{"score": N}`
}

export function parseLLMScore(text: string): number | null {
  const jsonPatterns = [
    /\{\s*"score"\s*:\s*(\d{1,3})\s*\}/i,
    /\{\s*[^}]*"score"\s*:\s*(\d{1,3})[^}]*\}/i,
  ]
  for (const pattern of jsonPatterns) {
    const match = text.match(pattern)
    if (match) {
      const score = parseInt(match[1], 10)
      if (score >= 0 && score <= 100) return score
    }
  }
  const patterns = [
    /##?\s*Skor:\s*(\d{1,3})/i,
    /##?\s*Score:\s*(\d{1,3})/i,
    /##?\s*Puan:\s*(\d{1,3})/i,
    /(\d{1,3})\s*\/\s*100/,
    /##?\s*Rating:\s*(\d{1,3})/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const score = parseInt(match[1], 10)
      if (score >= 0 && score <= 100) return score
    }
  }
  return null
}

function keywordFallback(solution: string): number {
  let score = 40
  if (solution.includes("```")) score += 8
  if (solution.length > 200) score += 5
  if (solution.length > 500) score += 8
  if (solution.length > 1000) score += 5
  if (solution.includes("import ") || solution.includes("require(")) score += 5
  if (solution.includes("function ") || solution.includes("const ") || solution.includes("class ")) score += 5
  if (solution.includes("try") || solution.includes("catch") || solution.includes("error")) score += 5
  if (solution.includes("export ") || solution.includes("module.exports")) score += 3
  if (solution.includes("performans") || solution.includes("performance") || solution.includes("optimize")) score += 3
  if (solution.includes("guvenlik") || solution.includes("security") || solution.includes("sanitize")) score += 3
  if (solution.includes("test") || solution.includes("spec") || solution.includes("describe(")) score += 3
  if (solution.includes("type") || solution.includes("interface") || solution.includes(": ")) score += 3
  if (solution.length < 100) score -= 10
  if (!solution.includes("```") && !solution.includes("function") && !solution.includes("class")) score -= 5
  return Math.max(0, Math.min(100, score))
}

export function evaluateSolution(solution: string, llmScoreText?: string | null): number {
  if (llmScoreText) {
    const parsed = parseLLMScore(llmScoreText)
    if (parsed !== null) return parsed
  }
  return keywordFallback(solution)
}

export async function scoreWithLLM(params: {
  solution: string
  critique: string
  task: string
  model: LanguageModel
  scorer?: LanguageModel
}): Promise<number> {
  const scorerModel = params.scorer ?? params.model

  const prompt = `Sen bir kod kalitesi degerlendiricisin. Asagidaki cozumu ve elestiriyi incele.

GOREV: ${params.task}

ONERILEN COZUM:
${params.solution.substring(0, 2000)}

ELESTIRI:
${params.critique.substring(0, 1000)}

Bu cozumu degerlendir. Su kriterlere gore 0-100 arasi skor ver:
- Kod dogrulugu ve calisirligi (30 puan)
- Performans ve verimlilik (20 puan)
- Guvenlik ve dayaniklilik (20 puan)
- Kod kalitesi ve okunabilirlik (15 puan)
- Tamlik ve kapsam (15 puan)

SADECE su JSON formatinda cevap ver:
{"score": N}`

  try {
    const result = await generateText({
      model: scorerModel,
      messages: [{ role: "user", content: prompt }],
    })
    const parsed = parseLLMScore(result.text)
    if (parsed !== null) return parsed
  } catch {
    return keywordFallback(params.solution)
  }
  return keywordFallback(params.solution)
}

export function buildConsensusContext(opinions: CoderOpinion[]): string {
  const best = opinions[0]
  const worst = opinions[opinions.length - 1]
  return `En iyi cozum: ${best.provider}/${best.model} (Skor: ${best.score})
En zayif cozum: ${worst.provider}/${worst.model} (Skor: ${worst.score})

En iyi cozumun ozeti:
${best.solution.substring(0, 500)}

En iyi elestiri:
${best.critique.substring(0, 300)}`
}

async function runVote(task: string, opinions: CoderOpinion[], models: ModelRef[], mode: string): Promise<VoteResult[]> {
  const results: VoteResult[] = []

  for (const opinion of opinions) {
    const model = models.find(m => m.modelID === opinion.model)
    if (!model) continue

    if (mode === "weighted") {
      results.push({
        model: opinion.model,
        provider: opinion.provider,
        votedFor: opinions[0].model,
        reason: `Weighted score: ${opinion.score} (highest: ${opinions[0].score} by ${opinions[0].model})`
      })
      continue
    }

    try {
      const votePrompt = `Bir AI modeli olarak diger cozumleri degerlendiriyorsun.

GOREV: ${task}

COZUMLER:
${opinions.map((o, i) => `[${i}] ${o.provider}/${o.model} (Skor: ${o.score}):
${o.solution.substring(0, 500)}`).join("\n\n")}

En iyi cozumu sec. SADECE JSON formatinda cevap ver:
{"vote": N, "reason": "short reason"}
N = 0-${opinions.length - 1} arasi index`
      const result = await generateText({
        model: model.model,
        messages: [{ role: "user", content: votePrompt }],
      })

      const voteMatch = result.text.match(/\{\s*"vote"\s*:\s*(\d+)\s*/i)
      const reasonMatch = result.text.match(/"reason"\s*:\s*"([^"]+)"/i)
      const voteIndex = voteMatch ? parseInt(voteMatch[1]) : 0
      const votedFor = opinions[Math.min(voteIndex, opinions.length - 1)]?.model || opinions[0].model

      results.push({
        model: opinion.model,
        provider: opinion.provider,
        votedFor,
        reason: reasonMatch?.[1] || "best solution",
      })
    } catch {
      results.push({
        model: opinion.model,
        provider: opinion.provider,
        votedFor: opinions[0].model,
        reason: "fallback to highest score",
      })
    }
  }

  return results
}

function printTerminal(rounds: DebateRound[], task: string) {
  console.log("\n" + "=".repeat(60))
  console.log("  N-WAY DEBATE - MODEL TARTISMA OTURUMU")
  console.log("=".repeat(60))
  console.log(`\nGOREV: ${task}\n`)

  for (const round of rounds) {
    console.log(`\n${"-".repeat(60)}`)
    console.log(`  TUR ${round.round}`)
    console.log("-".repeat(60))

    if (round.voteResults) {
      const voteCounts: Record<string, number> = {}
      for (const v of round.voteResults) {
        voteCounts[v.votedFor] = (voteCounts[v.votedFor] || 0) + 1
      }
      const winner = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]
      if (winner) {
        console.log(`  Oylama: Kazanan ${winner[0]} (${winner[1]} oy)\n`)
      }
    }

    for (const opinion of round.opinions) {
      const bar = "#".repeat(Math.floor(opinion.score / 5)) + ".".repeat(20 - Math.floor(opinion.score / 5))
      console.log(`  [AI] ${opinion.provider}/${opinion.model}`)
      console.log(`  Skor: [${bar}] ${opinion.score}/100`)
      const solutionLines = opinion.solution.split("\n")
      console.log(`  Cozum: ${solutionLines.slice(0, 10).join("\n  ")}${solutionLines.length > 10 ? "\n  ..." : ""}`)
    }
  }

  if (rounds.length > 0 && rounds[rounds.length - 1].consensus) {
    console.log(`\n${"=".repeat(60)}`)
    console.log("  Nihai Konsensus")
    console.log("=".repeat(60))
    console.log(`\n${rounds[rounds.length - 1].consensus}`)
  }

  console.log("\n" + "=".repeat(60))
  console.log("  OTURUM SONU")
  console.log("=".repeat(60) + "\n")
}

function printJSON(rounds: DebateRound[], task: string) {
  console.log(
    JSON.stringify(
      {
        task,
        rounds: rounds.map((r) => ({
          round: r.round,
          opinions: r.opinions.map((o) => ({
            model: o.model,
            provider: o.provider,
            score: o.score,
            solution: o.solution,
            critique: o.critique,
          })),
          voteResults: r.voteResults,
        })),
        consensus: rounds[rounds.length - 1]?.consensus,
      },
      null,
      2,
    ),
  )
}

function printMarkdown(rounds: DebateRound[], task: string) {
  console.log(`# N-Way Debate Raporu\n`)
  console.log(`**Gorev:** ${task}\n`)
  console.log(`**Turlar:** ${rounds.length}\n`)

  for (const round of rounds) {
    console.log(`## Tur ${round.round}\n`)

    if (round.voteResults) {
      console.log(`### Oylama Sonuclari\n`)
      const voteCounts: Record<string, number> = {}
      for (const v of round.voteResults) {
        voteCounts[v.votedFor] = (voteCounts[v.votedFor] || 0) + 1
      }
      for (const [model, count] of Object.entries(voteCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`- **${model}**: ${count} oy`)
      }
      console.log()
    }

    for (const opinion of round.opinions) {
      console.log(`### ${opinion.provider}/${opinion.model} (Skor: ${opinion.score}/100)\n`)
      console.log(`**Cozum:**\n\`\`\`\n${opinion.solution}\n\`\`\`\n`)
      console.log(`**Elestiri:**\n${opinion.critique}\n`)
    }
  }

  if (rounds.length > 0 && rounds[rounds.length - 1].consensus) {
    console.log(`## Nihai Konsensus\n`)
    console.log(rounds[rounds.length - 1].consensus)
  }
}

function printHTML(rounds: DebateRound[], task: string, models: string[]) {
  const consensus = rounds[rounds.length - 1]?.consensus || ""
  const roundsHtml = rounds.map((r, ri) => `
    <div class="round">
      <h2>Tur ${r.round}</h2>
      ${r.voteResults ? `
      <div class="vote-results">
        <h3>Oylama</h3>
        <ul>
          ${Object.entries(
            r.voteResults.reduce((acc, v) => {
              acc[v.votedFor] = (acc[v.votedFor] || 0) + 1
              return acc
            }, {} as Record<string, number>)
          ).sort((a, b) => b[1] - a[1]).map(([model, count]) => `<li><strong>${model}</strong>: ${count} oy</li>`).join("")}
        </ul>
      </div>` : ""}
      ${r.opinions.map(o => `
      <div class="opinion">
        <div class="opinion-header">
          <span class="model">${o.provider}/${o.model}</span>
          <span class="score">${o.score}/100</span>
        </div>
        <div class="bar"><div class="bar-fill" style="width:${o.score}%"></div></div>
        <details>
          <summary>Cozum</summary>
          <pre>${escapeHtml(o.solution)}</pre>
        </details>
        <details>
          <summary>Elestiri</summary>
          <pre>${escapeHtml(o.critique)}</pre>
        </details>
      </div>`).join("")}
    </div>`).join("")

  console.log(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>N-Way Debate - Glitch Code</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#121218; color:#e0e0e0; padding:2rem; }
h1 { color:#FF6B00; font-size:1.8rem; margin-bottom:0.5rem; }
h2 { color:#FF8C40; margin:1.5rem 0 0.5rem; }
h3 { color:#aaa; margin:0.5rem 0; font-size:0.9rem; text-transform:uppercase; }
.round { background:#1a1a24; border:1px solid #FF6B0033; border-radius:12px; padding:1.5rem; margin:1rem 0; }
.opinion { background:#22222e; border-radius:8px; padding:1rem; margin:0.5rem 0; }
.opinion-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; }
.model { color:#FF6B00; font-weight:bold; }
.score { color:#4caf50; font-size:1.2rem; font-weight:bold; }
.bar { background:#333; border-radius:4px; height:8px; margin-bottom:0.5rem; overflow:hidden; }
.bar-fill { background:#FF6B00; height:100%; border-radius:4px; transition:width 0.5s; }
details { margin-top:0.5rem; }
summary { cursor:pointer; color:#888; font-weight:bold; }
pre { background:#0d0d14; border-radius:6px; padding:0.8rem; overflow-x:auto; margin-top:0.3rem; font-size:0.85rem; }
.vote-results { background:#1e1e2a; border-radius:8px; padding:0.8rem; margin-bottom:0.5rem; }
.vote-results ul { list-style:none; display:flex; gap:1rem; }
.vote-results li { background:#2a2a3a; padding:0.3rem 0.8rem; border-radius:6px; }
.consensus { background:#1a1a24; border:1px solid #4caf50; border-radius:12px; padding:1.5rem; margin:1rem 0; }
.consensus h2 { color:#4caf50; }
.meta { color:#666; font-size:0.85rem; margin-bottom:1rem; }
footer { text-align:center; color:#444; margin-top:2rem; font-size:0.8rem; }
</style>
</head>
<body>
<h1>🔮 N-Way Debate</h1>
<p class="meta">Gorev: ${escapeHtml(task)} | Modeller: ${models.join(", ")} | ${rounds.length} tur</p>
${roundsHtml}
<div class="consensus">
<h2>Nihai Konsensus</h2>
<pre>${escapeHtml(consensus)}</pre>
</div>
<footer>Generated by Glitch Code N-Way Debate</footer>
</body>
</html>`)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
