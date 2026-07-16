import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5TestReportTool = tool({
  description:
    "Manage UE5 test reports: generate reports, export in various formats, view summaries, inspect failures, browse history, or compare runs. Sends report commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["generate", "export", "summary", "failures", "history", "compare"])
      .describe("Test report action to perform"),
    reportType: z
      .enum(["unit", "functional", "perf", "all"])
      .optional()
      .describe("Type of test report to generate (used with 'generate', 'export', 'summary', or 'failures')"),
    format: z
      .enum(["html", "json", "markdown"])
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

    const { action, reportType, format } = args

    let command: string
    let description: string

    switch (action) {
      case "generate":
        command = `test report generate ${reportType ?? "all"}`
        description = `Generating ${reportType ?? "all"} test report`
        break
      case "export":
        command = `test report export ${reportType ?? "all"} ${format ?? "html"}`
        description = `Exporting ${reportType ?? "all"} test report as ${format ?? "html"}`
        break
      case "summary":
        command = `test report summary ${reportType ?? "all"}`
        description = `Getting ${reportType ?? "all"} test summary`
        break
      case "failures":
        command = `test report failures ${reportType ?? "all"}`
        description = `Listing failed tests for ${reportType ?? "all"}`
        break
      case "history":
        command = `test report history`
        description = "Browsing test report history"
        break
      case "compare":
        command = `test report compare ${reportType ?? "all"}`
        description = `Comparing ${reportType ?? "all"} test results across runs`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      reportType,
      format,
    })

    if (!result.success) {
      return {
        output: `Test report command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        reportType,
        format,
      },
    }
  },
})
