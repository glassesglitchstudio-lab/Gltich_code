import { getGitHubClient, resolveRepo, withRetry } from "../github/client"
import { cmd } from "../cmd"
import { UI } from "../../ui"
import type { PRSummary } from "../github/types"

interface GitHubPR {
  title: string
  body: string
  author: { login: string; name?: string }
  baseRefName: string
  headRefName: string
  headRefOid: string
  createdAt: string
  additions: number
  deletions: number
  state: string
  reviewDecision?: string
  mergeable: string
  mergeStateStatus: string
  url: string
  labels?: { nodes: Array<{ name: string; color: string }> }
  reviews?: {
    nodes: Array<{
      author: { login: string }
      state: string
      body: string
      submittedAt: string
    }>
  }
  commits?: {
    nodes: Array<{
      oid: string
      message: string
      author: { name: string; email: string }
    }>
  }
  files?: {
    nodes: Array<{
      path: string
      additions: number
      deletions: number
      changeType: string
    }>
  }
}

const PR_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        title
        body
        author { login name }
        baseRefName
        headRefName
        headRefOid
        createdAt
        additions
        deletions
        state
        reviewDecision
        mergeable
        mergeStateStatus
        url
        labels(first: 10) { nodes { name color } }
        reviews(first: 10) {
          nodes {
            author { login }
            state
            body
            submittedAt
          }
        }
        commits(first: 50) {
          nodes {
            oid
            message
            author { name email }
          }
        }
        files(first: 100) {
          nodes {
            path
            additions
            deletions
            changeType
          }
        }
      }
    }
  }
`

export const PrViewCommand = cmd({
  command: "view <number>",
  describe: "View pull request details",
  builder: (yargs) =>
    yargs
      .positional("number", {
        type: "number",
        describe: "PR number",
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
      octoGraph(PR_QUERY, { owner, repo, number: args.number }) as Promise<{ repository: { pullRequest: GitHubPR | null } }>,
    )

    const pr = response.repository.pullRequest
    if (!pr) {
      UI.error(`PR #${args.number} not found in ${owner}/${repo}`)
      process.exit(1)
    }

    if (args.json) {
      console.log(JSON.stringify(pr, null, 2))
      return
    }

    UI.println()
    UI.println(`  #${args.number} ${pr.title}`)
    UI.println()

    const stateIcon = pr.state === "MERGED" ? "\x1b[35mMerged\x1b[0m"
      : pr.state === "CLOSED" ? "\x1b[31mClosed\x1b[0m"
        : "\x1b[32mOpen\x1b[0m"

    UI.println(`  Status:      ${stateIcon}`)
    UI.println(`  Author:      ${pr.author.login}`)
    UI.println(`  Branch:      ${pr.headRefName} → ${pr.baseRefName}`)
    UI.println(`  Created:     ${new Date(pr.createdAt).toLocaleString()}`)
    UI.println(`  Changes:     +${pr.additions}/-${pr.deletions}`)
    UI.println(`  Mergeable:   ${pr.mergeable}`)
    UI.println(`  Review:      ${pr.reviewDecision || "None"}`)

    if (pr.labels?.nodes?.length) {
      const labels = (pr.labels.nodes as Array<{ name: string }>).map((l) => `\x1b[36m${l.name}\x1b[0m`).join(", ")
      UI.println(`  Labels:      ${labels}`)
    }

    if (pr.reviews?.nodes?.length) {
      UI.println()
      UI.println("  Reviews:")
      for (const review of pr.reviews.nodes) {
        const stateColor = review.state === "APPROVED" ? "\x1b[32m"
          : review.state === "CHANGES_REQUESTED" ? "\x1b[31m"
            : "\x1b[33m"
        UI.println(`    ${stateColor}${review.state}\x1b[0m by ${review.author.login}`)
        if (review.body) {
          UI.println(`      ${review.body.slice(0, 100)}${review.body.length > 100 ? "..." : ""}`)
        }
      }
    }

    if (pr.commits?.nodes?.length) {
      UI.println()
      UI.println("  Commits:")
      for (const commit of pr.commits.nodes.slice(0, 5)) {
        UI.println(`    \x1b[33m${commit.oid.slice(0, 7)}\x1b[0m ${commit.message.split("\n")[0]}`)
      }
      if (pr.commits.nodes.length > 5) {
        UI.println(`    ... and ${pr.commits.nodes.length - 5} more commits`)
      }
    }

    if (pr.files?.nodes?.length) {
      UI.println()
      UI.println("  Files changed:")
      for (const file of pr.files.nodes.slice(0, 10)) {
        UI.println(
          `    \x1b[32m+${file.additions}\x1b[0m \x1b[31m-${file.deletions}\x1b[0m ${file.path}`,
        )
      }
      if (pr.files.nodes.length > 10) {
        UI.println(`    ... and ${pr.files.nodes.length - 10} more files`)
      }
    }

    UI.println()
  },
})
