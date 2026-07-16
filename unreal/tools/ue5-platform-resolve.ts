import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const PlatformResolveActionSchema = z.enum([
  "detect",
  "get-specs",
  "get-gpu",
  "get-cpu",
  "get-memory",
  "get-platform",
  "benchmark",
])

export const ue5PlatformResolveTool = tool({
  description:
    "Detect and resolve cross-platform hardware specifications in UE5. Auto-detect the running platform, retrieve GPU/CPU/memory details, get current platform target, or run a hardware benchmark. Uses the 'platform resolve' console command.",
  args: {
    action: PlatformResolveActionSchema.describe("Platform resolve action to perform"),
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

    const { action } = args

    let command: string
    let description: string

    switch (action) {
      case "detect":
        command = "platform resolve detect"
        description = "Auto-detected platform hardware"
        break

      case "get-specs":
        command = "platform resolve get-specs"
        description = "Retrieved full platform specifications"
        break

      case "get-gpu":
        command = "platform resolve get-gpu"
        description = "Retrieved GPU information"
        break

      case "get-cpu":
        command = "platform resolve get-cpu"
        description = "Retrieved CPU information"
        break

      case "get-memory":
        command = "platform resolve get-memory"
        description = "Retrieved memory information"
        break

      case "get-platform":
        command = "platform resolve get-platform"
        description = "Retrieved current platform target"
        break

      case "benchmark":
        command = "platform resolve benchmark"
        description = "Ran hardware benchmark"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, { action })

    if (!result.success) {
      return {
        output: `Platform resolve command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        rawResult: result.result,
      },
    }
  },
})
