import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const AtmosphereActionSchema = z.enum([
  "preset",
  "fog",
  "light",
  "ambient",
  "transition",
  "list",
  "status",
])

const PresetNameSchema = z.enum(["Calm", "Tense", "Horror", "Chase", "Safe"])

export const ue5AtmosphereTool = tool({
  description:
    "Manage UE5 atmosphere controller. Set presets (Calm/Tense/Horror/Chase/Safe), control fog density/color, light intensity/color, ambient volume, music intensity, or transition between presets. Uses the 'atmosphere' console command.",
  args: {
    action: AtmosphereActionSchema.describe("Atmosphere action to perform"),
    presetName: PresetNameSchema.optional().describe("Preset name (Calm/Tense/Horror/Chase/Safe) — required for preset/transition"),
    value: z.number().optional().describe("Numeric value for fog density, light intensity, ambient volume, or music intensity"),
    color: z.string().optional().describe("Color as 'R,G,B,A' (0-1 range) for fog or light color"),
    duration: z.number().min(0).optional().describe("Transition duration in seconds (default: 2.0)"),
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

    const { action, presetName, value, color, duration } = args

    // Validate required args per action
    if (["preset", "transition"].includes(action) && !presetName) {
      return {
        output: `Action '${action}' requires a presetName parameter (Calm/Tense/Horror/Chase/Safe).`,
        metadata: { success: false },
      }
    }

    if (["fog", "light", "ambient"].includes(action) && value === undefined && !color) {
      return {
        output: `Action '${action}' requires either a value or color parameter.`,
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "preset":
        command = `atmosphere preset ${presetName}`
        description = `Applied ${presetName} atmosphere preset`
        break

      case "fog":
        command = `atmosphere fog`
        if (value !== undefined) command += ` density=${value}`
        if (color) command += ` color=${color}`
        description = "Updated fog settings"
        break

      case "light":
        command = `atmosphere light`
        if (value !== undefined) command += ` intensity=${value}`
        if (color) command += ` color=${color}`
        description = "Updated light settings"
        break

      case "ambient":
        command = `atmosphere ambient`
        if (value !== undefined) command += ` volume=${value}`
        description = "Updated ambient volume"
        break

      case "transition":
        command = `atmosphere transition ${presetName} ${duration ?? 2.0}`
        description = `Transitioning to ${presetName} preset (${duration ?? 2.0}s)`
        break

      case "list":
        command = `atmosphere list`
        description = "Listed available atmosphere presets"
        break

      case "status":
        command = `atmosphere status`
        description = "Retrieved current atmosphere status"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      presetName,
      value,
      color,
      duration,
    })

    if (!result.success) {
      return {
        output: `Atmosphere command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        presetName,
        value,
        color,
        duration,
        rawResult: result.result,
      },
    }
  },
})
