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

interface ModelRef {
  providerID: ProviderID
  modelID: string
  model: LanguageModel
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
                issue: null as any,
                triage: null as any,
                plan: null as any,
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
                const treeRes = yield* Effect.promise(() =>
                  fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, {
                    headers: { Accept: "application/vnd.github.v3+json" },
                  }),
                )
                if (treeRes.ok) {
                  const treeData = (yield* Effect.promise(() => treeRes.json())) as any
                  const allFiles = (treeData.tree || [])
                    .filter((f: any) => f.type === "blob")
                    .map((f: any) => f.path as string)

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
                const techApproved = /lgtm|satisfactory|approved/i.test(techResult.text)

                // Style review
                const stylePrompt = fillTemplate(loadPrompt("style-reviewer"), {
                  proposals: proposalText.substring(0, 4000),
                })
                const styleResult = yield* Effect.promise(() =>
                  generateText({ model: selectedModel.model, messages: [{ role: "user", content: stylePrompt }] }),
                )
                const styleApproved = /lgtm|satisfactory|approved/i.test(styleResult.text)

                // Security review
                const secPrompt = fillTemplate(loadPrompt("security-reviewer"), {
                  proposals: proposalText.substring(0, 4000),
                })
                const secResult = yield* Effect.promise(() =>
                  generateText({ model: selectedModel.model, messages: [{ role: "user", content: secPrompt }] }),
                )
                const secApproved = /guvenli|safe|no issues/i.test(secResult.text)

                ctx.reviews = [
                  { reviewer: "technical", approved: techApproved, score: 0, feedback: techResult.text, suggestions: [] },
                  { reviewer: "style", approved: styleApproved, score: 0, feedback: styleResult.text, suggestions: [] },
                  { reviewer: "security", approved: secApproved, score: 0, feedback: secResult.text, suggestions: [] },
                ]

                s.message(`Teknik: ${techApproved ? "OK" : "REVIZE"} | Stil: ${styleApproved ? "OK" : "REVIZE"} | Guvenlik: ${secApproved ? "OK" : "REVIZE"}`)

                if (techApproved && styleApproved && secApproved) {
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

              ctx.applyResult = {
                success: filesToCommit.length > 0,
                filesChanged: filesToCommit.map((f) => f.path),
                errors: [],
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

async function runDebate(
  primaryModel: ModelRef,
  providers: Record<string, any>,
  context: { title: string; body: string; plan: string; fileContents: string },
): Promise<string> {
  const allModels: ModelRef[] = []
  for (const [pid, provider] of Object.entries(providers)) {
    const providerID = ProviderID.make(pid)
    for (const [modelID, model] of Object.entries((provider as any).models ?? {})) {
      if (pid !== primaryModel.providerID.toString() || modelID !== primaryModel.modelID) {
        allModels.push({ providerID, modelID, model: model as LanguageModel })
      }
    }
  }

  const debaters = [primaryModel, allModels[0], allModels[1]].filter(Boolean).slice(0, 3)
  const opinions: Array<{ model: string; solution: string; score: number }> = []

  for (const m of debaters) {
    const prompt = `Sen bir uzman yazilimciisin. Asagidaki issue icin en iyi kod cozumunu uret.

ISSUE: ${context.title}
ACIKLAMA: ${context.body}
PLAN: ${context.plan}
DOSYALAR: ${context.fileContents}

Cevabi su formatta ver (Her dosya icin Changes for \`dosya\`: ile basla):
### Changes for \`dosya/yolu\`:
\`\`\`[dil]
[kod]
\`\`\`

Neden bu cozumu sectigini kisa kisa acikla.`

    const result = await generateText({ model: m.model, messages: [{ role: "user", content: prompt }] })
    const score = evaluateSolution(result.text)
    opinions.push({ model: `${m.providerID}/${m.modelID}`, solution: result.text, score })
  }

  opinions.sort((a, b) => b.score - a.score)
  return opinions[0].solution
}

function evaluateSolution(solution: string): number {
  let score = 50
  if (solution.includes("```")) score += 10
  if (solution.length > 200) score += 10
  if (solution.includes("performance") || solution.includes("performans")) score += 5
  if (solution.includes("security") || solution.includes("guvenlik")) score += 5
  if (solution.includes("test")) score += 5
  if (solution.length > 500) score += 10
  return Math.min(100, score)
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
