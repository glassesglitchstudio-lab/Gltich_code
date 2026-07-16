import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const SanityActionSchema = z.enum([
  "set",
  "get",
  "drain",
  "recover",
  "max",
  "effect",
  "threshold",
  "status",
])

const SanityEffectSchema = z.enum([
  "hallucination",
  "tremor",
  "paranoia",
  "pass-out",
])

export const ue5UniqueSanityTool = tool({
  description:
    "Manage UE5 unique sanity system. Set/get sanity level, drain/recover sanity, set max value, trigger effects, configure thresholds, and check status. Uses the 'unique sanity' console command.",
  args: {
    action: SanityActionSchema.describe("Sanity action to perform"),
    value: z.number().min(0).max(100).optional().describe("Sanity value (0-100) — required for set, max, and threshold"),
    drainRate: z.number().min(0).optional().describe("Sanity drain rate per second — used with drain action"),
    effect: SanityEffectSchema.optional().describe("Sanity effect type (hallucination/tremor/paranoia/pass-out) — required for effect action"),
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

    const { action, value, drainRate, effect } = args

    if (action === "set" && value === undefined) {
      return {
        output: "Action 'set' requires a value parameter (0-100).",
        metadata: { success: false },
      }
    }

    if (action === "max" && value === undefined) {
      return {
        output: "Action 'max' requires a value parameter (0-100).",
        metadata: { success: false },
      }
    }

    if (action === "threshold" && value === undefined) {
      return {
        output: "Action 'threshold' requires a value parameter (0-100).",
        metadata: { success: false },
      }
    }

    if (action === "effect" && !effect) {
      return {
        output: "Action 'effect' requires an effect parameter (hallucination/tremor/paranoia/pass-out).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "set":
        command = `unique sanity set ${value}`
        description = `Set sanity level to ${value}`
        break

      case "get":
        command = `unique sanity get`
        description = "Retrieved current sanity level"
        break

      case "drain":
        command = `unique sanity drain`
        if (drainRate !== undefined) command += ` ${drainRate}`
        description = drainRate !== undefined
          ? `Draining sanity at rate ${drainRate}/sec`
          : "Draining sanity at default rate"
        break

      case "recover":
        command = `unique sanity recover`
        if (drainRate !== undefined) command += ` ${drainRate}`
        description = drainRate !== undefined
          ? `Recovering sanity at rate ${drainRate}/sec`
          : "Recovering sanity at default rate"
        break

      case "max":
        command = `unique sanity max ${value}`
        description = `Set maximum sanity to ${value}`
        break

      case "effect":
        command = `unique sanity effect ${effect}`
        description = `Triggered sanity effect: ${effect}`
        break

      case "threshold":
        command = `unique sanity threshold ${value}`
        description = `Set sanity effect threshold to ${value}`
        break

      case "status":
        command = `unique sanity status`
        description = "Retrieved sanity system status"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      value,
      drainRate,
      effect,
    })

    if (!result.success) {
      return {
        output: `Sanity command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        value,
        drainRate,
        effect,
        rawResult: result.result,
      },
    }
  },
})
