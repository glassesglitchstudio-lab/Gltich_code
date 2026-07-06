import { getGitHubClient, resolveRepo, withRetry } from "../github/client"
import { cmd } from "../cmd"
import { UI } from "../../ui"

export const PrReviewCommand = cmd({
  command: "review <number>",
  describe: "Review a pull request",
  builder: (yargs) =>
    yargs
      .positional("number", {
        type: "number",
        describe: "PR number",
        demandOption: true,
      })
      .option("approve", {
        alias: "a",
        type: "boolean",
        default: false,
        describe: "Approve the PR",
      })
      .option("request-changes", {
        alias: "r",
        type: "boolean",
        default: false,
        describe: "Request changes",
      })
      .option("comment", {
        alias: "m",
        type: "string",
        describe: "Review comment",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "Output as JSON",
      }),
  async handler(args) {
    const { owner, repo } = await resolveRepo()
    const { octoRest } = getGitHubClient()

    let event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
    if (args.approve) {
      event = "APPROVE"
    } else if (args["request-changes"]) {
      event = "REQUEST_CHANGES"
    } else {
      event = "COMMENT"
    }

    const body = args.comment || getDefaultComment(event)

    UI.println(`Reviewing PR #${args.number}...`)
    UI.println(`  Event: ${event}`)

    const { data: review } = await withRetry(() =>
      octoRest.rest.pulls.createReview({
        owner,
        repo,
        pull_number: args.number,
        event,
        body,
      }),
    )

    if (args.json) {
      console.log(JSON.stringify(review, null, 2))
      return
    }

    UI.println()
    const stateColor = event === "APPROVE" ? "\x1b[32m"
      : event === "REQUEST_CHANGES" ? "\x1b[31m"
        : "\x1b[33m"

    UI.println(`  ${stateColor}${event}\x1b[0m on PR #${args.number}`)
    UI.println(`  ${review.html_url}`)
    UI.println()
  },
})

function getDefaultComment(event: string): string {
  switch (event) {
    case "APPROVE":
      return "LGTM! Changes look good."
    case "REQUEST_CHANGES":
      return "Changes requested. Please review the feedback."
    default:
      return "Review completed."
  }
}
