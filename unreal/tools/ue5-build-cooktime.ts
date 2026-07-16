import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const BuildCooktimeActionSchema = z.enum([
  "estimate",
  "profile",
  "history",
  "compare",
  "optimize",
])

const CooktimePlatformSchema = z.enum(["windows", "linux", "android"]).optional()

export const ue5BuildCooktimeTool = tool({
  description:
    "Profile and optimize UE5 content cooking time across platforms. Estimate cook duration, profile the cooking process, view cook history, compare cook times across maps/platforms, or run cook optimization. Uses the 'build cooktime' console command.",
  args: {
    action: BuildCooktimeActionSchema.describe("Cooktime action to perform"),
    mapName: z
      .string()
      .optional()
      .describe("Name of the map to profile or estimate cook time for"),
    platform: CooktimePlatformSchema.describe("Target platform for cook time profiling"),
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

    const { action, mapName, platform } = args

    let command: string
    let description: string

    switch (action) {
      case "estimate":
        command = "build cooktime estimate"
        if (mapName) command += ` map=${mapName}`
        if (platform) command += ` platform=${platform}`
        description = `Estimated cook time${mapName ? ` for '${mapName}'` : ""}${platform ? ` on ${platform}` : ""}`
        break

      case "profile":
        command = "build cooktime profile"
        if (mapName) command += ` map=${mapName}`
        if (platform) command += ` platform=${platform}`
        description = `Profiling cook time${mapName ? ` for '${mapName}'` : ""}${platform ? ` on ${platform}` : ""}`
        break

      case "history":
        command = "build cooktime history"
        if (mapName) command += ` map=${mapName}`
        if (platform) command += ` platform=${platform}`
        description = "Retrieved cook time history"
        break

      case "compare":
        command = "build cooktime compare"
        if (mapName) command += ` map=${mapName}`
        if (platform) command += ` platform=${platform}`
        description = "Comparing cook times across platforms"
        break

      case "optimize":
        command = "build cooktime optimize"
        if (mapName) command += ` map=${mapName}`
        if (platform) command += ` platform=${platform}`
        description = "Running cook time optimization"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      mapName,
      platform,
    })

    if (!result.success) {
      return {
        output: `Build cooktime command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        mapName,
        platform,
        rawResult: result.result,
      },
    }
  },
})
