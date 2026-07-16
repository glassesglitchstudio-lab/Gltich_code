import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const CameraFirstActionSchema = z.enum([
  "enable",
  "disable",
  "set-fov",
  "set-offset",
  "set-height",
])

export const ue5CameraFirstTool = tool({
  description:
    "Control UE5 first-person camera. Enable/disable first-person mode, set field of view, camera offset, and eye height. Uses the 'camera first' console command.",
  args: {
    action: CameraFirstActionSchema.describe("First-person camera action to perform"),
    fov: z.number().min(10).max(170).optional().describe("Field of view in degrees (10-170, default 90)"),
    offset: z.string().optional().describe("Camera offset as 'X,Y,Z' relative to the character"),
    height: z.number().min(0).optional().describe("Camera eye height in world units"),
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

    const { action, fov, offset, height } = args

    if (action === "set-fov" && fov === undefined) {
      return {
        output: "Action 'set-fov' requires an fov parameter (10-170 degrees).",
        metadata: { success: false },
      }
    }

    if (action === "set-offset" && offset === undefined) {
      return {
        output: "Action 'set-offset' requires an offset parameter as 'X,Y,Z'.",
        metadata: { success: false },
      }
    }

    if (action === "set-height" && height === undefined) {
      return {
        output: "Action 'set-height' requires a height parameter.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "enable":
        command = "camera first enable"
        description = "Enabled first-person camera mode"
        break

      case "disable":
        command = "camera first disable"
        description = "Disabled first-person camera mode"
        break

      case "set-fov":
        command = `camera first fov=${fov}`
        description = `Set first-person camera FOV to ${fov} degrees`
        break

      case "set-offset":
        command = `camera first offset=${offset}`
        description = `Set first-person camera offset to ${offset}`
        break

      case "set-height":
        command = `camera first height=${height}`
        description = `Set first-person camera eye height to ${height}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, { action, fov, offset, height })

    if (!result.success) {
      return {
        output: `First-person camera command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        fov,
        offset,
        height,
        rawResult: result.result,
      },
    }
  },
})
