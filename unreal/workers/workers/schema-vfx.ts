import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const schemaVfxWorker: WorkerDefinition = {
  id: "schema-vfx",
  name: "Schema VFX Worker",
  description: "Visual effects. Niagara particles, post-process, fog, lighting, decals, weather, Lumen, Nanite.",
  category: "schema",
  keywords: ["vfx", "efekt", "particle", "parçacık", "niagara", "fog", "sis", "ışık", "light", "hava", "weather"],
  schema: z.object({
    action: z.enum(["particle", "postprocess", "fog", "lighting", "weather", "decal"]).describe("VFX action"),
    effectType: z.string().optional().describe("Effect type or preset name"),
    location: z.string().optional().describe("Location as 'X,Y,Z'"),
    intensity: z.number().optional().describe("Effect intensity (0.0-1.0)"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, effectType, location, intensity } = args
    let command = `build vfx ${action}`
    if (effectType) command += ` type=${effectType}`
    if (location) command += ` location=${location}`
    if (intensity !== undefined) command += ` intensity=${intensity}`
    const result = await connector.sendCommand(command, { action, effectType, location, intensity })
    return {
      success: result.success,
      output: result.success ? `VFX ${action} applied` : `VFX failed: ${result.error}`,
      metadata: result,
    }
  },
}
