import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const FearAuraActionSchema = z.enum([
  "create",
  "remove",
  "set-radius",
  "set-intensity",
  "set-falloff",
  "set-effect",
  "status",
])

const FearAuraEffectSchema = z.enum([
  "sanity-drain",
  "speed-reduce",
  "vision-distort",
  "audio-warp",
])

export const ue5UniqueFearAuraTool = tool({
  description:
    "Manage UE5 unique fear aura system. Create/remove fear auras, set radius and intensity, configure falloff curves, assign effects, and check status. Uses the 'unique fear-aura' console command.",
  args: {
    action: FearAuraActionSchema.describe("Fear aura action to perform"),
    auraName: z.string().optional().describe("Aura name — required for create, remove, set-radius, set-intensity, set-falloff, set-effect"),
    radius: z.number().positive().optional().describe("Aura radius in units — required for set-radius"),
    intensity: z.number().min(0).max(1).optional().describe("Aura intensity (0.0-1.0) — required for set-intensity"),
    effect: FearAuraEffectSchema.optional().describe("Aura effect type (sanity-drain/speed-reduce/vision-distort/audio-warp) — required for set-effect"),
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

    const { action, auraName, radius, intensity, effect } = args

    const needsName = ["create", "remove", "set-radius", "set-intensity", "set-falloff", "set-effect"]
    if (needsName.includes(action) && !auraName) {
      return {
        output: `Action '${action}' requires an auraName parameter.`,
        metadata: { success: false },
      }
    }

    if (action === "set-radius" && radius === undefined) {
      return {
        output: "Action 'set-radius' requires a radius parameter.",
        metadata: { success: false },
      }
    }

    if (action === "set-intensity" && intensity === undefined) {
      return {
        output: "Action 'set-intensity' requires an intensity parameter (0.0-1.0).",
        metadata: { success: false },
      }
    }

    if (action === "set-effect" && !effect) {
      return {
        output: "Action 'set-effect' requires an effect parameter (sanity-drain/speed-reduce/vision-distort/audio-warp).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "create":
        command = `unique fear-aura create ${auraName}`
        description = `Created fear aura '${auraName}'`
        break

      case "remove":
        command = `unique fear-aura remove ${auraName}`
        description = `Removed fear aura '${auraName}'`
        break

      case "set-radius":
        command = `unique fear-aura set-radius ${auraName} ${radius}`
        description = `Set radius for aura '${auraName}' to ${radius}`
        break

      case "set-intensity":
        command = `unique fear-aura set-intensity ${auraName} ${intensity}`
        description = `Set intensity for aura '${auraName}' to ${intensity}`
        break

      case "set-falloff":
        command = `unique fear-aura set-falloff ${auraName}`
        description = `Configured falloff for aura '${auraName}'`
        break

      case "set-effect":
        command = `unique fear-aura set-effect ${auraName} ${effect}`
        description = `Set effect for aura '${auraName}' to ${effect}`
        break

      case "status":
        command = `unique fear-aura status`
        description = "Retrieved fear aura system status"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      auraName,
      radius,
      intensity,
      effect,
    })

    if (!result.success) {
      return {
        output: `Fear aura command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        auraName,
        radius,
        intensity,
        effect,
        rawResult: result.result,
      },
    }
  },
})
