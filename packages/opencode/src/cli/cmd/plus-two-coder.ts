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

              for (let round = 0; round < (args.rounds as number); round++) {
                s.message(`\n--- TUR ${round + 1} ---`)

                const opinions: CoderOpinion[] = []

                for (const m of selectedModels) {
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

                  const nextModel = selectedModels[(selectedModels.indexOf(m) + 1) % selectedModels.length]
                  const critiqueResult = yield* Effect.promise(() =>
                    generateText({
                      model: nextModel.model,
                      messages: [{ role: "user", content: buildCritiquePrompt(args.task as string, solution.text) }],
                    }),
                  )

                  const score = evaluateSolution(solution.text, critiqueResult.text)

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

Simdi nihai konsensusu acikla. En iyi cozumu sec ve neden digerlerinden daha iyi oldugunu acikla.

Cevabini su formatta ver:
## Nihai Cozum
[final solution]

## Konsensus Nedeni
[why this solution won]

## Uygulama Adimlari
[steps to implement]`

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

## Skor: [0-100]
[puan]

## Duzeltme Onerileri
[suggestions]`
}

export function parseLLMScore(text: string): number | null {
  const match = text.match(/##?\s*Skor:\s*(\d{1,3})/i)
  if (!match) return null
  const score = parseInt(match[1], 10)
  return score >= 0 && score <= 100 ? score : null
}

export function evaluateSolution(solution: string, llmScoreText?: string | null): number {
  if (llmScoreText) {
    const parsed = parseLLMScore(llmScoreText)
    if (parsed !== null) return parsed
  }
  let score = 50
  if (solution.includes("```")) score += 10
  if (solution.length > 200) score += 10
  if (solution.includes("performans") || solution.includes("performance")) score += 5
  if (solution.includes("guvenlik") || solution.includes("security")) score += 5
  if (solution.includes("test") || solution.includes("spec")) score += 5
  if (solution.includes("error") || solution.includes("hata")) score += 5
  if (solution.length > 500) score += 10
  return Math.min(100, score)
}

export function buildConsensusContext(opinions: CoderOpinion[]): string {
  const best = opinions[0]
  const worst = opinions[opinions.length - 1]

  return `En iyi cozum: ${best.provider}/${best.model} (Skor: ${best.score})
En zayif cozum: ${best.provider}/${worst.model} (Skor: ${worst.score})

En iyi cozumun ozeti:
${best.solution.substring(0, 500)}

En iyi elestiri:
${best.critique.substring(0, 300)}`
}

function printTerminal(rounds: DebateRound[], task: string) {
  console.log("\n" + "═".repeat(60))
  console.log("  PLUS TWOCODER - MODEL TARTISMA OTURUMU")
  console.log("═".repeat(60))
  console.log(`\nGOREV: ${task}\n`)

  for (const round of rounds) {
    console.log(`\n${"─".repeat(60)}`)
    console.log(`  TUR ${round.round}`)
    console.log("─".repeat(60))

    for (const opinion of round.opinions) {
      const bar = "█".repeat(Math.floor(opinion.score / 5)) + "░".repeat(20 - Math.floor(opinion.score / 5))
      console.log(`\n  🤖 ${opinion.provider}/${opinion.model}`)
      console.log(`  Skor: [${bar}] ${opinion.score}/100`)
      console.log(`\n  Çözüm:`)
      console.log(`  ${opinion.solution.split("\n").join("\n  ")}`)
      console.log(`\n  Elestiri:`)
      console.log(`  ${opinion.critique.split("\n").slice(0, 5).join("\n  ")}`)
    }
  }

  if (rounds.length > 0 && rounds[rounds.length - 1].consensus) {
    console.log(`\n${"═".repeat(60)}`)
    console.log("  NİHAİ KONSENSÜS")
    console.log("═".repeat(60))
    console.log(`\n${rounds[rounds.length - 1].consensus}`)
  }

  console.log("\n" + "═".repeat(60))
  console.log("  OTURUM SONU")
  console.log("═".repeat(60) + "\n")
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
      console.log(`**Çözüm:**\n\`\`\`\n${opinion.solution}\n\`\`\`\n`)
      console.log(`**Elestiri:**\n${opinion.critique}\n`)
    }
  }

  if (rounds.length > 0 && rounds[rounds.length - 1].consensus) {
    console.log(`## Nihai Konsensus\n`)
    console.log(rounds[rounds.length - 1].consensus)
  }
}
