import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5PluginLogsTool = tool({
  description:
    "Manage UE5 plugin logs: read, clear, filter, search, export, tail, and set log level. Sends plugin logs commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["read", "clear", "filter", "search", "export", "tail", "level"])
      .describe("Logs action to perform"),
    logLevel: z
      .enum(["debug", "info", "warning", "error", "fatal"])
      .optional()
      .describe("Log level for filter and level actions"),
    filter: z
      .string()
      .optional()
      .describe("Filter/search term for filter and search actions"),
    lines: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Number of lines to read or tail"),
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

    const { action, logLevel, filter, lines } = args

    let command: string
    let description: string

    switch (action) {
      case "read":
        command = lines ? `plugin logs read ${lines}` : `plugin logs read`
        description = `Read${lines ? ` last ${lines} lines of` : ""} plugin logs`
        break
      case "clear":
        command = `plugin logs clear`
        description = "Cleared all plugin logs"
        break
      case "filter":
        command = logLevel
          ? `plugin logs filter ${logLevel}`
          : filter
            ? `plugin logs filter ${filter}`
            : `plugin logs filter`
        description = `Filtered logs${logLevel ? ` by level '${logLevel}'` : filter ? ` by '${filter}'` : ""}`
        break
      case "search":
        if (!filter) {
          return {
            output: "Action 'search' requires a filter (search term).",
            metadata: { success: false },
          }
        }
        command = `plugin logs search ${filter}`
        description = `Searched logs for '${filter}'`
        break
      case "export":
        command = `plugin logs export`
        description = "Exported plugin logs to file"
        break
      case "tail":
        command = lines ? `plugin logs tail ${lines}` : `plugin logs tail`
        description = `Tailing${lines ? ` last ${lines} lines of` : ""} plugin logs`
        break
      case "level":
        if (!logLevel) {
          return {
            output: "Action 'level' requires a logLevel (debug/info/warning/error/fatal).",
            metadata: { success: false },
          }
        }
        command = `plugin logs level ${logLevel}`
        description = `Set log level to '${logLevel}'`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      logLevel,
      filter,
      lines,
    })

    if (!result.success) {
      return {
        output: `Plugin logs command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        logLevel,
        filter,
        lines,
      },
    }
  },
})
