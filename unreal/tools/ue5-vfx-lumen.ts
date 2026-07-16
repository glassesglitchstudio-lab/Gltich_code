import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VfxLumenActionSchema = z.enum([
  "set-quality",
  "set-farfield",
  "set-gi",
  "set-reflection",
  "set-sky-light",
  "finalize",
])

const LumenQualitySchema = z.enum(["low", "medium", "high", "epic"])

export const ue5VfxLumenTool = tool({
  description:
    "Control UE5 Lumen global illumination and reflection system. Set quality level, far-field GI, global illumination, reflections, sky light, or finalize settings. Uses the 'vfx lumen' console command.",
  args: {
    action: VfxLumenActionSchema.describe("Lumen action to perform"),
    quality: LumenQualitySchema.optional().describe(
      "Quality level: low, medium, high, or epic — required for set-quality"
    ),
    value: z
      .number()
      .optional()
      .describe("Numeric value for GI strength, reflection quality, or sky light intensity"),
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

    if (action === "set-quality" && !quality) {
      return {
        output: "Action 'set-quality' requires a quality parameter (low/medium/high/epic).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "set-quality":
        command = `vfx lumen quality=${quality}`
        description = `Set Lumen quality to ${quality}`
        break

      case "set-farfield":
        if (value === undefined) {
          return {
            output: "Action 'set-farfield' requires a value parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx lumen farfield=${value}`
        description = `Set Lumen far-field GI to ${value}`
        break

      case "set-gi":
        if (value === undefined) {
          return {
            output: "Action 'set-gi' requires a value parameter (GI strength).",
            metadata: { success: false },
          }
        }
        command = `vfx lumen gi=${value}`
        description = `Set Lumen global illumination strength to ${value}`
        break

      case "set-reflection":
        if (value === undefined) {
          return {
            output: "Action 'set-reflection' requires a value parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx lumen reflection=${value}`
        description = `Set Lumen reflection quality to ${value}`
        break

      case "set-sky-light":
        if (value === undefined) {
          return {
            output: "Action 'set-sky-light' requires a value parameter (sky light intensity).",
            metadata: { success: false },
          }
        }
        command = `vfx lumen sky-light=${value}`
        description = `Set Lumen sky light intensity to ${value}`
        break

      case "finalize":
        command = `vfx lumen finalize`
        description = "Finalized Lumen settings (rebuilds lighting)"
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
        output: `Lumen command failed: ${result.error}`,
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
