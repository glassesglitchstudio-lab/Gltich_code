import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

const CookActionSchema = z.enum(["cook", "cook-map", "cook-all", "verify", "clean", "status"])

export const buildCookWorker: WorkerDefinition = {
  id: "build-cook",
  name: "Build Cook Worker",
  description: "Content cooking for cross-platform builds. Cook maps, verify integrity, clean cooked content.",
  category: "build",
  keywords: ["cook", "pişir", "build", "derle", "platform", "content", "içerik"],
  schema: z.object({
    action: CookActionSchema.describe("Cook action"),
    mapName: z.string().optional().describe("Map name for cook-map action"),
    platform: z.enum(["windows", "linux", "android", "ios"]).optional().describe("Target platform"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, mapName, platform } = args
    let command = "build cook"
    if (action === "cook-map") {
      if (!mapName) return { success: false, output: "Map name required for cook-map" }
      command = `build cook map=${mapName}`
    } else if (action === "cook-all") {
      command = "build cook-all"
    } else {
      command = `build cook ${action}`
    }
    if (platform) command += ` platform=${platform}`
    const result = await connector.sendCommand(command, { action, mapName, platform })
    return {
      success: result.success,
      output: result.success ? `${action} completed for ${platform || "default"}` : `Cook failed: ${result.error}`,
      metadata: result,
    }
  },
}
