import { getGitHubClient, withRetry } from "../client"
import { cmd } from "../../cmd"
import { UI } from "../../../ui"

export const IssueSearchCommand = cmd({
  command: "search <query>",
  describe: "Search issues and pull requests",
  builder: (yargs) =>
    yargs
      .positional("query", {
        type: "string",
        describe: "Search query",
        demandOption: true,
      })
      .option("limit", {
        alias: "n",
        type: "number",
        default: 20,
        describe: "Number of results",
      })
      .option("type", {
        type: "string",
        choices: ["issue", "pr", "all"] as const,
        default: "all",
        describe: "Filter by type",
      })
      .option("state", {
        type: "string",
        choices: ["open", "closed", "all"] as const,
        default: "all",
        describe: "Filter by state",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "Output as JSON",
      }),
  async handler(args) {
    const { octoRest } = getGitHubClient()

    let q = args.query
    if (args.type === "issue") q += " is:issue"
    if (args.type === "pr") q += " is:pr"
    if (args.state !== "all") q += ` is:${args.state}`

    const { data } = await withRetry(() =>
      octoRest.rest.search.issuesAndPullRequests({
        q,
        per_page: args.limit,
      }),
    )

    if (args.json) {
      console.log(JSON.stringify(data.items, null, 2))
      return
    }

    if (data.items.length === 0) {
      UI.println(`No results for "${args.query}".`)
      return
    }

    UI.println()
    UI.println(`  Search Results for "${args.query}" (${data.total_count} total, showing ${data.items.length})`)
    UI.println()

    for (const item of data.items) {
      const isPr = item.pull_request
      const typeIcon = isPr ? "\x1b[35m[PR]\x1b[0m" : "\x1b[32m[Issue]\x1b[0m"
      const stateIcon = item.state === "open" ? "\x1b[32mOpen\x1b[0m" : "\x1b[31mClosed\x1b[0m"
      const labels = item.labels
        .map((l) => `\x1b[36m${l.name}\x1b[0m`)
        .join(" ")

      const repoMatch = item.repository_url.match(/\/repos\/([^/]+)\/([^/]+)$/)
      const repo = repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : ""

      UI.println(`  ${typeIcon} ${stateIcon} #${item.number} ${item.title}`)
      UI.println(
        `    \x1b[90m${repo} | ${item.user?.login || "unknown"} | ${new Date(item.created_at).toLocaleDateString()} | ${item.comments} comments\x1b[0m`,
      )
      if (labels) UI.println(`    ${labels}`)
      UI.println()
    }
  },
})
