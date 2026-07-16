import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5SetMaterialTool = tool({
  description:
    "Assign a material to an actor in the current UE5 level. Sets the material at the specified slot index.",
  args: {
    actorName: z.string().describe("Name of the actor to assign the material to"),
    materialPath: z.string().describe("Asset path of the material (e.g. '/Game/Materials/M_MyMaterial')"),
    slotIndex: z.number().int().min(0).default(0).describe("Material slot index on the mesh"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const command = `material set ${args.actorName} ${args.slotIndex} ${args.materialPath}`
    const result = await connector.sendCommand(command, {
      actorName: args.actorName,
      materialPath: args.materialPath,
      slotIndex: args.slotIndex,
    })

    if (!result.success) {
      return {
        output: `Failed to set material: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `Set material "${args.materialPath}" on "${args.actorName}" (slot ${args.slotIndex})`,
      metadata: {
        success: true,
        actorName: args.actorName,
        materialPath: args.materialPath,
        slotIndex: args.slotIndex,
      },
    }
  },
})
