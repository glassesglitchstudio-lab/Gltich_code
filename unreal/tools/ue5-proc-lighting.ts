import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5ProcLightingTool = tool({
  description:
    "Procedurally generate and control lighting in the UE5 level. Send proc lighting commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["generate", "remove", "flicker", "setintensity", "setcolor", "ambient", "strobe"])
      .describe("Lighting action to perform"),
    lightType: z
      .enum(["point", "spot", "rect", "sky", "ambient"])
      .optional()
      .describe("Type of light source"),
    intensity: z
      .number()
      .min(0)
      .optional()
      .describe("Light intensity value"),
    color: z
      .string()
      .optional()
      .describe("Light color as hex (e.g. '#FF6B00') or name"),
    location: z
      .string()
      .optional()
      .describe("World location or room name to place the light at"),
    roomName: z
      .string()
      .optional()
      .describe("Parent room name for filtering"),
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

    const { action, lightType, intensity, color, location, roomName } = args

    // Validate required args per action
    if (action === "generate" && !lightType) {
      return {
        output: "Action 'generate' requires a lightType.",
        metadata: { success: false },
      }
    }
    if (["remove", "flicker", "setintensity", "setcolor", "strobe"].includes(action) && !location && !roomName) {
      return {
        output: `Action '${action}' requires a location or roomName to identify the light.`,
        metadata: { success: false },
      }
    }
    if (action === "setintensity" && intensity === undefined) {
      return {
        output: "Action 'setintensity' requires an intensity value.",
        metadata: { success: false },
      }
    }
    if (action === "setcolor" && !color) {
      return {
        output: "Action 'setcolor' requires a color value.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string
    const target = location || roomName || ""

    switch (action) {
      case "generate":
        command = `proc lighting generate ${lightType}${location ? ` at=${location}` : ""}${roomName ? ` room=${roomName}` : ""}${intensity !== undefined ? ` intensity=${intensity}` : ""}${color ? ` color=${color}` : ""}`
        description = `Generated ${lightType} light`
        break
      case "remove":
        command = `proc lighting remove at=${target}`
        description = `Removed lighting at '${target}'`
        break
      case "flicker":
        command = `proc lighting flicker at=${target}`
        description = `Enabled flicker effect at '${target}'`
        break
      case "setintensity":
        command = `proc lighting setintensity at=${target} intensity=${intensity}`
        description = `Set intensity to ${intensity} at '${target}'`
        break
      case "setcolor":
        command = `proc lighting setcolor at=${target} color=${color}`
        description = `Set color to ${color} at '${target}'`
        break
      case "ambient":
        command = `proc lighting ambient${roomName ? ` room=${roomName}` : ""}${intensity !== undefined ? ` intensity=${intensity}` : ""}${color ? ` color=${color}` : ""}`
        description = "Set ambient lighting"
        break
      case "strobe":
        command = `proc lighting strobe at=${target}`
        description = `Enabled strobe effect at '${target}'`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      lightType,
      intensity,
      color,
      location,
      roomName,
    })

    if (!result.success) {
      return {
        output: `Proc lighting command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        lightType,
        location: target,
      },
    }
  },
})
