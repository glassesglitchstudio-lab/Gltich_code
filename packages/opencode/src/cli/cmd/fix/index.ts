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
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import {
  parseIssueUrl,
  fetchIssue,
  getDefaultBranch,
  fetchFileContent,
  createBranch,
  createCommit,
  createPullRequest,
  postComment,
} from "./github"
import { parseFileOperations, extractJsonFromMarkdown, extractFileList } from "./parser"
import { loadPrompt, fillTemplate } from "./prompts-loader"
import type { FixOptions, FixContext } from "./types"
import { scoreWithLLM, buildCritiquePrompt, parseLLMScore, buildInitialPrompt, buildConsensusContext } from "../plus-two-coder"

interface ModelRef {
  providerID: ProviderID
  modelID: string
  model: LanguageModel
}

interface ParsedReview {
  approved: boolean
  score: number
  feedback: string
  suggestions: string[]
  issues: Array<{ file: string; line: number; message: string; severity: "error" | "warning" | "info" }>
}

export function parseReviewResponse(text: string): ParsedReview {
  // Try JSON in code block first
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/)
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1])
      return parseReviewJson(data, text)
    } catch (err) {
      console.warn(`JSON parse hatasi (code block): ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Try bare JSON object in text
  const bareJsonMatch = text.match(/\{[\s\S]*"verdict"[\s\S]*\}/)
  if (bareJsonMatch) {
    try {
      const data = JSON.parse(bareJsonMatch[0])
      return parseReviewJson(data, text)
    } catch (err) {
      console.warn(`JSON parse hatasi (bare): ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return {
    approved: /lgtm|satisfactory|approved|guvenli|safe|no issues/i.test(text),
    score: 0,
    feedback: text,
    suggestions: [],
    issues: [],
  }
}

function parseReviewJson(data: Record<string, any>, text: string): ParsedReview {
  const verdict = (data.verdict ?? "").toLowerCase()
  const approved =
    verdict.includes("lgtm") ||
    verdict.includes("guvenli") ||
    verdict.includes("safe") ||
    verdict.includes("no issues")

  const rawIssues = Array.isArray(data.issues) ? data.issues : []
  const issues = rawIssues.map((i: any) => ({
    file: String(i.file ?? ""),
    line: typeof i.line === "number" ? i.line : 0,
    message: String(i.message ?? ""),
    severity: (["error", "warning", "info"].includes(i.severity) ? i.severity : "info") as "error" | "warning" | "info",
  }))

  return {
    approved,
    score: typeof data.score === "number" ? Math.min(100, Math.max(0, data.score)) : 0,
    feedback: text,
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    issues,
  }
}

export const FixCommand = cmd({
  command: "fix",
  aliases: ["solve", "autofix"],
  describe: "GitHub issue'yu otomatik coz (7 fazli pipeline)",
  builder: (yargs: Argv) => {
    return yargs
      .option("issue-url", {
        alias: "i",
        describe: "GitHub issue URL'si (orn: https://github.com/user/repo/issues/123)",
        type: "string",
        demandOption: true,
      })
      .option("model", {
        alias: "m",
        describe: "Kullanilacak model (orn: anthropic/claude-sonnet-4-20250514)",
        type: "string",
      })
      .option("target-file", {
        alias: "f",
        describe: "Hedef dosya (opsiyonel, agent otomatik bulabilir)",
        type: "string",
      })
      .option("max-review", {
        alias: "r",
        describe: "Maksimum review dongusu",
        type: "number",
        default: 3,
      })
      .option("no-pr", {
        describe: "PR olusturma",
        type: "boolean",
        default: false,
      })
      .option("dry-run", {
        describe: "Sadece plani goster, degisiklik yapma",
        type: "boolean",
        default: false,
      })
      .option("debate", {
        describe: "PlusTwoCoder debate modunu ac",
        type: "boolean",
        default: false,
      })
      .option("auto-commit", {
        describe: "Otomatik commit (onay olmadan)",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    const options: FixOptions = {
      issueUrl: args["issue-url"] as string,
      model: args.model as string | undefined,
      targetFile: args["target-file"] as string | undefined,
      maxReviewCycles: (args["max-review"] as number) || 3,
      noPr: (args["no-pr"] as boolean) || false,
      dryRun: (args["dry-run"] as boolean) || false,
      debateMode: (args["debate"] as boolean) || false,
      autoCommit: (args["auto-commit"] as boolean) || false,
    }

    await bootstrap(process.cwd(), async () => {
      const s = require("@clack/prompts").spinner()
      s.start("Glitch Fix baslatiliyor...")

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
                s.stop("Model bulunamadi. Lutfen --model ile bir model belirtin.")
                return
              }

              s.message(`Model: ${selectedModel.providerID}/${selectedModel.modelID}`)

              const parsed = parseIssueUrl(options.issueUrl)
              if (!parsed) {
                s.stop("Gecersiz GitHub issue URL'si.")
                return
              }

              const { owner, repo, number } = parsed
              s.message(`Issue: ${owner}/${repo}#${number}`)

              const ctx: FixContext = {
                issueUrl: options.issueUrl,
                owner,
                repo,
                issueNumber: number,
                issue: null as unknown as FixContext["issue"],
                triage: null as unknown as FixContext["triage"],
                plan: null as unknown as FixContext["plan"],
                discoveredFiles: [],
                originalContents: [],
                proposals: [],
                reviews: [],
                applyResult: { success: false, filesChanged: [], errors: [] },
                gitResult: { branch: "", pushed: false },
                dryRun: options.dryRun,
                debateMode: options.debateMode,
                maxReviewCycles: options.maxReviewCycles,
                model: `${selectedModel.providerID}/${selectedModel.modelID}`,
              }

              // ─── FAZ 1: Issue Triage ───
              s.message("Faz 1: Issue triage ediliyor...")
              ctx.issue = yield* Effect.promise(() => fetchIssue(owner, repo, number))

              const triagePrompt = fillTemplate(loadPrompt("triager"), {
                title: ctx.issue.title,
                body: ctx.issue.body.substring(0, 3000),
                labels: ctx.issue.labels.join(", "),
                author: ctx.issue.author,
                state: ctx.issue.state,
              })
              const triageResult = yield* Effect.promise(() =>
                generateText({ model: selectedModel.model, messages: [{ role: "user", content: triagePrompt }] }),
              )
              const triageData = extractJsonFromMarkdown(triageResult.text)
              ctx.triage = {
                issue: ctx.issue,
                issueType: triageData?.issueType || "unknown",
                priority: triageData?.priority || "medium",
                summary: triageData?.summary || ctx.issue.title,
              }
              s.message(`Triage: ${ctx.triage.issueType} / ${ctx.triage.priority}`)

              // ─── FAZ 2: Planning ───
              s.message("Faz 2: Cozum plani olusturuluyor...")
              const planPrompt = fillTemplate(loadPrompt("planner"), {
                title: ctx.issue.title,
                body: ctx.issue.body.substring(0, 3000),
                labels: ctx.issue.labels.join(", "),
                triageSummary: ctx.triage.summary,
                repoStructure: "(proje yapisi dosya discovery'da detaylandirilacak)",
              })
              const planResult = yield* Effect.promise(() =>
                generateText({ model: selectedModel.model, messages: [{ role: "user", content: planPrompt }] }),
              )
              ctx.plan = {
                steps: [planResult.text],
                filesToModify: [],
                filesToCreate: [],
                assumptions: [],
              }
              s.message("Plan olusturuldu.")

              // ─── FAZ 3: File Discovery ───
              s.message("Faz 3: Dosyalar kesfediliyor...")
              const defaultBranch = yield* Effect.promise(() => getDefaultBranch(owner, repo))
              let discoveredPaths: string[] = []

              if (options.targetFile) {
                discoveredPaths = options.targetFile.split(",").map((f) => f.trim())
              } else {
                // Repo Map ile akıllı dosya keşfi (yerel proje için)
                const repoMapDiscovery = async () => {
                  const { RepoMapAnalyzer } = await import("../../../repo-map/analyzer")
                  const { RepoMapGraph } = await import("../../../repo-map/graph")
                  const { RepoMapScanner } = await import("../../../repo-map/scanner")

                  const repoRoot = process.cwd()
                  const scanner = new RepoMapScanner({ root: repoRoot })
                  const { files } = await scanner.scanWithStats()

                  if (files.length > 0) {
                    s.message(`Repo Map: ${files.length} dosya tarandı`)
                    const analyzer = new RepoMapAnalyzer(repoRoot)
                    await analyzer.init()

                    const entries = []
                    for (const file of files.slice(0, 500)) { // Limit 500
                      try {
                        const entry = await analyzer.analyzeFile(file)
                        entries.push(entry)
                      } catch {
                        // Skip unparseable files
                      }
                    }

                    const index = await analyzer.buildIndex(entries, repoRoot)
                    const graph = new RepoMapGraph(index)

                    // Issue'dan anahtar kelimeleri çıkar
                    const keywords = extractKeywords(ctx.issue.title + " " + ctx.issue.body)
                    const paths: string[] = []
                    for (const keyword of keywords) {
                      const result = graph.execute({ type: "search", target: keyword })
                      for (const file of result.results) {
                        const relativePath = file.path.replace(repoRoot, "").replace(/\\/g, "/").slice(1)
                        if (!paths.includes(relativePath)) {
                          paths.push(relativePath)
                        }
                      }
                    }
                    return paths
                  }
                  return []
                }

                try {
                  const paths = yield* Effect.tryPromise({
                    try: repoMapDiscovery,
                    catch: () => new Error("Repo Map discovery failed"),
                  })
                  discoveredPaths = paths
                  s.message(`Repo Map: ${discoveredPaths.length} dosya keşfedildi`)
                } catch {
                  // Fallback to GitHub tree API
                }

                // GitHub tree API (fallback veya tamamlama)
                if (discoveredPaths.length === 0) {
                  const treeRes = yield* Effect.promise(() =>
                    fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, {
                      headers: { Accept: "application/vnd.github.v3+json" },
                    }),
                  )
                  if (treeRes.ok) {
                    const treeData = (yield* Effect.promise(() => treeRes.json())) as { tree?: Array<{ type: string; path: string }> }
                    const allFiles = (treeData.tree || [])
                      .filter((f) => f.type === "blob")
                      .map((f) => f.path as string)

                    const discoveryPrompt = fillTemplate(loadPrompt("file-discovery"), {
                      title: ctx.issue.title,
                      body: ctx.issue.body.substring(0, 2000),
                      plan: planResult.text.substring(0, 2000),
                      fileTree: allFiles.slice(0, 200).join("\n"),
                      fileContents: "(dosya icerikleri sonraki adimda okunacak)",
                    })
                    const discoveryResult = yield* Effect.promise(() =>
                      generateText({ model: selectedModel.model, messages: [{ role: "user", content: discoveryPrompt }] }),
                    )
                    discoveredPaths = extractFileList(discoveryResult.text)
                  }
                }
              }

              ctx.discoveredFiles = discoveredPaths.map((p) => ({
                path: p,
                action: "modify" as const,
                reason: "issue ile iliskili",
              }))
              s.message(`${discoveredPaths.length} dosya kesfedildi.`)

              // Fetch original contents
              for (const filePath of discoveredPaths) {
                try {
                  const content = yield* Effect.promise(() => fetchFileContent(owner, repo, filePath, defaultBranch))
                  ctx.originalContents.push(content)
                } catch {
                  ctx.originalContents.push({ path: filePath, content: null, isNew: true })
                }
              }

              // ─── FAZ 4: Code Proposal ───
              s.message("Faz 4: Kod onerisi uretiliyor...")
              const fileContentsText = ctx.originalContents
                .map((f) => `### ${f.path}\n\`\`\`\n${f.content || "(yeni dosya)"}\n\`\`\``)
                .join("\n\n")

              let proposalsResult: string

              if (options.debateMode) {
                s.message("Debate modu: 2 model tartisiyor...")
                proposalsResult = yield* Effect.promise(() =>
                  runDebate(selectedModel, providers, {
                    title: ctx.issue.title,
                    body: ctx.issue.body.substring(0, 2000),
                    plan: planResult.text.substring(0, 2000),
                    fileContents: fileContentsText.substring(0, 5000),
                  }),
                )
              } else {
                const proposePrompt = fillTemplate(loadPrompt("code-proposer"), {
                  title: ctx.issue.title,
                  body: ctx.issue.body.substring(0, 2000),
                  plan: planResult.text.substring(0, 2000),
                  discoveredFiles: discoveredPaths.join("\n"),
                  fileContents: fileContentsText.substring(0, 5000),
                })
                const proposeResult = yield* Effect.promise(() =>
                  generateText({ model: selectedModel.model, messages: [{ role: "user", content: proposePrompt }] }),
                )
                proposalsResult = proposeResult.text
              }

              ctx.proposals = parseFileOperations(proposalsResult)
              s.message(`${ctx.proposals.length} dosya islemi onerildi.`)

              // ─── FAZ 5: Review & Revision ───
              s.message("Faz 5: Kod inceleniyor...")
              for (let cycle = 0; cycle < ctx.maxReviewCycles; cycle++) {
                s.message(`Review dongusu ${cycle + 1}/${ctx.maxReviewCycles}...`)

                const proposalText = ctx.proposals
                  .filter((p) => p.action !== "no_change" && p.code)
                  .map((p) => `### ${p.file_path} (${p.action})\n\`\`\`\n${p.code}\n\`\`\``)
                  .join("\n\n")

                // Technical review
                const techPrompt = fillTemplate(loadPrompt("technical-reviewer"), {
                  title: ctx.issue.title,
                  body: ctx.issue.body.substring(0, 1500),
                  proposals: proposalText.substring(0, 4000),
                })
                const techResult = yield* Effect.promise(() =>
                  generateText({ model: selectedModel.model, messages: [{ role: "user", content: techPrompt }] }),
                )
                const techReview = parseReviewResponse(techResult.text)

                // Style review
                const stylePrompt = fillTemplate(loadPrompt("style-reviewer"), {
                  proposals: proposalText.substring(0, 4000),
                })
                const styleResult = yield* Effect.promise(() =>
                  generateText({ model: selectedModel.model, messages: [{ role: "user", content: stylePrompt }] }),
                )
                const styleReview = parseReviewResponse(styleResult.text)

                // Security review
                const secPrompt = fillTemplate(loadPrompt("security-reviewer"), {
                  proposals: proposalText.substring(0, 4000),
                })
                const secResult = yield* Effect.promise(() =>
                  generateText({ model: selectedModel.model, messages: [{ role: "user", content: secPrompt }] }),
                )
                const secReview = parseReviewResponse(secResult.text)

                ctx.reviews = [
                  { reviewer: "technical", approved: techReview.approved, score: techReview.score, feedback: techReview.feedback, suggestions: techReview.suggestions, issues: techReview.issues },
                  { reviewer: "style", approved: styleReview.approved, score: styleReview.score, feedback: styleReview.feedback, suggestions: styleReview.suggestions, issues: styleReview.issues },
                  { reviewer: "security", approved: secReview.approved, score: secReview.score, feedback: secReview.feedback, suggestions: secReview.suggestions, issues: secReview.issues },
                ]

                s.message(`Teknik: ${techReview.approved ? "OK" : "REVIZE"} (Skor: ${techReview.score}) | Stil: ${styleReview.approved ? "OK" : "REVIZE"} (Skor: ${styleReview.score}) | Guvenlik: ${secReview.approved ? "OK" : "REVIZE"} (Skor: ${secReview.score})`)

                if (techReview.approved && styleReview.approved && secReview.approved) {
                  s.message("Tum review'lar basarili!")
                  break
                }

                // Revizyon gerekli
                if (cycle < ctx.maxReviewCycles - 1) {
                  s.message("Revizyon gerekli, kod guncelleniyor...")
                  const revisionPrompt = fillTemplate(loadPrompt("code-proposer"), {
                    title: ctx.issue.title,
                    body: ctx.issue.body.substring(0, 1500),
                    plan: planResult.text.substring(0, 1500),
                    discoveredFiles: discoveredPaths.join("\n"),
                    fileContents:
                      fileContentsText.substring(0, 4000) +
                      `\n\nREVIEWS:\nTeknik: ${techResult.text.substring(0, 500)}\nStil: ${styleResult.text.substring(0, 500)}\nGuvenlik: ${secResult.text.substring(0, 500)}`,
                  })
                  const revisionResult = yield* Effect.promise(() =>
                    generateText({ model: selectedModel.model, messages: [{ role: "user", content: revisionPrompt }] }),
                  )
                  ctx.proposals = parseFileOperations(revisionResult.text)
                }
              }

              // ─── FAZ 6: Apply & Test ───
              if (options.dryRun) {
                s.message("Dry-run modu: Degisiklikler uygulanmayacak.")
                printDryRun(ctx)
                s.stop("Dry-run tamamlandi.")
                return
              }

              s.message("Faz 6: Degisiklikler uygulanıyor...")
              const filesToCommit = ctx.proposals
                .filter((p) => p.action !== "no_change" && p.code)
                .map((p) => ({ path: p.file_path, content: p.code! }))

              const applyErrors: string[] = []
              for (const file of filesToCommit) {
                try {
                  const fullPath = join(process.cwd(), file.path)
                  mkdirSync(dirname(fullPath), { recursive: true })
                  writeFileSync(fullPath, file.content, "utf-8")
                } catch (error: any) {
                  applyErrors.push(`${file.path}: ${error.message}`)
                }
              }

              ctx.applyResult = {
                success: applyErrors.length === 0 && filesToCommit.length > 0,
                filesChanged: filesToCommit.map((f) => f.path),
                errors: applyErrors,
              }

              if (applyErrors.length > 0) {
                s.message(`Uyari: ${applyErrors.length} dosya yazilamadi`)
              }

              // ─── FAZ 7: Git & PR ───
              s.message("Faz 7: Git islemleri...")
              const branchPrefix = ctx.issue.labels.includes("enhancement")
                ? "feature"
                : ctx.issue.labels.includes("chore")
                  ? "chore"
                  : "fix"
              const branchName = `${branchPrefix}/issue-${ctx.issueNumber}`

              const branchResult = yield* Effect.promise(() => createBranch(owner, repo, branchName, defaultBranch))
              s.message(`Branch: ${branchResult.branch}`)

              const commitMessage = `fix: ${ctx.issue.title} (#${ctx.issueNumber})`
              const commitSha = yield* Effect.promise(() =>
                createCommit(owner, repo, branchResult.branch, commitMessage, filesToCommit),
              )
              s.message(`Commit: ${commitSha.substring(0, 7)}`)
              ctx.gitResult = { branch: branchResult.branch, commitSha, pushed: true }

              // Create PR
              if (!options.noPr && filesToCommit.length > 0) {
                s.message("PR olusturuluyor...")
                const prBody = buildPrBody(ctx)
                const pr = yield* Effect.promise(() =>
                  createPullRequest(
                    owner,
                    repo,
                    `${ctx.issue.title} (#${ctx.issueNumber})`,
                    prBody,
                    branchResult.branch,
                    defaultBranch,
                  ),
                )
                ctx.gitResult.prUrl = pr.url
                s.message(`PR: ${pr.url}`)
              }

              // Post comment
              if (filesToCommit.length > 0) {
                const commentPrompt = fillTemplate(loadPrompt("summary-comment"), {
                  issueNumber: String(ctx.issueNumber),
                  issueTitle: ctx.issue.title,
                  triage: ctx.triage.summary,
                  plan: planResult.text.substring(0, 1000),
                  changes: ctx.proposals
                    .filter((p) => p.action !== "no_change")
                    .map((p) => `- \`${p.file_path}\` (${p.action})`)
                    .join("\n"),
                  reviews: ctx.reviews.map((r) => `- ${r.reviewer}: ${r.approved ? "OK" : "REVIZE"}`).join("\n"),
                  branch: ctx.gitResult.branch,
                  commit: ctx.gitResult.commitSha?.substring(0, 7) || "N/A",
                  pr: ctx.gitResult.prUrl || "PR olusturulmadi",
                  model: ctx.model || "N/A",
                  totalTokens: "N/A",
                })
                const commentResult = yield* Effect.promise(() =>
                  generateText({ model: selectedModel.model, messages: [{ role: "user", content: commentPrompt }] }),
                )
                yield* Effect.promise(() => postComment(owner, repo, ctx.issueNumber, commentResult.text))
                s.message("Yorum paylasildi.")
              }

              s.stop("Glitch Fix tamamlandi!")
            }),
          )
        },
      })
    })
  },
})

