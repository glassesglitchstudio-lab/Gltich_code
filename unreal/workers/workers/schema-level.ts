import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const schemaLevelWorker: WorkerDefinition = {
  id: "schema-level",
  name: "Schema Level Worker",
  description: "Level and world building. Create levels, open levels, manage world composition, lighting scenarios.",
  category: "schema",
  keywords: ["level", "seviye", "sahne", "world", "dünya", "harita", "map", "open", "aç"],
  schema: z.object({
    action: z.enum(["open", "create", "save", "build-lighting", "build-geometry"]).describe("Level action"),
    levelPath: z.string().describe("Level path (e.g. '/Game/Maps/MyLevel')"),
    preset: z.string().optional().describe("Level preset (empty/lighting/gameplay/cinematic)"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, levelPath, preset } = args
    let command = ""
    if (action === "open") command = `open ${levelPath}`
    else if (action === "create") command = `build level create path=${levelPath}${preset ? ` preset=${preset}` : ""}`
    else if (action === "build-lighting") command = `build lighting level=${levelPath}`
    else command = `${action} level=${levelPath}`
    const result = await connector.sendCommand(command, { action, levelPath, preset })
    return {
      success: result.success,
      output: result.success ? `Level ${action}: ${levelPath}` : `Level failed: ${result.error}`,
      metadata: result,
    }
  },
}
