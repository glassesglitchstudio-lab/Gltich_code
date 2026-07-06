import { getGitHubClient, resolveRepo, withRetry } from "../client"
import { cmd } from "../../cmd"
import { UI } from "../../../ui"

export const IssueCreateCommand = cmd({
  command: "create",
  describe: "Create a new issue",
  builder: (yargs) =>
    yargs
      .option("title", {
        alias: "t",
        type: "string",
        describe: "Issue title",
        demandOption: true,
      })
      .option("body", {
        alias: "b",
        type: "string",
        describe: "Issue description",
      })
      .option("label", {
        alias: "l",
        type: "array",
        describe: "Add labels",
      })
      .option("assignee", {
        alias: "a",
        type: "array",
        describe: "Assign users",
      })
      .option("milestone", {
        alias: "m",
        type: "number",
        describe: "Milestone number",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "Output as JSON",
      }),
  async handler(args) {
    const { owner, repo } = await resolveRepo()
    const { octoRest } = getGitHubClient()

    UI.println(`Creating issue in ${owner}/${repo}...`)

    const { data: issue } = await withRetry(() =>
      octoRest.rest.issues.create({
        owner,
        repo,
        title: args.title,
        body: args.body || "",
        labels: args.label as string[] | undefined,
        assignees: args.assignee as string[] | undefined,
        milestone: args.milestone || undefined,
      }),
    )

    if (args.json) {
      console.log(JSON.stringify(issue, null, 2))
      return
    }

    UI.println()
    UI.println(`  \x1b[32mIssue #${issue.number} created!\x1b[0m`)
    UI.println()
    UI.println(`  ${issue.title}`)
    UI.println(`  ${issue.html_url}`)
    UI.println()
  },
})
