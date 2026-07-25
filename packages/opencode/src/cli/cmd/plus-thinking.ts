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

export interface ThinkerOpinion {
  model: string
  provider: string
  thinking: string
  analysis: string
  score: number
}

export interface ThinkingRound {
  round: number
  opinions: ThinkerOpinion[]
  synthesis?: string
}

interface ModelRef {
  providerID: ProviderID
  modelID: string
  model: LanguageModel
}

export const PlusThinkingCommand = cmd({
  command: "plus-thinking",
  aliases: ["think", "plusthinking"],
  describe: "2-3 model dusunce sureclerini karsilastirarak derin analiz yapsin",
  builder: (yargs: Argv) => {
    return yargs
      .option("task", {
        alias: "t",
        describe: "Analiz edilecek konu/soru",
        type: "string",
        demandOption: true,
      })
      .option("models", {
        alias: "m",
        describe: "Kullanilacak modeller (virgullu, max 3)",
        type: "array",
      })
      .option("rounds", {
        alias: "r",
        describe: "Analiz tur sayisi",
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
      s.start("PlusThinking baslatiliyor...")

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
              s.message(`Konu: ${args.task}`)
              s.message(`Analiz turlari: ${args.rounds}`)

              const rounds: ThinkingRound[] = []
              let previousScores: number[] = []

              for (let round = 0; round < (args.rounds as number); round++) {
                s.message(`\n--- TUR ${round + 1} ---`)

                const opinions: ThinkerOpinion[] = []

                for (let i = 0; i < selectedModels.length; i++) {
                  const m = selectedModels[i]
                  s.message(`${m.providerID}/${m.modelID} dusuncesini paylasiyor...`)

                  const prompt = round === 0
                    ? buildThinkingPrompt(args.task as string)
                    : buildRefinedThinkingPrompt(args.task as string, opinions)

                  const result = yield* Effect.promise(() =>
                    generateText({
                      model: m.model,
                      messages: [{ role: "user", content: prompt }],
                    }),
                  )

                  // Parse thinking and analysis from the response
                  const { thinking, analysis } = parseThinkingResponse(result.text)

                  // Cross-evaluate: bir sonraki model dusunce surecini degerlendirsin
                  const evaluator = selectedModels[(i + 1) % selectedModels.length]
                  const evalResult = yield* Effect.promise(() =>
                    generateText({
                      model: evaluator.model,
                      messages: [{ role: "user", content: buildEvaluatePrompt(args.task as string, thinking, analysis) }],
                    }),
                  )

                  const score = evaluateThinking(evalResult.text, thinking, analysis)

                  opinions.push({
                    model: m.modelID,
                    provider: m.providerID as string,
                    thinking,
                    analysis,
                    score,
                  })

                  s.message(`${m.modelID} dusunme skoru: ${score}/100`)
                }

                opinions.sort((a, b) => b.score - a.score)
                rounds.push({ round: round + 1, opinions })

                // Convergence check
                const currentScores = opinions.map((o) => o.score)
                if (round > 0 && previousScores.length > 0) {
                  const avgPrev = previousScores.reduce((a, b) => a + b, 0) / previousScores.length
                  const avgCurr = currentScores.reduce((a, b) => a + b, 0) / currentScores.length
                  const diff = Math.abs(avgPrev - avgCurr)
                  if (diff < 5) {
                    s.message(`\nDusunce surecleri yaklasti (fark: ${diff.toFixed(1)}), analiz erken sonlandirildi.`)
                    break
                  }
                }
                previousScores = currentScores
              }

              // Final synthesis
              const lastRound = rounds[rounds.length - 1]
              const opinionsSummary = lastRound.opinions
                .map((o) => `${o.provider}/${o.model} (Skor: ${o.score}):\nDusunce: ${o.thinking.substring(0, 500)}\nAnaliz: ${o.analysis.substring(0, 300)}`)
                .join("\n\n")

              const synthesisPrompt = `Sen bir analiz moderatörüsun. Farkli modellerin dusunce sureclerini inceledin.

KONU: ${args.task}

TUM ANALIZLER:
${opinionsSummary}

Simdi nihai sentezi olustur. Her modelin dusunme derinligini, mantıksal tutarliligini ve kenar vakalari ne kadar iyi kavradigini degerlendir.

Cevabini su formatta ver:
## Nihai Sonuc
[en iyi analiz sentezi]

## Dusunce Karsilastirmasi
[her modelin dusunme gucu ve zayif yonleri]

## Mantıksal Degerlendirme
[hangi analiz en tutarli, neden]

## Kenar vakalari
[atlanan veya iyi ele alinan kenar vakalari]`

              const primary = selectedModels[0]
              const synthesisResult = yield* Effect.promise(() =>
                generateText({
                  model: primary.model,
                  messages: [{ role: "user", content: synthesisPrompt }],
                }),
              )

              lastRound.synthesis = synthesisResult.text

              s.stop("PlusThinking tamamlandi!")

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

export function buildThinkingPrompt(task: string): string {
  return `Sen derin dusunce uzmanisin. Asagidaki konuyu kapsamli bir sekilde dusun ve analiz et.

KONU: ${task}

TALIMATLAR:
1. Adim adim dusun (thinking block icinde)
2. Varsayimlarini belirt
3. Mantıksal zincirini kur
4. Kenar vakaları dusun
5. Potansiyel sorunları ongor
6. Nihai analizini sun

Cevabini su formatta ver:
## Dusunce Sureci
[<thinking> ... </thinking> gibi adim adim dusuncelerin]

## Analiz
[detayli analiz sonucun]

## Sonuc
[kisa ve net nihai cevap]`
}

export function buildRefinedThinkingPrompt(task: string, previousOpinions: ThinkerOpinion[]): string {
  const opinionsText = previousOpinions
    .map((o) => `### ${o.provider}/${o.model} (Skor: ${o.score})\nDusunce: ${o.thinking}\nAnaliz: ${o.analysis}`)
    .join("\n\n")

  return `Sen derin dusunce uzmanisin. Diger modellerin dusunce sureclerini inceledin.
Simdi kendi dusunceni daha derin ve kapsamli hale getir.

KONU: ${task}

ONCEKI DUSUNCE SURECLERI:
${opinionsText}

Kurallar:
- Diger modellerin atladigi kenar vakalarini ele al
- Daha derin bir mantıksal analiz yap
- Varsayim sorgulamasini guclendir
- Daha kapsamli bir sonuc cikar

Cevabini su formatta ver:
## Dusunce Sureci
[derinlestirilmis adim adim dusunceler]

## Analiz
[genisletilmis analiz]

## Neden Daha Iyi
[bu dusuncenin digerlerinden farki]`
}

export function buildEvaluatePrompt(task: string, thinking: string, analysis: string): string {
  return `Sen bir dusunce kalitesi degerlendiricisin. Asagidaki dusunce surecini ve analizi incele.

KONU: ${task}

DUSUNCE SURECI:
${thinking}

ANALIZ:
${analysis}

Bu dusunce surecini degerlendir. Su kriterlere gore 0-100 arasi skor ver:
- Dusunme derinligi (25 puan) — kac katmanli dusunuyor? Varsayimlar sorgulanıyor mu?
- Mantıksal tutarlılık (25 puan) — dusunceler mantıksal zincir oluşturuyor mu?
- Kenar vakaları kapsama (20 puan) — beklenmedik durumlar dusunuldu mu?
- Analiz kalitesi (20 puan) — analiz ne kadar detayli ve tutarli?
- Netlik ve ozetleme (10 puan) — sonuc ne kadar acik ve anlasilir?

Dikkat:
- Sadece JSON formatinda cevap ver
- Extra metin yazma
- Skoru adil ve katı degerlendir

SADECE su JSON formatinda cevap ver:
{"score": N}

N = 0-100 arasi tam sayi`
}

export function parseThinkingResponse(text: string): { thinking: string; analysis: string } {
  // Try to extract thinking block
  const thinkingMatch = text.match(/##?\s*Dusunce\s*Sureci\s*\n([\s\S]*?)(?=##?\s*Analiz|$)/i)
    || text.match(/<thinking>([\s\S]*?)<\/thinking>/i)
    || text.match(/```thinking\s*\n([\s\S]*?)```/i)

  const analysisMatch = text.match(/##?\s*Analiz\s*\n([\s\S]*?)(?=##?\s*Sonuc|##?\s*Neden|$)/i)

  return {
    thinking: thinkingMatch?.[1]?.trim() || text.substring(0, Math.min(text.length, 500)),
    analysis: analysisMatch?.[1]?.trim() || text.substring(Math.min(text.length, 500)),
  }
}

export function evaluateThinking(evalText: string, thinking: string, analysis: string): number {
  // Try LLM score first
  const jsonMatch = evalText.match(/\{\s*"score"\s*:\s*(\d{1,3})\s*\}/i)
  if (jsonMatch) {
    const score = parseInt(jsonMatch[1], 10)
    if (score >= 0 && score <= 100) return score
  }

  // Markdown patterns
  const patterns = [
    /##?\s*Skor:\s*(\d{1,3})/i,
    /##?\s*Score:\s*(\d{1,3})/i,
    /(\d{1,3})\s*\/\s*100/,
  ]
  for (const pattern of patterns) {
    const match = evalText.match(pattern)
    if (match) {
      const score = parseInt(match[1], 10)
      if (score >= 0 && score <= 100) return score
    }
  }

  // Keyword fallback
  return keywordFallback(thinking, analysis)
}

function keywordFallback(thinking: string, analysis: string): number {
  let score = 40
  const combined = thinking + analysis

  // Depth indicators
  if (combined.includes("adim") || combined.includes("step") || combined.includes("1.")) score += 5
  if (combined.includes("2.") || combined.includes("3.")) score += 5
  if (combined.includes("varsayim") || combined.includes("assumption")) score += 5
  if (combined.includes("kenar") || combined.includes("edge") || combined.includes("beklenmedik")) score += 5

  // Quality indicators
  if (combined.includes("mantıksal") || combined.includes("logical") || combined.includes("neden")) score += 5
  if (combined.includes("sonuc") || combined.includes("conclusion") || combined.includes("result")) score += 5
  if (combined.includes("analiz") || combined.includes("analysis") || combined.includes("degerlendir")) score += 5
  if (combined.includes("risk") || combined.includes("sorun") || combined.includes("problem")) score += 5

  // Length-based
  if (combined.length > 500) score += 5
  if (combined.length > 1000) score += 5
  if (combined.length > 2000) score += 5

  // Penalty
  if (combined.length < 100) score -= 10
  if (!combined.includes("```") && combined.length < 200) score -= 5

  return Math.max(0, Math.min(100, score))
}

function printTerminal(rounds: ThinkingRound[], task: string) {
  console.log("\n" + "=".repeat(60))
  console.log("  PLUS THINKING - DERIN ANALIZ OTURUMU")
  console.log("=".repeat(60))
  console.log(`\nKONU: ${task}\n`)

  for (const round of rounds) {
    console.log(`\n${"-".repeat(60)}`)
    console.log(`  TUR ${round.round}`)
    console.log("-".repeat(60))

    for (const opinion of round.opinions) {
      const bar = "#".repeat(Math.floor(opinion.score / 5)) + ".".repeat(20 - Math.floor(opinion.score / 5))
      console.log(`\n  [AI] ${opinion.provider}/${opinion.model}`)
      console.log(`  Skor: [${bar}] ${opinion.score}/100`)
      console.log(`\n  Dusunce Sureci:`)
      const thinkingLines = opinion.thinking.split("\n")
      console.log(`  ${thinkingLines.slice(0, 12).join("\n  ")}${thinkingLines.length > 12 ? "\n  ... (devami var)" : ""}`)
      console.log(`\n  Analiz (ozet):`)
      const analysisLines = opinion.analysis.split("\n").filter(l => l.trim())
      console.log(`  ${analysisLines.slice(0, 8).join("\n  ")}`)
    }
  }

  if (rounds.length > 0 && rounds[rounds.length - 1].synthesis) {
    console.log(`\n${"=".repeat(60)}`)
    console.log("  Nihai Sentez")
    console.log("=".repeat(60))
    console.log(`\n${rounds[rounds.length - 1].synthesis}`)
  }

  console.log("\n" + "=".repeat(60))
  console.log("  OTURUM SONU")
  console.log("=".repeat(60) + "\n")
}

function printJSON(rounds: ThinkingRound[], task: string) {
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
            thinking: o.thinking,
            analysis: o.analysis,
          })),
        })),
        synthesis: rounds[rounds.length - 1]?.synthesis,
      },
      null,
      2,
    ),
  )
}

function printMarkdown(rounds: ThinkingRound[], task: string) {
  console.log(`# PlusThinking Analiz Raporu\n`)
  console.log(`**Konu:** ${task}\n`)

  for (const round of rounds) {
    console.log(`## Tur ${round.round}\n`)

    for (const opinion of round.opinions) {
      console.log(`### ${opinion.provider}/${opinion.model} (Skor: ${opinion.score}/100)\n`)
      console.log(`**Dusunce Sureci:**\n\`\`\`\n${opinion.thinking}\n\`\`\`\n`)
      console.log(`**Analiz:**\n${opinion.analysis}\n`)
    }
  }

  if (rounds.length > 0 && rounds[rounds.length - 1].synthesis) {
    console.log(`## Nihai Sentez\n`)
    console.log(rounds[rounds.length - 1].synthesis)
  }
}
