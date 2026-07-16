import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5NetChatTool = tool({
  description:
    "Manage UE5 in-game chat system: send messages, view history, clear chat, mute/unmute players, and set chat channels. Sends net chat commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["send", "history", "clear", "mute", "unmute", "set-channel"])
      .describe("Chat action to perform"),
    message: z
      .string()
      .optional()
      .describe("Chat message text for send action"),
    channel: z
      .string()
      .optional()
      .describe("Chat channel name (e.g. 'global', 'team', 'whisper')"),
    playerName: z
      .string()
      .optional()
      .describe("Player name for mute/unmute actions"),
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

    const { action, message, channel, playerName } = args

    let command: string
    let description: string

    switch (action) {
      case "send":
        if (!message) {
          return {
            output: "Action 'send' requires a message.",
            metadata: { success: false },
          }
        }
        command = channel
          ? `net chat send ${channel} ${message}`
          : `net chat send ${message}`
        description = `Sent chat message${channel ? ` to channel '${channel}'` : ""}`
        break
      case "history":
        command = channel ? `net chat history ${channel}` : `net chat history`
        description = `Retrieved chat history${channel ? ` for channel '${channel}'` : ""}`
        break
      case "clear":
        command = channel ? `net chat clear ${channel}` : `net chat clear`
        description = `Cleared chat${channel ? ` for channel '${channel}'` : ""}`
        break
      case "mute":
        if (!playerName) {
          return {
            output: "Action 'mute' requires a playerName.",
            metadata: { success: false },
          }
        }
        command = `net chat mute ${playerName}`
        description = `Muted player '${playerName}' in chat`
        break
      case "unmute":
        if (!playerName) {
          return {
            output: "Action 'unmute' requires a playerName.",
            metadata: { success: false },
          }
        }
        command = `net chat unmute ${playerName}`
        description = `Unmuted player '${playerName}' in chat`
        break
      case "set-channel":
        if (!channel) {
          return {
            output: "Action 'set-channel' requires a channel name.",
            metadata: { success: false },
          }
        }
        command = `net chat set-channel ${channel}`
        description = `Switched to chat channel '${channel}'`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      message,
      channel,
      playerName,
    })

    if (!result.success) {
      return {
        output: `Net chat command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        message,
        channel,
        playerName,
      },
    }
  },
})
