import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VfxWeatherActionSchema = z.enum([
  "rain",
  "snow",
  "storm",
  "fog",
  "clear",
  "wind",
  "thunder",
])

export const ue5VfxWeatherTool = tool({
  description:
    "Control UE5 weather VFX system. Trigger rain, snow, storm, fog, or clear weather. Control wind speed and direction, trigger thunder effects. Intensity values range 0-1. Uses the 'vfx weather' console command.",
  args: {
    action: VfxWeatherActionSchema.describe("Weather action to perform"),
    intensity: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Weather intensity from 0 (off) to 1 (maximum)"),
    windSpeed: z
      .number()
      .optional()
      .describe("Wind speed value (0-100 range)"),
    windDirection: z
      .number()
      .optional()
      .describe("Wind direction in degrees (0-360, 0=North)"),
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

    const { action, intensity, windSpeed, windDirection } = args

    let command: string
    let description: string

    switch (action) {
      case "rain":
        command = `vfx weather rain`
        if (intensity !== undefined) command += ` intensity=${intensity}`
        description = `Set rain${intensity !== undefined ? ` intensity to ${intensity}` : ""}`
        break

      case "snow":
        command = `vfx weather snow`
        if (intensity !== undefined) command += ` intensity=${intensity}`
        description = `Set snow${intensity !== undefined ? ` intensity to ${intensity}` : ""}`
        break

      case "storm":
        command = `vfx weather storm`
        if (intensity !== undefined) command += ` intensity=${intensity}`
        description = `Set storm${intensity !== undefined ? ` intensity to ${intensity}` : ""}`
        break

      case "fog":
        command = `vfx weather fog`
        if (intensity !== undefined) command += ` intensity=${intensity}`
        description = `Set weather fog${intensity !== undefined ? ` intensity to ${intensity}` : ""}`
        break

      case "clear":
        command = `vfx weather clear`
        description = "Cleared all weather effects"
        break

      case "wind":
        command = `vfx weather wind`
        if (windSpeed !== undefined) command += ` speed=${windSpeed}`
        if (windDirection !== undefined) command += ` direction=${windDirection}`
        description = `Updated wind settings`
        break

      case "thunder":
        command = `vfx weather thunder`
        if (intensity !== undefined) command += ` intensity=${intensity}`
        description = `Triggered thunder${intensity !== undefined ? ` at intensity ${intensity}` : ""}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      intensity,
      windSpeed,
      windDirection,
    })

    if (!result.success) {
      return {
        output: `Weather command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        intensity,
        windSpeed,
        windDirection,
        rawResult: result.result,
      },
    }
  },
})
