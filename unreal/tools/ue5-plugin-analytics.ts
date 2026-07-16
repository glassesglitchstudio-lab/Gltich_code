import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5PluginAnalyticsTool = tool({
  description:
    "Manage UE5 plugin analytics: track events, generate reports, start/end analytics sessions, fire custom events, and export data. Sends plugin analytics commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["track", "report", "session-start", "session-end", "custom-event", "export"])
      .describe("Analytics action to perform"),
    eventName: z
      .string()
      .optional()
      .describe("Event name for track and custom-event actions"),
    eventData: z
      .string()
      .optional()
      .describe("JSON event data string for track and custom-event actions"),
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

    const { action, eventName, eventData } = args

    let command: string
    let description: string

    switch (action) {
      case "track":
        if (!eventName) {
          return {
            output: "Action 'track' requires an eventName.",
            metadata: { success: false },
          }
        }
        command = eventData
          ? `plugin analytics track ${eventName} ${eventData}`
          : `plugin analytics track ${eventName}`
        description = `Tracked event '${eventName}'`
        break
      case "report":
        command = `plugin analytics report`
        description = "Generated analytics report"
        break
      case "session-start":
        command = `plugin analytics session-start`
        description = "Started analytics session"
        break
      case "session-end":
        command = `plugin analytics session-end`
        description = "Ended analytics session"
        break
      case "custom-event":
        if (!eventName) {
          return {
            output: "Action 'custom-event' requires an eventName.",
            metadata: { success: false },
          }
        }
        command = eventData
          ? `plugin analytics custom-event ${eventName} ${eventData}`
          : `plugin analytics custom-event ${eventName}`
        description = `Fired custom event '${eventName}'`
        break
      case "export":
        command = `plugin analytics export`
        description = "Exported analytics data"
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      eventName,
      eventData,
    })

    if (!result.success) {
      return {
        output: `Plugin analytics command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        eventName,
        eventData,
      },
    }
  },
})
