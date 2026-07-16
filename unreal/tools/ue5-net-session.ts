import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5NetSessionTool = tool({
  description:
    "Manage UE5 multiplayer sessions: create, join, leave, list, inspect sessions, and manage players with kick/ban. Sends net session commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["create", "join", "leave", "list", "info", "kick", "ban"])
      .describe("Session management action to perform"),
    sessionName: z
      .string()
      .optional()
      .describe("Session name for create/join actions"),
    sessionId: z
      .string()
      .optional()
      .describe("Session ID for join/info/kick/ban actions"),
    playerName: z
      .string()
      .optional()
      .describe("Player name for kick/ban actions"),
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

    const { action, sessionName, sessionId, playerName } = args

    let command: string
    let description: string

    switch (action) {
      case "create":
        if (!sessionName) {
          return {
            output: "Action 'create' requires a sessionName.",
            metadata: { success: false },
          }
        }
        command = `net session create ${sessionName}`
        description = `Created session '${sessionName}'`
        break
      case "join":
        if (!sessionId) {
          return {
            output: "Action 'join' requires a sessionId.",
            metadata: { success: false },
          }
        }
        command = `net session join ${sessionId}`
        description = `Joined session '${sessionId}'`
        break
      case "leave":
        command = `net session leave`
        description = "Left the current session"
        break
      case "list":
        command = `net session list`
        description = "Listed all available sessions"
        break
      case "info":
        if (!sessionId) {
          return {
            output: "Action 'info' requires a sessionId.",
            metadata: { success: false },
          }
        }
        command = `net session info ${sessionId}`
        description = `Retrieved info for session '${sessionId}'`
        break
      case "kick":
        if (!playerName) {
          return {
            output: "Action 'kick' requires a playerName.",
            metadata: { success: false },
          }
        }
        command = `net session kick ${playerName}`
        description = `Kicked player '${playerName}' from the session`
        break
      case "ban":
        if (!playerName) {
          return {
            output: "Action 'ban' requires a playerName.",
            metadata: { success: false },
          }
        }
        command = `net session ban ${playerName}`
        description = `Banned player '${playerName}' from the session`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      sessionName,
      sessionId,
      playerName,
    })

    if (!result.success) {
      return {
        output: `Net session command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        sessionName,
        sessionId,
        playerName,
      },
    }
  },
})
