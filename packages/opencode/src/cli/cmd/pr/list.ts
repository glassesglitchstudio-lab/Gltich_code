import { getGitHubClient, resolveRepo, withRetry } from "../github/client"
import { cmd } from "../cmd"
import { UI } from "../../ui"

export const PrListCommand = cmd({
  command: "list",
  describe: "List pull requests",
  builder: (yargs) =>
    yargs
      .option("state", {
        type: "string",
        choices: ["open", "closed", "all"] as const,
        default: "open",
        describe: "Filter by state",
      })
      .option("limit", {
        alias: "n",
        type: "number",
        default: 20,
        describe: "Number of PRs to show",
      })
      .option("author", {
        type: "string",
        describe: "Filter by author",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "Output as JSON",
      }),
  async handler(args) {
    const { owner, repo } = await resolveRepo()
    const { octoRest } = getGitHubClient()

    const { data: pulls } = await withRetry(() =>
      octoRest.rest.pulls.list({
        owner,
        repo,
        state: args.state as "open" | "closed" | "all",
        per_page: args.limit,
        sort: "created",
        direction: "desc",
        ...(args.author ? { head: args.author } : {}),
      }),
    )

    if (args.json) {
      console.log(JSON.stringify(pulls, null, 2))
      return
    }

    if (pulls.length === 0) {
      UI.println(`No ${args.state} pull requests found.`)
      return
    }

    UI.println()
    UI.println(`  ${args.state.toUpperCase()} Pull Requests (${pulls.length})`)
    UI.println()

    for (const pr of pulls) {
      const stateIcon = pr.draft
        ? "\x1b[33m[Draft]\x1b[0m"
        : pr.merged_at
          ? "\x1b[35m[Merged]\x1b[0m"
          : pr.state === "closed"
            ? "\x1b[31m[Closed]\x1b[0m"
            : "\x1b[32m[Open]\x1b[0m"

      const labels = pr.labels
        .map((l) => `\x1b[36m${l.name}\x1b[0m`)
        .join(" ")

      const author = pr.user?.login || "unknown"
      const date = new Date(pr.created_at).toLocaleDateString()

      UI.println(
        `  ${stateIcon} #${pr.number} ${pr.title}`,
      )
      UI.println(
        `    \x1b[90m${author} opened ${date}\x1b[0m`,
      )
      if (labels) {
        UI.println(`    ${labels}`)
      }
      UI.println()
    }
  },
})
