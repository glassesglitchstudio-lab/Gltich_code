import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5NetLeaderboardTool = tool({
  description:
    "Manage UE5 multiplayer leaderboards: submit scores, query rankings, check player rank, clear entries, export data, and view global rankings. Sends net leaderboard commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["submit", "query", "rank", "clear", "export", "global"])
      .describe("Leaderboard action to perform"),
    scoreName: z
      .string()
      .optional()
      .describe("Leaderboard board name (e.g. 'highscore', 'speedrun')"),
    score: z
      .number()
      .optional()
      .describe("Score value for submit action"),
    playerName: z
      .string()
      .optional()
      .describe("Player name for rank and submit actions"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum entries to return for query/global actions"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return {
        output:
          "UE5 Editor is not connected. Make sure the editor is running with the Glitch Code plugin enabled.",
        metadata: { success: false },
      }
    }

    const { action, scoreName, score, playerName, limit } = args

    let command: string
    let description: string

    switch (action) {
      case "submit":
        if (!scoreName || score === undefined) {
          return {
            output: "Action 'submit' requires both scoreName and score.",
            metadata: { success: false },
          }
        }
        command = playerName
          ? `net leaderboard submit ${scoreName} ${score} ${playerName}`
          : `net leaderboard submit ${scoreName} ${score}`
        description = `Submitted score ${score} to '${scoreName}' leaderboard${playerName ? ` for ${playerName}` : ""}`
        break
      case "query":
        if (!scoreName) {
          return {
            output: "Action 'query' requires a scoreName.",
            metadata: { success: false },
          }
        }
        command = limit
          ? `net leaderboard query ${scoreName} ${limit}`
          : `net leaderboard query ${scoreName}`
        description = `Queried '${scoreName}' leaderboard${limit ? ` (top ${limit})` : ""}`
        break
      case "rank":
        if (!scoreName || !playerName) {
          return {
            output: "Action 'rank' requires both scoreName and playerName.",
            metadata: { success: false },
          }
        }
        command = `net leaderboard rank ${scoreName} ${playerName}`
        description = `Retrieved rank of '${playerName}' on '${scoreName}' leaderboard`
        break
      case "clear":
        if (!scoreName) {
          return {
            output: "Action 'clear' requires a scoreName.",
            metadata: { success: false },
          }
        }
        command = `net leaderboard clear ${scoreName}`
        description = `Cleared '${scoreName}' leaderboard`
        break
      case "export":
        command = scoreName ? `net leaderboard export ${scoreName}` : `net leaderboard export`
        description = `Exported${scoreName ? ` '${scoreName}'` : " all"} leaderboard data`
        break
      case "global":
        command = limit
          ? `net leaderboard global ${limit}`
          : `net leaderboard global`
        description = `Retrieved global leaderboard${limit ? ` (top ${limit})` : ""}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      scoreName,
      score,
      playerName,
      limit,
    })

    if (!result.success) {
      return {
        output: `Net leaderboard command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        scoreName,
        score,
        playerName,
        limit,
      },
    }
  },
})
