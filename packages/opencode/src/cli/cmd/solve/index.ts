import type { Argv } from "yargs"
import { cmd } from "../cmd"
import { bootstrap } from "../../bootstrap"
import { AppRuntime } from "@/effect/app-runtime"
import { Instance } from "../../../project/instance"
import { Provider } from "../../../provider"
import { ProviderID } from "../../../provider/schema"
import { Effect } from "effect"
import { generateText } from "ai"
import type { LanguageModel } from "ai"
import { extractJsonFromMarkdown } from "../fix/parser"
import { loadPrompt, fillTemplate } from "../fix/prompts-loader"
import type { SolveOptions, SolveContext, TaskPlan, SubTask } from "./types"
import fs from "fs"
import path from "path"

interface ModelRef {
  providerID: ProviderID
  modelID: string
  model: LanguageModel
}

export const SolveCommand = cmd({
  command: "solve",
  aliases: ["task", "execute"],
  describe: "Herhangi bir gorevi parcalara bol ve calistir (sub-agent sistemi)",
  builder: (yargs: Argv) => {
    return yargs
      .option("task", {
        alias: "t",
        describe: "Yapilacak gorev",
        type: "string",
        demandOption: true,
      })
      .option("model", {
        alias: "m",
        describe: "Kullanilacak model",
        type: "string",
      })
      .option("dry-run", {
        describe: "Sadece plani goster, calistirma",
        type: "boolean",
        default: false,
      })
      .option("max-parallel", {
        alias: "p",
        describe: "Ayni anda calisacak max sub-agent",
        type: "number",
        default: 1,
      })
      .option("max-steps", {
        alias: "s",
        describe: "Maksimum alt gorev sayisi",
        type: "number",
        default: 8,
      })
      .option("verbose", {
        alias: "v",
        describe: "Detayli cikti",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    const options: SolveOptions = {
      task: args.task as string,
      model: args.model as string | undefined,
      dryRun: (args["dry-run"] as boolean) || false,
      maxParallel: (args["max-parallel"] as number) || 1,
      maxSteps: (args["max-steps"] as number) || 8,
      verbose: (args["verbose"] as boolean) || false,
    }

    await bootstrap(process.cwd(), async () => {
      const s = require("@clack/prompts").spinner()
      s.start("Glitch Solve baslatiliyor...")

      await Instance.provide({
        directory: process.cwd(),
        async fn() {
          await AppRuntime.runPromise(
            Effect.gen(function* () {
              const svc = yield* Provider.Service
              const providers = yield* svc.list()

              const selectedModel = options.model
                ? resolveModel(options.model, providers)
                : selectBestModel(providers)

              if (!selectedModel) {
                s.stop("Model bulunamadi.")
                return
              }

              s.message(`Model: ${selectedModel.providerID}/${selectedModel.modelID}`)
              s.message(`Gorev: ${options.task}`)

              const ctx: SolveContext = {
                task: options.task,
                plan: { goal: "", subTasks: [], estimatedSteps: 0, complexity: "medium" },
                completedTasks: [],
                allFilesChanged: [],
                summary: "",
                dryRun: options.dryRun,
                model: `${selectedModel.providerID}/${selectedModel.modelID}`,
                maxParallel: options.maxParallel,
              }

              // ─── FAZ 1: Gorevi Analiz Et ───
              s.message("Faz 1: Gorev analiz ediliyor...")
              const analyzePrompt = fillTemplate(loadPrompt("task-analyzer"), {
                task: options.task,
              })
              const analyzeResult = yield* Effect.promise(() =>
                generateText({ model: selectedModel.model, messages: [{ role: "user", content: analyzePrompt }] }),
              )
              const analysis = extractJsonFromMarkdown(analyzeResult.text)
              if (options.verbose) {
                s.message(`Analiz: ${JSON.stringify(analysis, null, 2).substring(0, 200)}...`)
              }

              // ─── FAZ 2: Alt Gorevlere Bol ───
              s.message("Faz 2: Alt gorevlere bolunuyor...")
              const planPrompt = fillTemplate(loadPrompt("task-planner"), {
                task: options.task,
                analysis: JSON.stringify(analysis, null, 2),
              })
              const planResult = yield* Effect.promise(() =>
                generateText({ model: selectedModel.model, messages: [{ role: "user", content: planPrompt }] }),
              )
              const planData = extractJsonFromMarkdown(planResult.text)

              if (!planData?.subTasks || !Array.isArray(planData.subTasks)) {
                s.stop("Plan olusturulamadi.")
                return
              }

              ctx.plan = {
                goal: analysis?.goal || options.task,
                subTasks: planData.subTasks.map((t: any, i: number) => ({
                  id: t.id || `T${i + 1}`,
                  title: t.title || `Alt gorev ${i + 1}`,
                  description: t.description || "",
                  dependencies: t.dependencies || [],
                  status: "pending" as const,
                  filesChanged: [],
                })),
                estimatedSteps: planData.subTasks.length,
                complexity: analysis?.complexity || "medium",
              }

              s.message(`${ctx.plan.subTasks.length} alt gorev olusturuldu (${ctx.plan.complexity})`)
              for (const st of ctx.plan.subTasks) {
                s.message(`  ${st.id}: ${st.title}`)
              }

              // ─── FAZ 3: Dry-Run Kontrol ───
              if (options.dryRun) {
                printDryRun(ctx)
                s.stop("Dry-run tamamlandi.")
                return
              }

              // ─── FAZ 4: Alt Gorevleri Calistir ───
              s.message("\nFaz 3: Alt gorevler calistiriliyor...")
              const completedOrder = topologicalSort(ctx.plan.subTasks)

              for (const taskId of completedOrder) {
                const subTask = ctx.plan.subTasks.find((t) => t.id === taskId)
                if (!subTask) continue

                // Bagimlilik kontrolu
                const depsOk = subTask.dependencies.every((dep) => {
                  const depTask = ctx.plan.subTasks.find((t) => t.id === dep)
                  return depTask?.status === "done"
                })

                if (!depsOk) {
                  subTask.status = "skipped"
                  subTask.error = "Bagimliliklar tamamlanamadi"
                  s.message(`  ${subTask.id}: ATLANDI (bagimlilik)`)
                  continue
                }

                s.message(`  ${subTask.id}: ${subTask.title} baslatiliyor...`)
                subTask.status = "running"

                // Baglilanmis gorevlerin sonuclarini topla
                const contextParts = ctx.completedTasks
                  .filter((t) => subTask.dependencies.includes(t.id))
                  .map((t) => `${t.id} (${t.title}): ${t.result?.substring(0, 500) || "tamamlandi"}`)
                  .join("\n")

                const execPrompt = fillTemplate(loadPrompt("task-executor"), {
                  mainTask: options.task,
                  subTaskTitle: subTask.title,
                  subTaskDescription: subTask.description,
                  files: subTask.filesChanged?.join(", ") || "(dosyalar analiz sirasinda belirlenecek)",
                  context: contextParts || "(onceki gorev yok)",
                })

                try {
                  const execResult = yield* Effect.promise(() =>
                    generateText({ model: selectedModel.model, messages: [{ role: "user", content: execPrompt }] }),
                  )

                  subTask.result = execResult.text
                  subTask.status = "done"
                  ctx.completedTasks.push(subTask)

                  // Dosya degisikliklerini cikar
                  const fileMatches = execResult.text.match(/Changes for `([^`]+)`/g)
                  if (fileMatches) {
                    subTask.filesChanged = fileMatches.map((m: string) =>
                      m.replace(/Changes for `/g, "").replace(/`/g, ""),
                    )
                    ctx.allFilesChanged.push(...subTask.filesChanged)
                  }

                  s.message(`  ${subTask.id}: TAMAMLANDI`)
                  if (options.verbose) {
                    s.message(`    Sonuc: ${execResult.text.substring(0, 100)}...`)
                  }
                } catch (err) {
                  subTask.status = "failed"
                  subTask.error = err instanceof Error ? err.message : String(err)
                  s.message(`  ${subTask.id}: BASARISIZ - ${subTask.error}`)
                }
              }

              // ─── FAZ 5: Ozet Olustur ───
              s.message("\nFaz 4: Ozet olusturuluyor...")
              const summaryPrompt = fillTemplate(loadPrompt("task-summarizer"), {
                mainTask: options.task,
                completedTasks: ctx.completedTasks
                  .map((t) => `- ${t.id} (${t.title}): ${t.status}`)
                  .join("\n"),
                filesChanged: ctx.allFilesChanged.map((f) => `- ${f}`).join("\n"),
              })
              const summaryResult = yield* Effect.promise(() =>
                generateText({ model: selectedModel.model, messages: [{ role: "user", content: summaryPrompt }] }),
              )
              ctx.summary = summaryResult.text

              // ─── SONUC ───
              printSummary(ctx)
              s.stop("Glitch Solve tamamlandi!")
            }),
          )
        },
      })
    })
  },
})

export function topologicalSort(tasks: SubTask[]): string[] {
  const sorted: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(id: string) {
    if (visited.has(id)) return
    if (visiting.has(id)) return // cycle detected, skip
    visiting.add(id)

    const task = tasks.find((t) => t.id === id)
    if (task) {
      for (const dep of task.dependencies) {
        visit(dep)
      }
    }

    visiting.delete(id)
    visited.add(id)
    sorted.push(id)
  }

  for (const task of tasks) {
    visit(task.id)
  }

  return sorted
}

function resolveModel(modelStr: string, providers: Record<string, any>): ModelRef | null {
  const [provider, model] = modelStr.includes("/") ? modelStr.split("/", 2) : ["auto", modelStr]
  const pid = ProviderID.make(provider)
  const providerData = providers[pid]
  if (!providerData) return null
  const modelData = providerData.models?.[model]
  if (!modelData) return null
  return { providerID: pid, modelID: model, model: modelData as LanguageModel }
}

function selectBestModel(providers: Record<string, any>): ModelRef | null {
  const allModels: ModelRef[] = []
  for (const [pid, provider] of Object.entries(providers)) {
    const providerID = ProviderID.make(pid)
    for (const [modelID, model] of Object.entries((provider as any).models ?? {})) {
      allModels.push({ providerID, modelID, model: model as LanguageModel })
    }
  }

  const preferred = ["claude-sonnet", "gpt-4o", "gemini-2.5-pro"]
  for (const pref of preferred) {
    const found = allModels.find((m) => m.modelID.toLowerCase().includes(pref))
    if (found) return found
  }

  return allModels[0] || null
}

function printDryRun(ctx: SolveContext) {
  console.log("\n" + "═".repeat(60))
  console.log("  GLITCH SOLVE - DRY RUN")
  console.log("═".repeat(60))
  console.log(`\nGorev: ${ctx.task}`)
  console.log(`Karmasiklik: ${ctx.plan.complexity}`)
  console.log(`Alt Gorev Sayisi: ${ctx.plan.subTasks.length}`)
  console.log(`Model: ${ctx.model}`)
  console.log(`\nAlt Gorevler:`)
  for (const st of ctx.plan.subTasks) {
    const deps = st.dependencies.length > 0 ? ` (bagimli: ${st.dependencies.join(", ")})` : ""
    console.log(`  ${st.id}: ${st.title}${deps}`)
    console.log(`    ${st.description}`)
  }
  console.log("\n" + "═".repeat(60))
}

function printSummary(ctx: SolveContext) {
  console.log("\n" + "═".repeat(60))
  console.log("  GLITCH SOLVE - SONUC")
  console.log("═".repeat(60))
  console.log(`\nGorev: ${ctx.task}`)
  console.log(`Model: ${ctx.model}`)
  console.log(`\nAlt Gorev Durumlari:`)
  for (const st of ctx.plan.subTasks) {
    const icon = st.status === "done" ? "✓" : st.status === "failed" ? "✗" : "○"
    console.log(`  ${icon} ${st.id}: ${st.title} [${st.status}]`)
  }
  console.log(`\nEtkilenen Dosyalar: ${ctx.allFilesChanged.length}`)
  for (const f of ctx.allFilesChanged) {
    console.log(`  - ${f}`)
  }
  console.log(`\n${ctx.summary}`)
  console.log("\n" + "═".repeat(60))
}
