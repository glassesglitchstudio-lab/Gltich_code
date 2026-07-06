import { getGitHubClient, resolveRepo, withRetry } from "../client"
import { cmd } from "../../cmd"
import { UI } from "../../../ui"
import type { IssueSummary } from "../types"

const ISSUE_LIST_QUERY = `
  query($owner: String!, $repo: String!, $state: IssueState!, $first: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      issues(first: $first, after: $after, states: [$state], orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes {
          number
          title
          body
          state
          createdAt
          url
          author { login }
          labels(first: 10) { nodes { name color } }
          assignees(first: 5) { nodes { login } }
          milestone { title }
          comments { totalCount }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

export const IssueListCommand = cmd({
  command: "list",
  describe: "List issues",
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
        describe: "Number of issues to show",
      })
      .option("label", {
        type: "array",
        describe: "Filter by label",
      })
      .option("assignee", {
        type: "string",
        describe: "Filter by assignee",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "Output as JSON",
      }),
  async handler(args) {
    const { owner, repo } = await resolveRepo()
    const { octoGraph } = getGitHubClient()

    const state = args.state === "all" ? "ALL" : args.state.toUpperCase() as "OPEN" | "CLOSED"

    const response = await withRetry(() =>
      octoGraph(ISSUE_LIST_QUERY, {
        owner,
        repo,
        state,
        first: args.limit,
      }) as Promise<any>,
    )

    let issues: IssueSummary[] = response.repository.issues.nodes

    // Filtreleme (API tarafında yapılamayanlar)
    if (args.label?.length) {
      issues = issues.filter((issue) =>
        issue.labels.nodes.some((l) => (args.label as string[]).includes(l.name)),
      )
    }

    if (args.assignee) {
      issues = issues.filter((issue) =>
        issue.assignees.nodes.some((a) => a.login === args.assignee),
      )
    }

    // PR'ları filtrele (issue olarak gözükür)
    issues = issues.filter((issue) => !issue.url.includes("/pull/"))

    if (args.json) {
      console.log(JSON.stringify(issues, null, 2))
      return
    }

    if (issues.length === 0) {
      UI.println(`No ${args.state} issues found.`)
      return
    }

    UI.println()
    UI.println(`  ${args.state.toUpperCase()} Issues (${issues.length})`)
    UI.println()

    for (const issue of issues) {
      const stateIcon = issue.state === "OPEN" ? "\x1b[32m[Open]\x1b[0m" : "\x1b[31m[Closed]\x1b[0m"
      const labels = issue.labels.nodes.map((l) => `\x1b[36m${l.name}\x1b[0m`).join(" ")
      const assignees = issue.assignees.nodes.map((a) => a.login).join(", ")
      const date = new Date(issue.createdAt).toLocaleDateString()

      UI.println(`  ${stateIcon} #${issue.number} ${issue.title}`)
      UI.println(
        `    \x1b[90m${issue.author?.login || "unknown"} opened ${date} | ${issue.comments?.totalCount || 0} comments\x1b[0m`,
      )
      if (labels) UI.println(`    ${labels}`)
      if (assignees) UI.println(`    \x1b[90mAssignees: ${assignees}\x1b[0m`)
      UI.println()
    }
  },
})
