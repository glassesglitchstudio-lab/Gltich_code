import { UI } from "../ui"
import { cmd } from "./cmd"
import { AppRuntime } from "@/effect/app-runtime"
import { Git } from "@/git"
import { Instance } from "@/project/instance"
import { Process } from "@/util"
import { PrListCommand } from "./pr/list"
import { PrViewCommand } from "./pr/view"
import { PrCreateCommand } from "./pr/create"
import { PrReviewCommand } from "./pr/review"

export const PrCommand = cmd({
  command: "pr",
  describe: "Pull request management",
  builder: (yargs) =>
    yargs
      .command(PrListCommand)
      .command(PrViewCommand)
      .command(PrCreateCommand)
      .command(PrReviewCommand)
      .command(
        "checkout <number>",
        "Fetch and checkout a PR branch, then run glitchcode",
        (yargs) =>
          yargs.positional("number", {
            type: "number",
            describe: "PR number to checkout",
            demandOption: true,
          }),
        async (args) => {
          await Instance.provide({
            directory: process.cwd(),
            async fn() {
              const project = Instance.project
              if (project.vcs !== "git") {
                UI.error("Could not find git repository. Please run this command from a git repository.")
                process.exit(1)
              }

              const prNumber = args.number
              const localBranchName = `pr/${prNumber}`
              UI.println(`Fetching and checking out PR #${prNumber}...`)

              const result = await Process.run(
                ["gh", "pr", "checkout", `${prNumber}`, "--branch", localBranchName, "--force"],
                {
                  nothrow: true,
                },
              )

              if (result.code !== 0) {
                UI.error(`Failed to checkout PR #${prNumber}. Make sure you have gh CLI installed and authenticated.`)
                process.exit(1)
              }

              const prInfoResult = await Process.text(
                [
                  "gh",
                  "pr",
                  "view",
                  `${prNumber}`,
                  "--json",
                  "headRepository,headRepositoryOwner,isCrossRepository,headRefName,body",
                ],
                { nothrow: true },
              )

              let sessionId: string | undefined

              if (prInfoResult.code === 0) {
                const prInfoText = prInfoResult.text
                if (prInfoText.trim()) {
                  const prInfo = JSON.parse(prInfoText)

                  if (prInfo && prInfo.isCrossRepository && prInfo.headRepository && prInfo.headRepositoryOwner) {
                    const forkOwner = prInfo.headRepositoryOwner.login
                    const forkName = prInfo.headRepository.name
                    const remoteName = `fork-${forkOwner}`

                    const remotes = await AppRuntime.runPromise(
                      Git.Service.use((git) => git.run(["remote"], { cwd: Instance.worktree })),
                    ).then((x) => x.text().trim())
                    const remoteList = remotes.split(/\r?\n/).map((r) => r.trim()).filter(Boolean)
                    if (!remoteList.includes(remoteName)) {
                      await AppRuntime.runPromise(
                        Git.Service.use((git) =>
                          git.run(["remote", "add", remoteName, `https://github.com/${forkOwner}/${forkName}.git`], {
                            cwd: Instance.worktree,
                          }),
                        ),
                      )
                      UI.println(`Added fork remote: ${remoteName}`)
                    }

                    const headRefName = prInfo.headRefName
                    await AppRuntime.runPromise(
                      Git.Service.use((git) =>
                        git.run(["branch", `--set-upstream-to=${remoteName}/${headRefName}`, localBranchName], {
                          cwd: Instance.worktree,
                        }),
                      ),
                    )
                  }

                  if (prInfo && prInfo.body) {
                    const sessionMatch = prInfo.body.match(/https:\/\/opncd\.ai\/s\/([a-zA-Z0-9_-]+)/)
                    if (sessionMatch) {
                      const sessionUrl = sessionMatch[0]
                      UI.println(`Found glitchcode session: ${sessionUrl}`)
                      UI.println(`Importing session...`)

                      const importResult = await Process.text(["glitch", "import", sessionUrl], {
                        nothrow: true,
                      })
                      if (importResult.code === 0) {
                        const importOutput = importResult.text.trim()
                        const sessionIdMatch = importOutput.match(/Imported session: ([a-zA-Z0-9_-]+)/)
                        if (sessionIdMatch) {
                          sessionId = sessionIdMatch[1]
                          UI.println(`Session imported: ${sessionId}`)
                        }
                      }
                    }
                  }
                }
              }

              UI.println(`Successfully checked out PR #${prNumber} as branch '${localBranchName}'`)
              UI.println()
              UI.println("Starting glitchcode...")
              UI.println()

              const glitchArgs = sessionId ? ["-s", sessionId] : []
              const glitchProcess = Process.spawn(["glitch", ...glitchArgs], {
                stdin: "inherit",
                stdout: "inherit",
                stderr: "inherit",
                cwd: process.cwd(),
              })
              const code = await glitchProcess.exited
              if (code !== 0) throw new Error(`mimo exited with code ${code}`)
            },
          })
        },
      )
      .demandCommand(1, "Specify a subcommand: list, view, create, review, checkout"),
  async handler() {
    UI.println("Usage: glitch pr <subcommand>")
    UI.println()
    UI.println("Subcommands:")
    UI.println("  list         List pull requests")
    UI.println("  view <N>     View PR details")
    UI.println("  create       Create a new PR")
    UI.println("  review <N>   Review a PR")
    UI.println("  checkout <N> Checkout PR and start glitchcode")
  },
})
