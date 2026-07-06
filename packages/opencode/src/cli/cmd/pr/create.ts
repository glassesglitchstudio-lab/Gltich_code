import { getGitHubClient, resolveRepo, withRetry } from "../github/client"
import { cmd } from "../cmd"
import { UI } from "../../ui"
import { Git } from "@/git"
import { AppRuntime } from "@/effect/app-runtime"
import { Instance } from "@/project/instance"

export const PrCreateCommand = cmd({
  command: "create",
  describe: "Create a pull request",
  builder: (yargs) =>
    yargs
      .option("title", {
        alias: "t",
        type: "string",
        describe: "PR title",
      })
      .option("body", {
        alias: "b",
        type: "string",
        describe: "PR description",
      })
      .option("base", {
        type: "string",
        default: "main",
        describe: "Base branch",
      })
      .option("head", {
        type: "string",
        describe: "Head branch (current branch if not specified)",
      })
      .option("draft", {
        alias: "d",
        type: "boolean",
        default: false,
        describe: "Create as draft PR",
      })
      .option("reviewer", {
        alias: "r",
        type: "array",
        describe: "Add reviewers (usernames)",
      })
      .option("label", {
        alias: "l",
        type: "array",
        describe: "Add labels",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "Output as JSON",
      }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const { owner, repo } = await resolveRepo()
        const { octoRest } = getGitHubClient()

        let headBranch = args.head
        if (!headBranch) {
          try {
            const result = await AppRuntime.runPromise(
              Git.Service.use((git) => git.run(["branch", "--show-current"], { cwd: Instance.worktree })),
            )
            headBranch = result.text().trim()
          } catch {
            UI.error("Could not determine current branch. Use --head to specify.")
            process.exit(1)
          }
        }

        if (!headBranch) {
          UI.error("Not on a branch. Use --head to specify the head branch.")
          process.exit(1)
        }

        let title = args.title
        let body = args.body

        if (!title) {
          // Commit mesajından başlık türet
          try {
            const result = await AppRuntime.runPromise(
              Git.Service.use((git) =>
                git.run(["log", "--oneline", "-1", "--format=%s"], { cwd: Instance.worktree }),
              ),
            )
            title = result.text().trim()
          } catch {
            title = `PR from ${headBranch}`
          }
        }

        if (!body) {
          // Son commit'lerden body oluştur
          try {
            const result = await AppRuntime.runPromise(
              Git.Service.use((git) =>
                git.run(
                  ["log", "--oneline", "-5", "--format=- %s"],
                  { cwd: Instance.worktree },
                ),
              ),
            )
            body = `## Changes\n\n${result.text().trim()}`
          } catch {
            body = `PR from ${headBranch} to ${args.base}`
          }
        }

        UI.println(`Creating PR: ${headBranch} → ${args.base}...`)

        const { data: pr } = await withRetry(() =>
          octoRest.rest.pulls.create({
            owner,
            repo,
            title,
            body,
            head: headBranch,
            base: args.base,
            draft: args.draft,
          }),
        )

        // Reviewer ekle
        if (args.reviewer?.length) {
          await withRetry(() =>
            octoRest.rest.pulls.requestReviewers({
              owner,
              repo,
              pull_number: pr.number,
              reviewers: args.reviewer as string[],
            }),
          )
          UI.println(`Added reviewers: ${args.reviewer.join(", ")}`)
        }

        // Label ekle
        if (args.label?.length) {
          await withRetry(() =>
            octoRest.rest.issues.addLabels({
              owner,
              repo,
              issue_number: pr.number,
              labels: args.label as string[],
            }),
          )
          UI.println(`Added labels: ${args.label.join(", ")}`)
        }

        if (args.json) {
          console.log(JSON.stringify(pr, null, 2))
          return
        }

        UI.println()
        UI.println(`  \x1b[32mPR #${pr.number} created!\x1b[0m`)
        UI.println()
        UI.println(`  ${pr.title}`)
        UI.println(`  ${pr.html_url}`)
        UI.println()
      },
    })
  },
})
