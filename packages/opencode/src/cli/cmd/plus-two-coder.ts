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
}

interface ModelRef {
  providerID: ProviderID
  modelID: string
  model: LanguageModel
}

export const PlusTwoCoderCommand = cmd({
  command: "plus-two-coder",
  aliases: ["ptc", "debate"],
  describe: "2-3 model birbiriyle tartisarak kod cozumu uretsin",
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
        describe: "Kullanilacak modeller (virgullu, max 3, orn: anthropic/claude-sonnet-4-20250514,openai/gpt-4o)",
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
        choices: ["terminal", "json", "markdown"],
        default: "terminal",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const s = require("@clack/prompts").spinner()
      s.start("PlusTwoCoder baslatiliyor...")

      await Instance.provide({
        directory: process.cwd(),
        async fn() {
          await AppRuntime.runPromise(
            Effect.gen(function* () {
              const svc = yield* Provider.Service
              const providers = yield* svc.list()

              const selectedModels = selectModels(args.models as string[] | undefined, providers)
              if (selectedModels.length < 2) {
                s.stop("En az 2 model secilmeli.")
                return
              }

              s.message(`Modeller: ${selectedModels.map((m) => `${m.providerID}/${m.modelID}`).join(", ")}`)
              s.message(`Gorev: ${args.task}`)
              s.message(`Tartisma turlari: ${args.rounds}`)

              const rounds: DebateRound[] = []
              let currentContext = args.task as string
              let previousScores: number[] = []

              for (let round = 0; round < (args.rounds as number); round++) {
                s.message(`\n--- TUR ${round + 1} ---`)

                const opinions: CoderOpinion[] = []

                for (let i = 0; i < selectedModels.length; i++) {
                  const m = selectedModels[i]
                  s.message(`${m.providerID}/${m.modelID} dusuncesini paylasiyor...`)

                  const prompt = round === 0
                    ? buildInitialPrompt(args.task as string)
                    : buildDebatePrompt(args.task as string, opinions, currentContext)

                  const solution = yield* Effect.promise(() =>
                    generateText({
                      model: m.model,
                      messages: [{ role: "user", content: prompt }],
                    }),
                  )

                  // Cross-critique: bir sonraki model eleştirsin
                  const nextModel = selectedModels[(i + 1) % selectedModels.length]
                  const critiqueResult = yield* Effect.promise(() =>
                    generateText({
                      model: nextModel.model,
                      messages: [{ role: "user", content: buildCritiquePrompt(args.task as string, solution.text) }],
                    }),
                  )

                  // Cross-scoring: 3. model puanlasın (self-scoring yerine)
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

                  s.message(`${m.modelID} skoru: ${score}/100`)
                }

                opinions.sort((a, b) => b.score - a.score)
                rounds.push({ round: round + 1, opinions })

                // Convergence check: skorlar yakin ise erken dur
                const currentScores = opinions.map((o) => o.score)
                if (round > 0 && previousScores.length > 0) {
                  const avgPrev = previousScores.reduce((a, b) => a + b, 0) / previousScores.length
                  const avgCurr = currentScores.reduce((a, b) => a + b, 0) / currentScores.length
                  const diff = Math.abs(avgPrev - avgCurr)
                  if (diff < 5) {
                    s.message(`\nSkorlar yaklasti (fark: ${diff.toFixed(1)}), tartisma erken sonlandirildi.`)
                    break
                  }
                }
                previousScores = currentScores

                currentContext = buildConsensusContext(opinions)
              }

              const lastRound = rounds[rounds.length - 1]
              const opinionsSummary = lastRound.opinions
                .map((o) => `${o.provider}/${o.model} (Skor: ${o.score}):\n${o.solution.substring(0, 300)}`)
                .join("\n\n")

              const consensusPrompt = `Sen bir kod uzmani moderatörüsün. Tum modellerin goruslerini inceledin.

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

              s.stop("Tartisma tamamlandi!")

              switch (args.format) {
                case "json":
                  printJSON(rounds, args.task as string)
                  break
                case "markdown":
                  printMarkdown(rounds, args.task as string)
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

export function selectModels(inputModels: string[] | undefined, providers: Record<string, any>): ModelRef[] {
  if (inputModels && inputModels.length >= 2) {
    return inputModels.slice(0, 3).map((m) => {
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

  for (const m of allModels) {
    const key = `${m.providerID}/${m.modelID}`.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      selected.push(m)
      if (selected.length >= 3) break
    }
  }

  if (selected.length < 2) {
    for (const m of allModels) {
      if (!selected.some((s) => s.providerID === m.providerID && s.modelID === m.modelID)) {
        selected.push(m)
        if (selected.length >= 2) break
      }
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
  // JSON format: {"score": N} or {score: N}
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

  // Markdown/text patterns
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
- Kod dogrulugu ve calisirligi (30 puan) — kod calisir mi? Mantiksal hata var mi?
- Performans ve verimlilik (20 puan) — gereksiz dongu, bellek sizi var mi?
- Guvenlik ve dayaniklilik (20 puan) — SQL injection, XSS, hata yonetimi var mi?
- Kod kalitesi ve okunabilirlik (15 puan) — isimlendirme, yapi, yorumlar
- Tamlik ve kapsam (15 puan) — gorevin tum gereksinimlerini karsiliyor mu?

Dikkat:
- Sadece JSON formatinda cevap ver
- Extra metin yazma
- Skoru adil ve katı degerlendir

SADECE su JSON formatinda cevap ver:
{"score": N}

N = 0-100 arasi tam sayi`

  try {
    const result = await generateText({
      model: scorerModel,
      messages: [{ role: "user", content: prompt }],
    })
    const parsed = parseLLMScore(result.text)
    if (parsed !== null) return parsed
  } catch (err) {
    console.warn(`LLM skorlama basarisiz, keyword fallback kullaniliyor: ${err instanceof Error ? err.message : String(err)}`)
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

function printTerminal(rounds: DebateRound[], task: string) {
  console.log("\n" + "=".repeat(60))
  console.log("  PLUS TWOCODER - MODEL TARTISMA OTURUMU")
  console.log("=".repeat(60))
  console.log(`\nGOREV: ${task}\n`)

  for (const round of rounds) {
    console.log(`\n${"-".repeat(60)}`)
    console.log(`  TUR ${round.round}`)
    console.log("-".repeat(60))

    for (const opinion of round.opinions) {
      const bar = "#".repeat(Math.floor(opinion.score / 5)) + ".".repeat(20 - Math.floor(opinion.score / 5))
      console.log(`\n  [AI] ${opinion.provider}/${opinion.model}`)
      console.log(`  Skor: [${bar}] ${opinion.score}/100`)
      console.log(`\n  Cozum:`)
      const solutionLines = opinion.solution.split("\n")
      console.log(`  ${solutionLines.slice(0, 15).join("\n  ")}${solutionLines.length > 15 ? "\n  ... (devami var)" : ""}`)
      console.log(`\n  Elestiri (ozet):`)
      const critiqueLines = opinion.critique.split("\n").filter(l => l.trim())
      console.log(`  ${critiqueLines.slice(0, 8).join("\n  ")}`)
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
        })),
        consensus: rounds[rounds.length - 1]?.consensus,
      },
      null,
      2,
    ),
  )
}

function printMarkdown(rounds: DebateRound[], task: string) {
  console.log(`# PlusTwoCoder Tartisma Raporu\n`)
  console.log(`**Gorev:** ${task}\n`)

  for (const round of rounds) {
    console.log(`## Tur ${round.round}\n`)

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
