import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const buildOptimizeWorker: WorkerDefinition = {
  id: "build-optimize",
  name: "Build Optimize Worker",
  description: "Build optimization and profiling. Estimate cook time, profile, compare, optimize pipeline.",
  category: "build",
  keywords: ["optimize", "optimizasyon", "profile", "profil", "hız", "performans", "cooktime"],
  schema: z.object({
    action: z.enum(["estimate", "profile", "history", "compare", "optimize"]).describe("Optimization action"),
    platform: z.enum(["windows", "linux", "android"]).optional().describe("Target platform"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, platform } = args
    let command = `build cooktime ${action}`
    if (platform) command += ` platform=${platform}`
    const result = await connector.sendCommand(command, { action, platform })
    return {
      success: result.success,
      output: result.success ? `Optimize ${action} completed` : `Optimize failed: ${result.error}`,
      metadata: result,
    }
  },
}
