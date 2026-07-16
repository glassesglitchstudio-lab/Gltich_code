import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5UiNotificationTool = tool({
  description:
    "Manage UE5 in-game notifications: send, clear, queue, style, dismiss, and view history. Uses the 'ui notification' console command.",
  args: {
    action: z
      .enum(["send", "clear", "queue", "style", "dismiss", "history"])
      .describe("Notification action to perform"),
    message: z.string().optional().describe("Notification message text"),
    notifType: z
      .enum(["info", "warning", "error", "success", "quest"])
      .optional()
      .describe("Notification type / severity"),
    duration: z.number().optional().describe("Display duration in seconds"),
    priority: z
      .enum(["low", "medium", "high", "critical"])
      .optional()
      .describe("Notification priority level"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return {
        output: "UE5 Editor is not connected.",
        metadata: { success: false },
      }
    }

    const { action, message, notifType, duration, priority } = args

    if (action === "send" && !message) {
      return {
        output: "Action 'send' requires a message parameter.",
        metadata: { success: false },
      }
    }

    if (action === "style" && !notifType) {
      return {
        output: "Action 'style' requires a notifType parameter.",
        metadata: { success: false },
      }
    }

    let command = `ui notification ${action}`
    if (message) command += ` ${message}`
    if (notifType) command += ` ${notifType}`
    if (duration !== undefined) command += ` ${duration}`
    if (priority) command += ` ${priority}`

    const result = await connector.sendCommand(command, { action, message, notifType, duration, priority })

    if (!result.success) {
      return {
        output: `Notification command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    let output = ""
    switch (action) {
      case "send":
        output = `Notification sent (${notifType ?? "info"}): "${message}".`
        break
      case "clear":
        output = "All notifications cleared."
        break
      case "queue":
        output = result.result || "Notification queue displayed."
        break
      case "style":
        output = `Notification style set to "${notifType}".`
        break
      case "dismiss":
        output = "Notification dismissed."
        break
      case "history":
        output = result.result || "Notification history retrieved."
        break
    }

    return {
      output: `${output}\n${result.result ?? ""}`,
      metadata: { success: true, action, message, notifType, duration, priority },
    }
  },
})
