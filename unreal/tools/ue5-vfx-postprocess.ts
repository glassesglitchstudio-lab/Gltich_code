import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VfxPostprocessActionSchema = z.enum([
  "set-bloom",
  "set-chromatic",
  "set-vignette",
  "set-grain",
  "set-motionblur",
  "reset",
  "preset",
])

const PostprocessPresetSchema = z.enum([
  "horror",
  "flashback",
  "dream",
  "nightmare",
  "clear",
])

export const ue5VfxPostprocessTool = tool({
  description:
    "Control UE5 post-process effects. Adjust bloom, chromatic aberration, vignette, film grain, motion blur, or apply named presets (horror, flashback, dream, nightmare, clear). Uses the 'vfx postprocess' console command.",
  args: {
    action: VfxPostprocessActionSchema.describe(
      "Post-process action to perform"
    ),
    presetName: PostprocessPresetSchema.optional().describe(
      "Preset name: horror, flashback, dream, nightmare, or clear — required for preset action"
    ),
    value: z
      .number()
      .optional()
      .describe(
        "Numeric value (0-1 range) for bloom intensity, chromatic aberration, vignette, grain, or motion blur amount"
      ),
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

    const { action, presetName, value } = args

    if (action === "preset" && !presetName) {
      return {
        output: "Action 'preset' requires a presetName parameter (horror/flashback/dream/nightmare/clear).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "set-bloom":
        if (value === undefined) {
          return {
            output: "Action 'set-bloom' requires a value parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx postprocess bloom=${value}`
        description = `Set bloom intensity to ${value}`
        break

      case "set-chromatic":
        if (value === undefined) {
          return {
            output: "Action 'set-chromatic' requires a value parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx postprocess chromatic=${value}`
        description = `Set chromatic aberration to ${value}`
        break

      case "set-vignette":
        if (value === undefined) {
          return {
            output: "Action 'set-vignette' requires a value parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx postprocess vignette=${value}`
        description = `Set vignette intensity to ${value}`
        break

      case "set-grain":
        if (value === undefined) {
          return {
            output: "Action 'set-grain' requires a value parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx postprocess grain=${value}`
        description = `Set film grain intensity to ${value}`
        break

      case "set-motionblur":
        if (value === undefined) {
          return {
            output: "Action 'set-motionblur' requires a value parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx postprocess motionblur=${value}`
        description = `Set motion blur amount to ${value}`
        break

      case "reset":
        command = `vfx postprocess reset`
        description = "Reset all post-process effects to defaults"
        break

      case "preset":
        command = `vfx postprocess preset ${presetName}`
        description = `Applied ${presetName} post-process preset`
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
    })

    if (!result.success) {
      return {
        output: `Post-process command failed: ${result.error}`,
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
        rawResult: result.result,
      },
    }
  },
})
