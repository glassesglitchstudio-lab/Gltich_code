import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5NetLobbyTool = tool({
  description:
    "Manage UE5 multiplayer lobbies: create, join, leave, list lobbies, toggle ready state, update settings, and start the match. Sends net lobby commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["create", "join", "leave", "list", "ready", "settings", "start"])
      .describe("Lobby action to perform"),
    lobbyName: z
      .string()
      .optional()
      .describe("Lobby name for create/join actions"),
    maxPlayers: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum player count for lobby creation"),
    settings: z
      .string()
      .optional()
      .describe("JSON settings string for the settings action"),
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

    const { action, lobbyName, maxPlayers, settings } = args

    let command: string
    let description: string

    switch (action) {
      case "create":
        if (!lobbyName) {
          return {
            output: "Action 'create' requires a lobbyName.",
            metadata: { success: false },
          }
        }
        command = maxPlayers
          ? `net lobby create ${lobbyName} ${maxPlayers}`
          : `net lobby create ${lobbyName}`
        description = `Created lobby '${lobbyName}'${maxPlayers ? ` with max ${maxPlayers} players` : ""}`
        break
      case "join":
        if (!lobbyName) {
          return {
            output: "Action 'join' requires a lobbyName.",
            metadata: { success: false },
          }
        }
        command = `net lobby join ${lobbyName}`
        description = `Joined lobby '${lobbyName}'`
        break
      case "leave":
        command = `net lobby leave`
        description = "Left the current lobby"
        break
      case "list":
        command = `net lobby list`
        description = "Listed all available lobbies"
        break
      case "ready":
        command = `net lobby ready`
        description = "Toggled ready state in the current lobby"
        break
      case "settings":
        if (!settings) {
          return {
            output: "Action 'settings' requires a settings JSON string.",
            metadata: { success: false },
          }
        }
        command = `net lobby settings ${settings}`
        description = "Updated lobby settings"
        break
      case "start":
        command = `net lobby start`
        description = "Started the match from the current lobby"
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      lobbyName,
      maxPlayers,
      settings,
    })

    if (!result.success) {
      return {
        output: `Net lobby command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        lobbyName,
        maxPlayers,
        settings,
      },
    }
  },
})
