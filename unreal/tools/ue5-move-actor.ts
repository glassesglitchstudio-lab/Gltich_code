import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VectorSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
})

export const ue5MoveActorTool = tool({
  description:
    "Move or rotate an actor in the current UE5 level. Set location, rotation, or both on a named actor.",
  args: {
    actorName: z.string().describe("Name of the actor to move or rotate"),
    location: VectorSchema.optional().describe("New world location (x, y, z)"),
    rotation: VectorSchema.optional().describe("New rotation in degrees (pitch, yaw, roll)"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    if (!args.location && !args.rotation) {
      return {
        output: "Either location or rotation must be provided.",
        metadata: { success: false },
      }
    }

    const commands: string[] = []
    const results: string[] = []

    if (args.location) {
      const { x, y, z } = args.location
      const cmd = `actor set ${args.actorName} Location=${x},${y},${z}`
      const res = await connector.sendCommand(cmd, { actorName: args.actorName, location: args.location })
      if (!res.success) {
        return { output: `Failed to set location: ${res.error}`, metadata: { success: false } }
      }
      results.push(`Location=(${x}, ${y}, ${z})`)
    }

    if (args.rotation) {
      const { x: pitch, y: yaw, z: roll } = args.rotation
      const cmd = `actor set ${args.actorName} Rotation=${pitch},${yaw},${roll}`
      const res = await connector.sendCommand(cmd, { actorName: args.actorName, rotation: args.rotation })
      if (!res.success) {
        return { output: `Failed to set rotation: ${res.error}`, metadata: { success: false } }
      }
      results.push(`Rotation=(${pitch}, ${yaw}, ${roll})`)
    }

    return {
      output: `Updated "${args.actorName}": ${results.join(", ")}`,
      metadata: {
        success: true,
        actorName: args.actorName,
        location: args.location,
        rotation: args.rotation,
      },
    }
  },
})
