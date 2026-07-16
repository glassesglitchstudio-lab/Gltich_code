import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VfxNaniteActionSchema = z.enum([
  "enable",
  "disable",
  "set-lod",
  "set-pixel-error",
  "stats",
  "set-fallback",
])

export const ue5VfxNaniteTool = tool({
  description:
    "Control UE5 Nanite virtualized geometry system. Enable/disable Nanite on meshes, set LOD level, adjust pixel error threshold, view mesh stats, or set fallback mesh settings. Uses the 'vfx nanite' console command.",
  args: {
    action: VfxNaniteActionSchema.describe("Nanite action to perform"),
    target: z
      .string()
      .optional()
      .describe("Mesh or actor name to apply Nanite settings to"),
    value: z
      .number()
      .optional()
      .describe("Numeric value for LOD level (0-4), pixel error, or fallback settings"),
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

    const { action, target, value } = args

    let command: string
    let description: string

    switch (action) {
      case "enable":
        command = `vfx nanite enable`
        if (target) command += ` target=${target}`
        description = `Enabled Nanite${target ? ` on '${target}'` : ""}`
        break

      case "disable":
        command = `vfx nanite disable`
        if (target) command += ` target=${target}`
        description = `Disabled Nanite${target ? ` on '${target}'` : ""}`
        break

      case "set-lod":
        if (value === undefined) {
          return {
            output: "Action 'set-lod' requires a value parameter (LOD level 0-4).",
            metadata: { success: false },
          }
        }
        command = `vfx nanite lod=${value}`
        if (target) command += ` target=${target}`
        description = `Set Nanite LOD level to ${value}`
        break

      case "set-pixel-error":
        if (value === undefined) {
          return {
            output: "Action 'set-pixel-error' requires a value parameter.",
            metadata: { success: false },
          }
        }
        command = `vfx nanite pixel-error=${value}`
        if (target) command += ` target=${target}`
        description = `Set Nanite pixel error to ${value}`
        break

      case "stats":
        command = `vfx nanite stats`
        if (target) command += ` target=${target}`
        description = "Retrieved Nanite mesh statistics"
        break

      case "set-fallback":
        if (value === undefined) {
          return {
            output: "Action 'set-fallback' requires a value parameter (fallback pixel error).",
            metadata: { success: false },
          }
        }
        command = `vfx nanite fallback=${value}`
        if (target) command += ` target=${target}`
        description = `Set Nanite fallback pixel error to ${value}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      target,
      value,
    })

    if (!result.success) {
      return {
        output: `Nanite command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        target,
        value,
        rawResult: result.result,
      },
    }
  },
})
