import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5TestCoverageTool = tool({
  description:
    "Manage UE5 test coverage: start/stop collection, generate reports, view per-module coverage, set thresholds, or export results. Sends coverage commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["start", "stop", "report", "module", "threshold", "export"])
      .describe("Coverage action to perform"),
    moduleName: z
      .string()
      .optional()
      .describe("Module name to view or filter coverage for (used with 'module')"),
    threshold: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("Coverage threshold percentage 0-100 (used with 'threshold')"),
    format: z
      .enum(["html", "json", "csv"])
      .optional()
      .describe("Export format (used with 'export', defaults to 'html')"),
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

    const { action, moduleName, threshold, format } = args

    let command: string
    let description: string

    switch (action) {
      case "start":
        command = `test coverage start`
        description = "Starting test coverage collection"
        break
      case "stop":
        command = `test coverage stop`
        description = "Stopping test coverage collection"
        break
      case "report":
        command = `test coverage report ${moduleName ?? ""}`
        description = `Generating coverage report${moduleName ? ` for module '${moduleName}'` : ""}`
        break
      case "module":
        if (!moduleName) {
          return {
            output: "Action 'module' requires a moduleName.",
            metadata: { success: false },
          }
        }
        command = `test coverage module ${moduleName}`
        description = `Getting coverage for module '${moduleName}'`
        break
      case "threshold":
        if (threshold === undefined) {
          return {
            output: "Action 'threshold' requires a threshold value (0-100).",
            metadata: { success: false },
          }
        }
        command = `test coverage threshold ${threshold}`
        description = `Setting coverage threshold to ${threshold}%`
        break
      case "export":
        command = `test coverage export ${format ?? "html"}`
        description = `Exporting coverage report as ${format ?? "html"}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      moduleName,
      threshold,
      format,
    })

    if (!result.success) {
      return {
        output: `Coverage command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        moduleName,
        threshold,
        format,
      },
    }
  },
})
