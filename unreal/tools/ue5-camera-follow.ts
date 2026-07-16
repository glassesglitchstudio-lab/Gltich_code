import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const CameraFollowActionSchema = z.enum([
  "set-target",
  "clear-target",
  "set-smoothing",
  "set-offset",
  "look-at",
  "orbit",
])

export const ue5CameraFollowTool = tool({
  description:
    "Control UE5 camera follow system. Set/clear a follow target actor, adjust smoothing (0-1), set camera offset, force look-at a position, or orbit around the target. Uses the 'camera follow' console command.",
  args: {
    action: CameraFollowActionSchema.describe("Camera follow action to perform"),
    target: z.string().optional().describe("Actor name or tag to follow (required for set-target)"),
    smoothing: z.number().min(0).max(1).optional().describe("Follow smoothing factor (0 = instant, 1 = very smooth, default 0.3)"),
    offset: z.string().optional().describe("Camera offset from target as 'X,Y,Z'"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return {
        output: "UE5 Editor is not connected. Make sure the editor is running with the Glitch Code plugin enabled.",
        metadata: { success: false },
      }
    }

    const { action, target, smoothing, offset } = args

    if (action === "set-target" && !target) {
      return {
        output: "Action 'set-target' requires a target parameter (actor name or tag).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "set-target":
        command = `camera follow target=${target}`
        if (smoothing !== undefined) command += ` smoothing=${smoothing}`
        if (offset) command += ` offset=${offset}`
        description = `Camera now following '${target}'`
        if (smoothing !== undefined) description += ` with smoothing ${smoothing}`
        if (offset) description += ` at offset ${offset}`
        break

      case "clear-target":
        command = "camera follow clear"
        description = "Cleared camera follow target"
        break

      case "set-smoothing":
        if (smoothing === undefined) {
          return {
            output: "Action 'set-smoothing' requires a smoothing parameter (0-1).",
            metadata: { success: false },
          }
        }
        command = `camera follow smoothing=${smoothing}`
        description = `Set camera follow smoothing to ${smoothing}`
        break

      case "set-offset":
        if (!offset) {
          return {
            output: "Action 'set-offset' requires an offset parameter as 'X,Y,Z'.",
            metadata: { success: false },
          }
        }
        command = `camera follow offset=${offset}`
        description = `Set camera follow offset to ${offset}`
        break

      case "look-at":
        if (!offset) {
          return {
            output: "Action 'look-at' requires an offset parameter specifying the world position to look at as 'X,Y,Z'.",
            metadata: { success: false },
          }
        }
        command = `camera follow lookAt=${offset}`
        description = `Camera now looking at position ${offset}`
        break

      case "orbit":
        if (!offset) {
          return {
            output: "Action 'orbit' requires an offset parameter specifying orbit parameters as 'angle,distance'.",
            metadata: { success: false },
          }
        }
        command = `camera follow orbit=${offset}`
        description = `Orbiting camera around follow target with parameters ${offset}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, { action, target, smoothing, offset })

    if (!result.success) {
      return {
        output: `Camera follow command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        target,
        smoothing,
        offset,
        rawResult: result.result,
      },
    }
  },
})
