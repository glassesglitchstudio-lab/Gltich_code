import { getGitHubClient, resolveRepo, withRetry } from "../client"
import { cmd } from "../../cmd"
import { UI } from "../../../ui"
import type { IssueSummary } from "../types"

const ISSUE_VIEW_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        number
        title
        body
        state
        createdAt
        url
        author { login name }
        labels(first: 10) { nodes { name color } }
        assignees(first: 5) { nodes { login } }
        milestone { title }
        comments(first: 20) {
          totalCount
          nodes {
            author { login }
            body
            createdAt
          }
        }
      }
    }
  }
`

export const IssueViewCommand = cmd({
  command: "view <number>",
  describe: "View issue details",
  builder: (yargs) =>
    yargs
      .positional("number", {
        type: "number",
        describe: "Issue number",
        demandOption: true,
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "Output as JSON",
      }),
  async handler(args) {
    const { owner, repo } = await resolveRepo()
    const { octoGraph } = getGitHubClient()

    const response = await withRetry(() =>
      octoGraph(ISSUE_VIEW_QUERY, { owner, repo, number: args.number }) as Promise<any>,
    )

    const issue = response.repository.issue as any
    if (!issue) {
      UI.error(`Issue #${args.number} not found in ${owner}/${repo}`)
      process.exit(1)
    }

    if (args.json) {
      console.log(JSON.stringify(issue, null, 2))
      return
    }

    UI.println()
    UI.println(`  #${issue.number} ${issue.title}`)
    UI.println()

    const stateIcon = issue.state === "OPEN" ? "\x1b[32mOpen\x1b[0m" : "\x1b[31mClosed\x1b[0m"
    UI.println(`  Status:    ${stateIcon}`)
    UI.println(`  Author:    ${issue.author?.login || "unknown"}`)
    UI.println(`  Created:   ${new Date(issue.createdAt).toLocaleString()}`)

    if (issue.labels?.nodes?.length) {
      const labels = issue.labels.nodes.map((l: any) => `\x1b[36m${l.name}\x1b[0m`).join(", ")
      UI.println(`  Labels:    ${labels}`)
    }

    if (issue.assignees?.nodes?.length) {
      const assignees = issue.assignees.nodes.map((a: any) => a.login).join(", ")
      UI.println(`  Assignees: ${assignees}`)
    }

    if (issue.milestone) {
      UI.println(`  Milestone: ${issue.milestone.title}`)
    }

    UI.println()
    UI.println("  Description:")
    UI.println(`  ${"-".repeat(50)}`)

    const body = issue.body || "No description"
    const lines = body.split("\n").slice(0, 20)
    for (const line of lines) {
      UI.println(`  ${line}`)
    }
    if (body.split("\n").length > 20) {
      UI.println(`  ... (${body.split("\n").length - 20} more lines)`)
    }

    if (issue.comments?.nodes?.length) {
      UI.println()
      UI.println(`  Comments (${issue.comments.totalCount}):`)
      UI.println(`  ${"-".repeat(50)}`)

      for (const comment of issue.comments.nodes.slice(0, 5)) {
        UI.println()
        UI.println(`  \x1b[33m${comment.author?.login || "unknown"}\x1b[0m commented at ${new Date(comment.createdAt).toLocaleString()}:`)
        const commentLines = comment.body.split("\n").slice(0, 10)
        for (const line of commentLines) {
          UI.println(`    ${line}`)
        }
        if (comment.body.split("\n").length > 10) {
          UI.println(`    ... (${comment.body.split("\n").length - 10} more lines)`)
        }
      }

      if (issue.comments.totalCount > 5) {
        UI.println()
        UI.println(`  ... and ${issue.comments.totalCount - 5} more comments`)
      }
    }

    UI.println()
  },
})
