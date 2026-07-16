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
import { getGitHubClient, resolveRepo, withRetry } from "../github/client"
import { parseIssueUrl } from "../fix/github"
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
      .option("github", {
        describe: "GitHub issue URL (ornek: https://github.com/owner/repo/issues/123)",
        type: "string",
      })
      .option("auto-pr", {
        describe: "Cozumu GitHub'a PR olarak gonder",
        type: "boolean",
        default: false,
      })
      .option("base", {
        describe: "PR icin base branch",
        type: "string",
        default: "main",
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
      github: args.github as string | undefined,
      autoPr: (args["auto-pr"] as boolean) || false,
      base: (args.base as string) || "main",
    }

    // GitHub issue URL varsa task'i guncelle
    if (options.github) {
      const parsed = parseIssueUrl(options.github)
      if (!parsed) {
        console.error("Gecersiz GitHub issue URL. Ornek: https://github.com/owner/repo/issues/123")
        process.exit(1)
      }

      const { octoGraph } = getGitHubClient()
      const ISSUE_QUERY = `
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $number) {
              title
              body
              state
              labels(first: 10) { nodes { name } }
              assignees(first: 5) { nodes { login } }
            }
          }
        }
      `
      const response = await withRetry(() =>
        octoGraph(ISSUE_QUERY, {
          owner: parsed.owner,
          repo: parsed.repo,
          number: parsed.number,
        }) as Promise<any>,
      )

      const issue = response.repository.issue
      if (!issue) {
        console.error(`Issue #${parsed.number} bulunamadi: ${parsed.owner}/${parsed.repo}`)
        process.exit(1)
      }

      const labels = issue.labels?.nodes?.map((l: any) => l.name).join(", ") || "yok"
      options.task = `[${parsed.owner}/${parsed.repo}#${parsed.number}] ${issue.title}\n\n${issue.body || "Aciklama yok"}\n\nLabels: ${labels}`
      console.log(`GitHub Issue: #${parsed.number} ${issue.title}`)
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

              const allSubTasks = planData.subTasks.map((t: any, i: number) => ({
                  id: t.id || `T${i + 1}`,
                  title: t.title || `Alt gorev ${i + 1}`,
                  description: t.description || "",
                  dependencies: t.dependencies || [],
                  status: "pending" as const,
                  filesChanged: [] as string[],
                }))

              if (allSubTasks.length > options.maxSteps) {
                s.message(`Uyari: ${allSubTasks.length} gorev olusturuldu ama limit ${options.maxSteps}. Ilk ${options.maxSteps} gorev secildi.`)
              }

              ctx.plan = {
                goal: analysis?.goal || options.task,
                subTasks: allSubTasks.slice(0, options.maxSteps),
                estimatedSteps: Math.min(allSubTasks.length, options.maxSteps),
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
              s.message("\nFaz 4: Alt gorevler calistiriliyor...")
              const completedOrder = topologicalSort(ctx.plan.subTasks)

              async function executeSingleSubTask(taskId: string) {
                const subTask = ctx.plan.subTasks.find((t) => t.id === taskId)
                if (!subTask) return

                const depsOk = subTask.dependencies.every((dep) => {
                  const depTask = ctx.plan.subTasks.find((t) => t.id === dep)
                  return depTask?.status === "done"
                })

                if (!depsOk) {
                  subTask.status = "skipped"
                  subTask.error = "Bagimliliklar tamamlanamadi"
                  s.message(`  ${subTask.id}: ATLANDI (bagimlilik)`)
                  return
                }

                s.message(`  ${subTask.id}: ${subTask.title} baslatiliyor...`)
                subTask.status = "running"

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
                  const execResult = await generateText({ model: selectedModel!.model, messages: [{ role: "user", content: execPrompt }] })

                  subTask.result = execResult.text
                  subTask.status = "done"
                  ctx.completedTasks.push(subTask)

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

              // Bagimliliklara gore sirali calistir, paralel olabilecekleri grupla
              const remaining = [...completedOrder]
              while (remaining.length > 0) {
                const readyBatch: string[] = []
                for (const taskId of remaining) {
                  const subTask = ctx.plan.subTasks.find((t) => t.id === taskId)
                  if (!subTask) continue
                  const depsOk = subTask.dependencies.every((dep) => {
                    const depTask = ctx.plan.subTasks.find((t) => t.id === dep)
                    return depTask?.status === "done" || depTask?.status === "skipped"
                  })
                  if (depsOk) readyBatch.push(taskId)
                }

                if (readyBatch.length === 0) {
                  for (const taskId of remaining) {
                    const subTask = ctx.plan.subTasks.find((t) => t.id === taskId)
                    if (subTask && subTask.status === "pending") {
                      subTask.status = "skipped"
                      subTask.error = "Bagimli oldugu gorevler tamamlanamadi"
                      s.message(`  ${subTask.id}: ATLANDI (kalan bagimlilik)`)
                    }
                  }
                  break
                }

                const parallelBatch = readyBatch.slice(0, options.maxParallel)
                const batchRemaining = readyBatch.slice(options.maxParallel)
                remaining.splice(0, parallelBatch.length + batchRemaining.length)

                if (parallelBatch.length > 1) {
                  s.message(`  Paralel calistiriliyor: ${parallelBatch.join(", ")}`)
                  yield* Effect.promise(() => Promise.all(parallelBatch.map((id) => executeSingleSubTask(id))))
                } else {
                  yield* Effect.promise(() => executeSingleSubTask(parallelBatch[0]))
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

              // ─── FAZ 6: GitHub PR Olustur (opsiyonel) ───
              if (options.autoPr && options.github) {
                s.message("\nFaz 6: GitHub PR olusturuluyor...")
                const createPr = async () => {
                  const parsed = parseIssueUrl(options.github!)
                  if (parsed) {
                    const { octoRest } = getGitHubClient()
                    const branchName = `solve/issue-${parsed.number}-${Date.now()}`

                    const { data: mainBranch } = await withRetry(() =>
                      octoRest.rest.repos.getBranch({
                        owner: parsed.owner,
                        repo: parsed.repo,
                        branch: options.base,
                      }),
                    )

                    await withRetry(() =>
                      octoRest.rest.git.createRef({
                        owner: parsed.owner,
                        repo: parsed.repo,
                        ref: `refs/heads/${branchName}`,
                        sha: mainBranch.commit.sha,
                      }),
                    )

                    s.message(`  Branch olusturuldu: ${branchName}`)

                    const prBody = [
                      `## Cozum Ozeti`,
                      ``,
                      `Issue: #${parsed.number}`,
                      ``,
                      ctx.summary,
                      ``,
                      `---`,
                      `*Glitch Solve tarafindan otomatik olusturuldu.*`,
                    ].join("\n")

                    const { data: pr } = await withRetry(() =>
                      octoRest.rest.pulls.create({
                        owner: parsed.owner,
                        repo: parsed.repo,
                        title: `fix: #${parsed.number} - ${ctx.plan.goal}`,
                        body: prBody,
                        head: branchName,
                        base: options.base,
                      }),
                    )

                    s.message(`  PR olusturuldu: ${pr.html_url}`)

                    await withRetry(() =>
                      octoRest.rest.issues.createComment({
                        owner: parsed.owner,
                        repo: parsed.repo,
                        issue_number: parsed.number,
                        body: `Glitch Solve bu issue'yu cozmek icin bir PR olusturdu: #${pr.number}\n\nOzet: ${ctx.summary.substring(0, 200)}...`,
                      }),
                    )

                    s.message(`  Issue'ya yorum eklendi`)
                  }
                }
                try {
                  yield* Effect.tryPromise({ try: createPr, catch: (e) => e as Error })
                } catch {
                  s.message(`  Uyari: PR olusturulamadi`)
                }
              }

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
  const skipped: string[] = []

  function visit(id: string): boolean {
    if (visited.has(id)) return true
    if (visiting.has(id)) {
      skipped.push(id)
      return false // cycle detected
    }
    visiting.add(id)

    const task = tasks.find((t) => t.id === id)
    if (task) {
      for (const dep of task.dependencies) {
        if (!visit(dep)) {
          visiting.delete(id)
          return false
        }
      }
    }

    visiting.delete(id)
    visited.add(id)
    sorted.push(id)
    return true
  }

  for (const task of tasks) {
    visit(task.id)
  }

  if (skipped.length > 0) {
    console.warn(`  Uyari: Döngüsel bagimlilik tespit edildi, atlanan gorevler: ${skipped.join(", ")}`)
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

function selectBestModel(providers: Record<string, { models?: Record<string, unknown> }>): ModelRef | null {
  const allModels: ModelRef[] = []
  for (const [pid, provider] of Object.entries(providers)) {
    const providerID = ProviderID.make(pid)
    for (const [modelID, model] of Object.entries(provider.models ?? {})) {
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
