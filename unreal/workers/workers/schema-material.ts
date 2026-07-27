import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const schemaMaterialWorker: WorkerDefinition = {
  id: "schema-material",
  name: "Schema Material Worker",
  description: "Material and texture operations. Create materials, apply to meshes, set textures, color, blood effects.",
  category: "schema",
  keywords: ["material", "malzeme", "texture", "doku", "renk", "color", "kan", "blood", "duvar", "wall", "boya", "paint"],
  schema: z.object({
    action: z.enum(["set-material", "create", "edit-param", "set-color", "set-texture", "blood-wall"]).describe("Material action"),
    actorName: z.string().describe("Actor name to apply material to"),
    materialPath: z.string().optional().describe("Material asset path"),
    color: z.string().optional().describe("Color as 'R,G,B'"),
    texturePath: z.string().optional().describe("Texture asset path"),
    paramName: z.string().optional().describe("Parameter name to edit"),
    paramValue: z.string().optional().describe("Parameter value"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, actorName, materialPath, color, texturePath, paramName, paramValue } = args
    let command = ""
    if (action === "set-material") {
      command = `build material set actor=${actorName} material=${materialPath}`
    } else if (action === "blood-wall") {
      command = `build material blood-wall actor=${actorName}${color ? ` color=${color}` : ""}`
    } else if (action === "set-color") {
      command = `build material color actor=${actorName} color=${color || "1,0,0"}`
    } else if (action === "set-texture") {
      command = `build material texture actor=${actorName} texture=${texturePath}`
    } else {
      command = `build material ${action} actor=${actorName}`
    }
    const result = await connector.sendCommand(command, { action, actorName, materialPath, color, texturePath })
    return {
      success: result.success,
      output: result.success ? `Material ${action} on ${actorName}` : `Material failed: ${result.error}`,
      metadata: result,
    }
  },
}
