import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5NetMatchTool = tool({
  description:
    "Manage UE5 matchmaking: find, create, join, leave matches, check status, cancel matchmaking, and report results. Sends net match commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["find", "create", "join", "leave", "status", "cancel", "report"])
      .describe("Matchmaking action to perform"),
    matchType: z
      .enum(["ranked", "casual", "custom"])
      .optional()
      .describe("Match type for find/create actions"),
    region: z
      .string()
      .optional()
      .describe("Server region for find/create actions (e.g. 'na-east', 'eu-west', 'asia')"),
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

    const { action, matchType, region } = args

    let command: string
    let description: string

    switch (action) {
      case "find":
        command = `net match find ${matchType ?? "casual"} ${region ?? ""}`.trim()
        description = `Searching for ${matchType ?? "casual"} match${region ? ` in ${region}` : ""}`
        break
      case "create":
        command = `net match create ${matchType ?? "custom"} ${region ?? ""}`.trim()
        description = `Created ${matchType ?? "custom"} match${region ? ` in ${region}` : ""}`
        break
      case "join":
        command = `net match join`
        description = "Joined the current match"
        break
      case "leave":
        command = `net match leave`
        description = "Left the current match"
        break
      case "status":
        command = `net match status`
        description = "Retrieved current match status"
        break
      case "cancel":
        command = `net match cancel`
        description = "Cancelled matchmaking"
        break
      case "report":
        command = `net match report`
        description = "Reported match results"
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      matchType,
      region,
    })

    if (!result.success) {
      return {
        output: `Net match command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        matchType,
        region,
      },
    }
  },
})
