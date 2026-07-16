import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const PlatformQualityActionSchema = z.enum([
  "set",
  "get",
  "preset",
  "set-shadow",
  "set-texture",
  "set-effects",
  "set-postprocess",
])

const QualityLevelSchema = z.enum(["low", "medium", "high", "epic", "cinematic"]).optional()

export const ue5PlatformQualityTool = tool({
  description:
    "Manage cross-platform quality settings in UE5. Set overall quality level or target specific shadow/texture/effects/post-process quality. Apply quality presets for low-medium-high-epic-cinematic tiers. Uses the 'platform quality' console command.",
  args: {
    action: PlatformQualityActionSchema.describe("Quality setting action to perform"),
    quality: QualityLevelSchema.describe("Quality level to set (low, medium, high, epic, cinematic)"),
    value: z
      .number()
      .optional()
      .describe("Numeric quality value (0-4) for fine-grained control"),
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

    const { action, quality, value } = args

    let command: string
    let description: string

    switch (action) {
      case "set":
        if (!quality && value === undefined) {
          return {
            output: "Action 'set' requires either 'quality' or 'value' parameter.",
            metadata: { success: false },
          }
        }
        command = "platform quality set"
        if (quality) command += ` level=${quality}`
        if (value !== undefined) command += ` value=${value}`
        description = `Set overall quality to ${quality ?? `value ${value}`}`
        break

      case "get":
        command = "platform quality get"
        description = "Retrieved current quality settings"
        break

      case "preset":
        if (!quality) {
          return {
            output: "Action 'preset' requires a 'quality' parameter.",
            metadata: { success: false },
          }
        }
        command = `platform quality preset=${quality}`
        description = `Applied '${quality}' quality preset`
        break

      case "set-shadow":
        command = "platform quality set-shadow"
        if (quality) command += ` level=${quality}`
        if (value !== undefined) command += ` value=${value}`
        description = `Set shadow quality${quality ? ` to ${quality}` : ` value to ${value}`}`
        break

      case "set-texture":
        command = "platform quality set-texture"
        if (quality) command += ` level=${quality}`
        if (value !== undefined) command += ` value=${value}`
        description = `Set texture quality${quality ? ` to ${quality}` : ` value to ${value}`}`
        break

      case "set-effects":
        command = "platform quality set-effects"
        if (quality) command += ` level=${quality}`
        if (value !== undefined) command += ` value=${value}`
        description = `Set effects quality${quality ? ` to ${quality}` : ` value to ${value}`}`
        break

      case "set-postprocess":
        command = "platform quality set-postprocess"
        if (quality) command += ` level=${quality}`
        if (value !== undefined) command += ` value=${value}`
        description = `Set post-process quality${quality ? ` to ${quality}` : ` value to ${value}`}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      quality,
      value,
    })

    if (!result.success) {
      return {
        output: `Platform quality command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        quality,
        value,
        rawResult: result.result,
      },
    }
  },
})
