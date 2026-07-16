import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const PlatformPerfActionSchema = z.enum([
  "stat-fps",
  "stat-gpu",
  "stat-cpu",
  "stat-memory",
  "stat-draw",
  "stat-streaming",
  "report",
])

export const ue5PlatformPerfTool = tool({
  description:
    "Monitor and report cross-platform performance stats in UE5. Display FPS, GPU timing, CPU timing, memory usage, draw call counts, texture streaming metrics, or generate a combined performance report. Uses the 'platform perf' console command.",
  args: {
    action: PlatformPerfActionSchema.describe("Performance stat action to perform"),
    duration: z
      .number()
      .optional()
      .describe("Duration in seconds to collect profiling data"),
    interval: z
      .number()
      .optional()
      .describe("Sampling interval in milliseconds between measurements"),
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

    const { action, duration, interval } = args

    let command: string
    let description: string

    switch (action) {
      case "stat-fps":
        command = "platform perf stat-fps"
        if (duration) command += ` duration=${duration}`
        description = "Collected FPS statistics"
        break

      case "stat-gpu":
        command = "platform perf stat-gpu"
        if (duration) command += ` duration=${duration}`
        if (interval) command += ` interval=${interval}`
        description = "Collected GPU timing statistics"
        break

      case "stat-cpu":
        command = "platform perf stat-cpu"
        if (duration) command += ` duration=${duration}`
        if (interval) command += ` interval=${interval}`
        description = "Collected CPU timing statistics"
        break

      case "stat-memory":
        command = "platform perf stat-memory"
        if (duration) command += ` duration=${duration}`
        description = "Collected memory usage statistics"
        break

      case "stat-draw":
        command = "platform perf stat-draw"
        if (duration) command += ` duration=${duration}`
        description = "Collected draw call statistics"
        break

      case "stat-streaming":
        command = "platform perf stat-streaming"
        if (duration) command += ` duration=${duration}`
        description = "Collected texture streaming statistics"
        break

      case "report":
        command = "platform perf report"
        if (duration) command += ` duration=${duration}`
        if (interval) command += ` interval=${interval}`
        description = "Generated comprehensive performance report"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      duration,
      interval,
    })

    if (!result.success) {
      return {
        output: `Platform perf command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        duration,
        interval,
        rawResult: result.result,
      },
    }
  },
})
