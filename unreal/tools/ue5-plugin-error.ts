import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5PluginErrorTool = tool({
  description:
    "Manage UE5 plugin error reporting: report errors, list active errors, dismiss, retry, get details, and clear error log. Sends plugin error commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["report", "list", "dismiss", "retry", "get-details", "clear"])
      .describe("Error management action to perform"),
    errorId: z
      .string()
      .optional()
      .describe("Error ID for dismiss/retry/get-details actions"),
    severity: z
      .enum(["info", "warning", "error", "critical"])
      .optional()
      .describe("Error severity level for report and list filtering"),
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

    const { action, errorId, severity } = args

    let command: string
    let description: string

    switch (action) {
      case "report":
        command = severity ? `plugin error report ${severity}` : `plugin error report`
        description = `Reported${severity ? ` ${severity}` : ""} error`
        break
      case "list":
        command = severity ? `plugin error list ${severity}` : `plugin error list`
        description = `Listed${severity ? ` ${severity}` : ""} errors`
        break
      case "dismiss":
        if (!errorId) {
          return {
            output: "Action 'dismiss' requires an errorId.",
            metadata: { success: false },
          }
        }
        command = `plugin error dismiss ${errorId}`
        description = `Dismissed error '${errorId}'`
        break
      case "retry":
        if (!errorId) {
          return {
            output: "Action 'retry' requires an errorId.",
            metadata: { success: false },
          }
        }
        command = `plugin error retry ${errorId}`
        description = `Retrying error '${errorId}'`
        break
      case "get-details":
        if (!errorId) {
          return {
            output: "Action 'get-details' requires an errorId.",
            metadata: { success: false },
          }
        }
        command = `plugin error get-details ${errorId}`
        description = `Retrieved details for error '${errorId}'`
        break
      case "clear":
        command = `plugin error clear`
        description = "Cleared all plugin errors"
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      errorId,
      severity,
    })

    if (!result.success) {
      return {
        output: `Plugin error command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        errorId,
        severity,
      },
    }
  },
})
