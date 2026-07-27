import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const buildAssetWorker: WorkerDefinition = {
  id: "build-asset",
  name: "Build Asset Worker",
  description: "Asset pipeline management. List, audit, fix, migrate, resize textures, manage references.",
  category: "build",
  keywords: ["asset", "varlık", "texture", "doku", "mesh", "model", "migrate", "taşı"],
  schema: z.object({
    action: z.enum(["list", "audit", "reference", "redirector", "fix", "migrate", "resize-textures"]).describe("Asset action"),
    assetPath: z.string().optional().describe("Asset path"),
    assetType: z.enum(["mesh", "texture", "material", "blueprint", "animation"]).optional().describe("Asset type"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, assetPath, assetType } = args
    let command = `build asset ${action}`
    if (assetPath) command += ` path=${assetPath}`
    if (assetType) command += ` type=${assetType}`
    const result = await connector.sendCommand(command, { action, assetPath, assetType })
    return {
      success: result.success,
      output: result.success ? `Asset ${action} completed` : `Asset failed: ${result.error}`,
      metadata: result,
    }
  },
}
