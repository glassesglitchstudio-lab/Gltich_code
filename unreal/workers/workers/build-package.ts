import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const buildPackageWorker: WorkerDefinition = {
  id: "build-package",
  name: "Build Package Worker",
  description: "Package UE5 builds for deployment. Create full packages, stage builds, shipping builds.",
  category: "build",
  keywords: ["package", "paketle", "build", "derle", "ship", "yayınla"],
  schema: z.object({
    action: z.enum(["full", "stage", "ship", "test-build", "debug-build", "development-build"]).describe("Package action"),
    platform: z.enum(["windows", "linux", "android", "ios"]).optional().describe("Target platform"),
    config: z.enum(["development", "staging", "shipping"]).optional().describe("Build config"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, platform, config } = args
    let command = "build package"
    if (action === "stage") command += " stage"
    else if (action === "ship") command += " ship"
    else command += ` ${action}`
    if (platform) command += ` platform=${platform}`
    if (config) command += ` config=${config}`
    const result = await connector.sendCommand(command, { action, platform, config })
    return {
      success: result.success,
      output: result.success ? `Package ${action} completed` : `Package failed: ${result.error}`,
      metadata: result,
    }
  },
}
