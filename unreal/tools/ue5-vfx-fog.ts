import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VfxFogActionSchema = z.enum([
  "enable",
  "disable",
  "set-density",
  "set-height",
  "set-color",
  "volumetric",
  "dissolve",
])

const FogTypeSchema = z.enum(["exponential", "linear", "volumetric"])

export const ue5VfxFogTool = tool({
  description:
    "Control UE5 fog effects. Enable/disable fog, set density and height, adjust fog color, enable volumetric fog, or dissolve existing fog. Supports exponential, linear, and volumetric fog types. Uses the 'vfx fog' console command.",
  args: {
    action: VfxFogActionSchema.describe("Fog action to perform"),
    fogType: FogTypeSchema.optional().describe(
      "Fog type: exponential, linear, or volumetric"
    ),
    density: z
      .number()
      .optional()
      .describe("Fog density value (0-1 range, higher = thicker)"),
    color: z
      .string()
      .optional()
      .describe("Fog color as 'R,G,B,A' (0-1 range)"),
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

    const { action, fogType, density, color } = args

    let command: string
    let description: string

    switch (action) {
      case "enable":
        command = `vfx fog enable`
        if (fogType) command += ` type=${fogType}`
        description = `Enabled ${fogType ?? "default"} fog`
        break

      case "disable":
        command = `vfx fog disable`
        if (fogType) command += ` type=${fogType}`
        description = `Disabled ${fogType ?? "all"} fog`
        break

      case "set-density":
        if (density === undefined) {
          return {
            output: "Action 'set-density' requires a density parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx fog density=${density}`
        if (fogType) command += ` type=${fogType}`
        description = `Set fog density to ${density}`
        break

      case "set-height":
        if (density === undefined) {
          return {
            output: "Action 'set-height' requires a density parameter (height value).",
            metadata: { success: false },
          }
        }
        command = `vfx fog height=${density}`
        if (fogType) command += ` type=${fogType}`
        description = `Set fog height to ${density}`
        break

      case "set-color":
        if (!color) {
          return {
            output: "Action 'set-color' requires a color parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx fog color=${color}`
        if (fogType) command += ` type=${fogType}`
        description = `Set fog color to ${color}`
        break

      case "volumetric":
        command = `vfx fog volumetric`
        if (density !== undefined) command += ` density=${density}`
        description = "Toggled volumetric fog"
        break

      case "dissolve":
        command = `vfx fog dissolve`
        if (fogType) command += ` type=${fogType}`
        description = `Dissolved ${fogType ?? "all"} fog`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      fogType,
      density,
      color,
    })

    if (!result.success) {
      return {
        output: `Fog command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        fogType,
        density,
        color,
        rawResult: result.result,
      },
    }
  },
})
