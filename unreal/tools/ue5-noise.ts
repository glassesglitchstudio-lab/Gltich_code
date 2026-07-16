import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const LocationSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
})

export const ue5NoiseTool = tool({
  description:
    "Manage UE5 noise emitter system: emit noise events, configure noise types and radii. Sends noise commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["emit", "set-type", "set-radius", "status", "history"])
      .describe("Noise action to perform"),
    target: z
      .string()
      .optional()
      .describe("Target actor name (defaults to selected actor)"),
    location: LocationSchema.default({ x: 0, y: 0, z: 0 }).describe(
      "World location for noise emission (x, y, z)"
    ),
    loudness: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Noise loudness (0.0=silent, 1.0=loudest)"),
    noiseType: z
      .enum(["Footstep", "Door", "Gunshot", "Explosion", "Whisper", "Custom"])
      .optional()
      .describe("Noise type to set"),
    radius: z
      .number()
      .positive()
      .optional()
      .describe("Noise radius in world units"),
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

    const { action, target, location, loudness, noiseType, radius } = args

    let command: string
    let description: string

    switch (action) {
      case "emit": {
        if (loudness === undefined) {
          return {
            output: "Action 'emit' requires a loudness value (0.0-1.0).",
            metadata: { success: false },
          }
        }
        const { x, y, z } = location
        command = `noise emit ${target ?? "selected"} ${loudness} ${x},${y},${z}`
        description = `Emitted noise (loudness: ${loudness}) at (${x}, ${y}, ${z})`
        break
      }
      case "set-type": {
        if (!noiseType) {
          return {
            output: "Action 'set-type' requires a noiseType (Footstep/Door/Gunshot/Explosion/Whisper/Custom).",
            metadata: { success: false },
          }
        }
        command = `noise set-type ${target ?? "selected"} ${noiseType}`
        description = `Set noise type to ${noiseType}`
        break
      }
      case "set-radius": {
        if (radius === undefined) {
          return {
            output: "Action 'set-radius' requires a radius value.",
            metadata: { success: false },
          }
        }
        command = `noise set-radius ${target ?? "selected"} ${radius}`
        description = `Set noise radius to ${radius}`
        break
      }
      case "status":
        command = `noise status ${target ?? "selected"}`
        description = `Get noise status for ${target ?? "selected actor"}`
        break
      case "history":
        command = `noise history ${target ?? "selected"}`
        description = `Get recent noise history for ${target ?? "selected actor"}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      target,
      location,
      loudness,
      noiseType,
      radius,
    })

    if (!result.success) {
      return {
        output: `Noise command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        target,
        loudness,
        noiseType,
      },
    }
  },
})
