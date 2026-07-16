import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5DamageTool = tool({
  description:
    "Manage UE5 damage system: deal damage, apply DoT, area-of-effect damage, set defense, vulnerability, and resistance. Sends damage commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["deal", "apply-dot", "apply-aoe", "set-defense", "vulnerability", "resist"])
      .describe("Damage action to perform"),
    damageType: z
      .enum(["physical", "fire", "electric", "poison", "psychic", "true"])
      .optional()
      .describe("Damage type for the operation"),
    value: z
      .number()
      .optional()
      .describe("Numeric value for damage amount, defense, or resistance percentage"),
    target: z
      .string()
      .optional()
      .describe("Target actor name (defaults to selected actor)"),
    radius: z
      .number()
      .optional()
      .describe("Radius for area-of-effect damage"),
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

    const { action, damageType, value, target, radius } = args

    let command: string
    let description: string

    switch (action) {
      case "deal":
        if (damageType === undefined || value === undefined) {
          return {
            output: "Action 'deal' requires damageType and value.",
            metadata: { success: false },
          }
        }
        command = `mechanic damage deal ${target ?? "selected"} ${damageType} ${value}`
        description = `Deal ${value} ${damageType} damage to ${target ?? "selected actor"}`
        break
      case "apply-dot":
        if (damageType === undefined || value === undefined) {
          return {
            output: "Action 'apply-dot' requires damageType and value (damage per tick).",
            metadata: { success: false },
          }
        }
        command = `mechanic damage apply-dot ${target ?? "selected"} ${damageType} ${value}`
        description = `Apply ${damageType} DoT (${value}/tick) to ${target ?? "selected actor"}`
        break
      case "apply-aoe":
        if (damageType === undefined || value === undefined || radius === undefined) {
          return {
            output: "Action 'apply-aoe' requires damageType, value, and radius.",
            metadata: { success: false },
          }
        }
        command = `mechanic damage apply-aoe ${target ?? "selected"} ${damageType} ${value} ${radius}`
        description = `Apply ${damageType} AoE damage (${value}, radius ${radius}) at ${target ?? "selected actor"}`
        break
      case "set-defense":
        if (damageType === undefined || value === undefined) {
          return {
            output: "Action 'set-defense' requires damageType and value (defense percentage).",
            metadata: { success: false },
          }
        }
        command = `mechanic damage set-defense ${target ?? "selected"} ${damageType} ${value}`
        description = `Set ${damageType} defense to ${value}% for ${target ?? "selected actor"}`
        break
      case "vulnerability":
        if (damageType === undefined || value === undefined) {
          return {
            output: "Action 'vulnerability' requires damageType and value (vulnerability percentage).",
            metadata: { success: false },
          }
        }
        command = `mechanic damage vulnerability ${target ?? "selected"} ${damageType} ${value}`
        description = `Set ${damageType} vulnerability to ${value}% for ${target ?? "selected actor"}`
        break
      case "resist":
        if (damageType === undefined || value === undefined) {
          return {
            output: "Action 'resist' requires damageType and value (resistance percentage).",
            metadata: { success: false },
          }
        }
        command = `mechanic damage resist ${target ?? "selected"} ${damageType} ${value}`
        description = `Set ${damageType} resistance to ${value}% for ${target ?? "selected actor"}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      damageType,
      value,
      target,
      radius,
    })

    if (!result.success) {
      return {
        output: `Damage command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        damageType,
        value,
        target,
        radius,
      },
    }
  },
})
