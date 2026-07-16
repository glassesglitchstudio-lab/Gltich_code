import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VfxLightingActionSchema = z.enum([
  "set-ambient",
  "set-sky",
  "set-fog-density",
  "set-fog-color",
  "godray",
  "lightning",
])

export const ue5VfxLightingTool = tool({
  description:
    "Control UE5 VFX lighting. Adjust ambient light color/intensity, sky light, fog density and color, trigger god rays or lightning effects at specific locations. Uses the 'vfx lighting' console command.",
  args: {
    action: VfxLightingActionSchema.describe("Lighting action to perform"),
    color: z
      .string()
      .optional()
      .describe("Color as 'R,G,B,A' (0-1 range) for ambient, sky, or fog color"),
    intensity: z
      .number()
      .optional()
      .describe("Light intensity value (0-100 range)"),
    location: z
      .string()
      .optional()
      .describe("World location as 'X,Y,Z' for godray or lightning origin"),
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

    const { action, color, intensity, location } = args

    let command: string
    let description: string

    switch (action) {
      case "set-ambient":
        command = `vfx lighting ambient`
        if (intensity !== undefined) command += ` intensity=${intensity}`
        if (color) command += ` color=${color}`
        description = "Updated ambient lighting"
        break

      case "set-sky":
        command = `vfx lighting sky`
        if (intensity !== undefined) command += ` intensity=${intensity}`
        if (color) command += ` color=${color}`
        description = "Updated sky light"
        break

      case "set-fog-density":
        if (intensity === undefined) {
          return {
            output: "Action 'set-fog-density' requires an intensity parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx lighting fog-density=${intensity}`
        description = `Set fog density to ${intensity}`
        break

      case "set-fog-color":
        if (!color) {
          return {
            output: "Action 'set-fog-color' requires a color parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx lighting fog-color=${color}`
        description = `Set fog color to ${color}`
        break

      case "godray":
        command = `vfx lighting godray`
        if (location) command += ` location=${location}`
        if (intensity !== undefined) command += ` intensity=${intensity}`
        description = `Triggered god ray effect${location ? ` at ${location}` : ""}`
        break

      case "lightning":
        command = `vfx lighting lightning`
        if (location) command += ` location=${location}`
        if (intensity !== undefined) command += ` intensity=${intensity}`
        description = `Triggered lightning effect${location ? ` at ${location}` : ""}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      color,
      intensity,
      location,
    })

    if (!result.success) {
      return {
        output: `Lighting command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        color,
        intensity,
        location,
        rawResult: result.result,
      },
    }
  },
})
