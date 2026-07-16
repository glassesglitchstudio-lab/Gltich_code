import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5HealthTool = tool({
  description:
    "Manage UE5 health system: set, get, damage, heal, max health, and health regeneration. Sends health commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["set", "get", "damage", "heal", "max", "regen", "status"])
      .describe("Health action to perform"),
    target: z
      .string()
      .optional()
      .describe("Target actor name (defaults to selected actor)"),
    value: z
      .number()
      .optional()
      .describe("Numeric value for health operations (damage amount, heal amount, max value, regen rate)"),
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
      case "set":
        if (value === undefined) {
          return {
            output: "Action 'set' requires a value (health amount to set).",
            metadata: { success: false },
          }
        }
        command = `mechanic health set ${target ?? "selected"} ${value}`
        description = `Set health to ${value} for ${target ?? "selected actor"}`
        break
      case "get":
        command = `mechanic health get ${target ?? "selected"}`
        description = `Get current health for ${target ?? "selected actor"}`
        break
      case "damage":
        if (value === undefined) {
          return {
            output: "Action 'damage' requires a value (damage amount).",
            metadata: { success: false },
          }
        }
        command = `mechanic health damage ${target ?? "selected"} ${value}`
        description = `Deal ${value} damage to ${target ?? "selected actor"}`
        break
      case "heal":
        if (value === undefined) {
          return {
            output: "Action 'heal' requires a value (heal amount).",
            metadata: { success: false },
          }
        }
        command = `mechanic health heal ${target ?? "selected"} ${value}`
        description = `Heal ${value} HP for ${target ?? "selected actor"}`
        break
      case "max":
        if (value === undefined) {
          return {
            output: "Action 'max' requires a value (max health amount).",
            metadata: { success: false },
          }
        }
        command = `mechanic health max ${target ?? "selected"} ${value}`
        description = `Set max health to ${value} for ${target ?? "selected actor"}`
        break
      case "regen":
        if (value === undefined) {
          return {
            output: "Action 'regen' requires a value (regeneration rate per second).",
            metadata: { success: false },
          }
        }
        command = `mechanic health regen ${target ?? "selected"} ${value}`
        description = `Set health regen rate to ${value}/s for ${target ?? "selected actor"}`
        break
      case "status":
        command = `mechanic health status ${target ?? "selected"}`
        description = `Get full health status for ${target ?? "selected actor"}`
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
        output: `Health command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        target,
        value,
      },
    }
  },
})
