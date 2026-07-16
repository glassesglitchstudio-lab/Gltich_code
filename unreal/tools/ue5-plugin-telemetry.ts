import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5PluginTelemetryTool = tool({
  description:
    "Manage UE5 plugin telemetry: start/stop profiling, capture snapshots, export data, and generate FPS/memory reports. Sends plugin telemetry commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["start", "stop", "capture", "export", "fps-report", "memory-report"])
      .describe("Telemetry action to perform"),
    metricType: z
      .enum(["fps", "memory", "cpu", "gpu", "network"])
      .optional()
      .describe("Metric type for start/capture actions"),
    duration: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Duration in seconds for start action"),
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

    const { action, metricType, duration } = args

    let command: string
    let description: string

    switch (action) {
      case "start":
        command = duration
          ? `plugin telemetry start ${metricType ?? "fps"} ${duration}`
          : `plugin telemetry start ${metricType ?? "fps"}`
        description = `Started ${metricType ?? "fps"} telemetry${duration ? ` for ${duration}s` : ""}`
        break
      case "stop":
        command = `plugin telemetry stop`
        description = "Stopped telemetry collection"
        break
      case "capture":
        command = metricType
          ? `plugin telemetry capture ${metricType}`
          : `plugin telemetry capture`
        description = `Captured${metricType ? ` ${metricType}` : ""} telemetry snapshot`
        break
      case "export":
        command = `plugin telemetry export`
        description = "Exported telemetry data"
        break
      case "fps-report":
        command = `plugin telemetry fps-report`
        description = "Generated FPS telemetry report"
        break
      case "memory-report":
        command = `plugin telemetry memory-report`
        description = "Generated memory telemetry report"
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      metricType,
      duration,
    })

    if (!result.success) {
      return {
        output: `Plugin telemetry command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        metricType,
        duration,
      },
    }
  },
})