function resolveModel(modelStr: string, providers: Record<string, { models?: Record<string, unknown> }>): ModelRef | null {
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

async function runDebate(
  primaryModel: ModelRef,
  providers: Record<string, { models?: Record<string, unknown> }>,
  context: { title: string; body: string; plan: string; fileContents: string },
): Promise<string> {
  const allModels: ModelRef[] = []
  for (const [pid, provider] of Object.entries(providers)) {
    const providerID = ProviderID.make(pid)
    for (const [modelID, model] of Object.entries(provider.models ?? {})) {
      if (pid !== primaryModel.providerID.toString() || modelID !== primaryModel.modelID) {
        allModels.push({ providerID, modelID, model: model as LanguageModel })
      }
    }
  }

  const debaters = [primaryModel, allModels[0], allModels[1]].filter(Boolean).slice(0, 3)
  const opinions: Array<{ model: string; solution: string; critique: string; score: number }> = []

  // Round 1: Her model bağımsız çözüm üretir + cross-critique + cross-scoring
  for (let i = 0; i < debaters.length; i++) {
    const m = debaters[i]
    const task = `${context.title}\n${context.body}`
    const prompt = buildInitialPrompt(task)

    const result = await generateText({ model: m.model, messages: [{ role: "user", content: prompt }] })

    // Cross-critique: bir sonraki model bu çözümü eleştirsin
    const nextModel = debaters[(i + 1) % debaters.length]
    const critiqueResult = await generateText({
      model: nextModel.model,
      messages: [{ role: "user", content: buildCritiquePrompt(task, result.text) }],
    })

    // Cross-scoring: 3. model puanlasın
    const scorerModel = debaters[(i + 2) % debaters.length]
    const score = await scoreWithLLM({
      solution: result.text,
      critique: critiqueResult.text,
      task,
      model: m.model,
      scorer: scorerModel.model,
    })
    opinions.push({
      model: `${m.providerID}/${m.modelID}`,
      solution: result.text,
      critique: critiqueResult.text,
      score,
    })
  }

  opinions.sort((a, b) => b.score - a.score)

  // Konsensus: moderatör tüm çözümleri değerlendirsin
  const opinionsSummary = opinions
    .map((o) => `### ${o.model} (Skor: ${o.score})\nÇözüm:\n${o.solution.substring(0, 500)}\nElestiri:\n${o.critique.substring(0, 300)}`)
    .join("\n\n")

  const consensusPrompt = `Sen bir kod uzmani moderatörüsün. Tum modellerin goruslerini inceledin.

ISSUE: ${context.title}
ACIKLAMA: ${context.body}

TUM GORUSLER:
${opinionsSummary}

Nihai konsensusu acikla. En iyi cozumu sec ve neden digerlerinden daha iyi oldugunu acikla.

Cevabini su formatta ver:
### Changes for \`dosya/yolu\`:
\`\`\`[dil]
[final kod]
\`\`\`

Neden bu cozum secildi: [aciklama]`

  const consensusResult = await generateText({
    model: primaryModel.model,
    messages: [{ role: "user", content: consensusPrompt }],
  })

  return consensusResult.text
}

function buildPrBody(ctx: FixContext): string {
  const parts = [
    `## Glitch Fix: ${ctx.issue.title}`,
    "",
    `**Issue:** #${ctx.issueNumber}`,
    `**Triage:** ${ctx.triage.issueType} / ${ctx.triage.priority}`,
    "",
    "### Yapilan Degisiklikler",
    ...ctx.proposals
      .filter((p) => p.action !== "no_change")
      .map((p) => `- \`${p.file_path}\` (${p.action})`),
    "",
    "### Review Sonuclari",
    ...ctx.reviews.map((r) => `- **${r.reviewer}:** ${r.approved ? "Onaylandi" : "Revize gerekli"}`),
    "",
    "---",
    "*Otomatik olusturuldu: Glitch Fix*",
  ]
  return parts.join("\n")
}

function printDryRun(ctx: FixContext) {
  console.log("\n" + "═".repeat(60))
  console.log("  GLITCH FIX - DRY RUN")
  console.log("═".repeat(60))
  console.log(`\nIssue: #${ctx.issueNumber} - ${ctx.issue.title}`)
  console.log(`Triage: ${ctx.triage.issueType} / ${ctx.triage.priority}`)
  console.log(`Model: ${ctx.model}`)
  console.log(`\nOnerilen Degisiklikler:`)
  for (const p of ctx.proposals) {
    if (p.action === "no_change") continue
    console.log(`  ${p.action === "delete" ? "-" : "~"} ${p.file_path} (${p.action})`)
    if (p.code) {
      const lines = p.code.split("\n").slice(0, 5)
      console.log(`    ${lines.join("\n    ")}`)
      if (p.code.split("\n").length > 5) console.log(`    ... (${p.code.split("\n").length - 5} satir daha)`)
    }
  }
  console.log(`\nReview Sonuclari:`)
  for (const r of ctx.reviews) {
    console.log(`  ${r.reviewer}: ${r.approved ? "ONAY" : "REVIZE"}`)
  }
  console.log("\n" + "═".repeat(60))
}

function extractKeywords(text: string): string[] {
  // Stop words
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "can", "shall", "this", "that",
    "these", "those", "it", "its", "i", "you", "he", "she", "we", "they",
    "what", "which", "who", "whom", "where", "when", "why", "how", "all",
    "each", "every", "both", "few", "more", "most", "other", "some", "such",
    "no", "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "as", "until", "while", "about", "between", "through",
    "during", "before", "after", "above", "below", "up", "down", "out",
    "off", "over", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "any", "both", "each",
    "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "s", "t", "don",
    "now",
  ])

  // Common programming terms to keep
  const keepTerms = new Set([
    "auth", "login", "user", "admin", "api", "route", "endpoint",
    "database", "db", "sql", "query", "model", "schema",
    "component", "page", "view", "layout", "template",
    "service", "controller", "handler", "middleware",
    "test", "spec", "mock", "fixture",
    "error", "bug", "fix", "issue", "crash",
    "config", "settings", "env", "environment",
    "type", "interface", "class", "function", "method",
    "import", "export", "module", "package",
    "git", "github", "ci", "cd", "deploy",
  ])

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !stopWords.has(word))

  // Deduplicate and take top keywords
  const unique = [...new Set(words)]
  return unique.slice(0, 10)
}
