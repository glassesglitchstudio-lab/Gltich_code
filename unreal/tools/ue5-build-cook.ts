import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const BuildCookActionSchema = z.enum([
  "cook",
  "cook-map",
  "cook-all",
  "verify",
  "clean",
  "status",
])

const BuildPlatformSchema = z.enum(["windows", "linux", "android", "ios"]).optional()

export const ue5BuildCookTool = tool({
  description:
    "Manage UE5 content cooking operations for cross-platform builds. Cook content for a specific map or all maps, verify cook integrity, clean cooked content, or check cook status. Uses the 'build cook' console command.",
  args: {
    action: BuildCookActionSchema.describe("Cook action to perform"),
    mapName: z
      .string()
      .optional()
      .describe("Name of the map to cook (required for cook-map action)"),
    platform: BuildPlatformSchema.describe("Target platform for the cook operation"),
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
      case "cook":
        command = "build cook"
        if (platform) command += ` platform=${platform}`
        description = `Initiated content cook${platform ? ` for ${platform}` : ""}`
        break

      case "cook-map":
        if (!mapName) {
          return {
            output: "Action 'cook-map' requires a 'mapName' parameter.",
            metadata: { success: false },
          }
        }
        command = `build cook map=${mapName}`
        if (platform) command += ` platform=${platform}`
        description = `Cooking map '${mapName}'${platform ? ` for ${platform}` : ""}`
        break

      case "cook-all":
        command = "build cook-all"
        if (platform) command += ` platform=${platform}`
        description = `Cooking all content${platform ? ` for ${platform}` : ""}`
        break

      case "verify":
        command = "build cook verify"
        if (platform) command += ` platform=${platform}`
        description = "Verifying cook integrity"
        break

      case "clean":
        command = "build cook clean"
        if (platform) command += ` platform=${platform}`
        description = "Cleaned cooked content"
        break

      case "status":
        command = "build cook status"
        description = "Retrieved cook status"
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
        output: `Build cook command failed: ${result.error}`,
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
