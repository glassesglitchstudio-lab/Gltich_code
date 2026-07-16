import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5TestPerfTool = tool({
  description:
    "Manage UE5 performance tests: start/stop profiling, capture metrics, generate reports, compare results, or set baselines. Sends perf test commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["start", "stop", "capture", "report", "compare", "baseline"])
      .describe("Performance test action to perform"),
    metricName: z
      .string()
      .optional()
      .describe("Name of the performance metric to capture or compare (e.g. 'fps', 'memory', 'drawcalls')"),
    duration: z
      .number()
      .optional()
      .describe("Profiling duration in seconds (used with 'start' or 'capture')"),
    baselineFile: z
      .string()
      .optional()
      .describe("Path to baseline file for comparison (used with 'compare' or 'baseline')"),
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

    const { action, metricName, duration, baselineFile } = args

    let command: string
    let description: string

    switch (action) {
      case "start":
        command = `test perf start ${duration ?? ""} ${metricName ?? ""}`
        description = `Starting performance profiling${duration ? ` for ${duration}s` : ""}${metricName ? ` (metric: ${metricName})` : ""}`
        break
      case "stop":
        command = `test perf stop`
        description = "Stopping performance profiling"
        break
      case "capture":
        command = `test perf capture ${metricName ?? "all"} ${duration ?? ""}`
        description = `Capturing performance metric '${metricName ?? "all"}'${duration ? ` for ${duration}s` : ""}`
        break
      case "report":
        command = `test perf report ${metricName ?? ""}`
        description = `Generating performance report${metricName ? ` for '${metricName}'` : ""}`
        break
      case "compare":
        if (!baselineFile) {
          return {
            output: "Action 'compare' requires a baselineFile path.",
            metadata: { success: false },
          }
        }
        command = `test perf compare ${baselineFile}`
        description = `Comparing current results against baseline '${baselineFile}'`
        break
      case "baseline":
        command = `test perf baseline ${baselineFile ?? "current"} ${metricName ?? ""}`
        description = `Setting performance baseline${baselineFile ? ` from '${baselineFile}'` : ""}${metricName ? ` for '${metricName}'` : ""}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      metricName,
      duration,
      baselineFile,
    })

    if (!result.success) {
      return {
        output: `Performance test command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        metricName,
        duration,
        baselineFile,
      },
    }
  },
})
