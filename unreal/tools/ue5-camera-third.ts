import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const CameraThirdActionSchema = z.enum([
  "enable",
  "disable",
  "set-distance",
  "set-height",
  "orbit",
  "lock",
  "unlock",
])

export const ue5CameraThirdTool = tool({
  description:
    "Control UE5 third-person camera. Enable/disable third-person mode, set boom distance/height, orbit around the character, or lock/unlock camera rotation. Uses the 'camera third' console command.",
  args: {
    action: CameraThirdActionSchema.describe("Third-person camera action to perform"),
    distance: z.number().min(0).optional().describe("Camera boom arm distance from character (world units)"),
    height: z.number().optional().describe("Camera height offset above the character (world units)"),
    angle: z.number().min(-180).max(180).optional().describe("Orbit angle in degrees around the character"),
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

    const { action, distance, height, angle } = args

    if (action === "set-distance" && distance === undefined) {
      return {
        output: "Action 'set-distance' requires a distance parameter.",
        metadata: { success: false },
      }
    }

    if (action === "set-height" && height === undefined) {
      return {
        output: "Action 'set-height' requires a height parameter.",
        metadata: { success: false },
      }
    }

    if (action === "orbit" && angle === undefined) {
      return {
        output: "Action 'orbit' requires an angle parameter (-180 to 180 degrees).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "enable":
        command = "camera third enable"
        description = "Enabled third-person camera mode"
        break

      case "disable":
        command = "camera third disable"
        description = "Disabled third-person camera mode"
        break

      case "set-distance":
        command = `camera third distance=${distance}`
        description = `Set third-person camera distance to ${distance}`
        break

      case "set-height":
        command = `camera third height=${height}`
        description = `Set third-person camera height to ${height}`
        break

      case "orbit":
        command = `camera third orbit=${angle}`
        description = `Orbited third-person camera ${angle} degrees around character`
        break

      case "lock":
        command = "camera third lock"
        description = "Locked third-person camera rotation"
        break

      case "unlock":
        command = "camera third unlock"
        description = "Unlocked third-person camera rotation"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, { action, distance, height, angle })

    if (!result.success) {
      return {
        output: `Third-person camera command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        distance,
        height,
        angle,
        rawResult: result.result,
      },
    }
  },
})
