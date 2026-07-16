import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5HealingTool = tool({
  description:
    "Manage UE5 healing system: instant healing, bandages, potions, reviving, cleansing, and heal-over-time rates. Sends healing commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["apply", "bandage", "potion", "revive", "cleanse", "set-rate"])
      .describe("Healing action to perform"),
    healType: z
      .enum(["instant", "regen", "cleanse", "revive"])
      .optional()
      .describe("Type of healing for the apply action"),
    value: z
      .number()
      .optional()
      .describe("Heal amount or regen rate per second"),
    target: z
      .string()
      .optional()
      .describe("Target actor name (defaults to selected actor)"),
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

    const { action, healType, value, target } = args

    let command: string
    let description: string

    switch (action) {
      case "apply":
        if (healType === undefined || value === undefined) {
          return {
            output: "Action 'apply' requires healType and value.",
            metadata: { success: false },
          }
        }
        command = `mechanic healing apply ${target ?? "selected"} ${healType} ${value}`
        description = `Apply ${healType} healing (${value}) to ${target ?? "selected actor"}`
        break
      case "bandage":
        if (value === undefined) {
          return {
            output: "Action 'bandage' requires a value (heal amount).",
            metadata: { success: false },
          }
        }
        command = `mechanic healing bandage ${target ?? "selected"} ${value}`
        description = `Apply bandage healing (${value}) to ${target ?? "selected actor"}`
        break
      case "potion":
        if (value === undefined) {
          return {
            output: "Action 'potion' requires a value (heal amount).",
            metadata: { success: false },
          }
        }
        command = `mechanic healing potion ${target ?? "selected"} ${value}`
        description = `Use potion (${value} HP) on ${target ?? "selected actor"}`
        break
      case "revive":
        command = `mechanic healing revive ${target ?? "selected"}`
        description = `Revive ${target ?? "selected actor"}`
        break
      case "cleanse":
        command = `mechanic healing cleanse ${target ?? "selected"}`
        description = `Cleanse debuffs from ${target ?? "selected actor"}`
        break
      case "set-rate":
        if (value === undefined) {
          return {
            output: "Action 'set-rate' requires a value (regen rate per second).",
            metadata: { success: false },
          }
        }
        command = `mechanic healing set-rate ${target ?? "selected"} ${value}`
        description = `Set heal-over-time rate to ${value}/s for ${target ?? "selected actor"}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      healType,
      value,
      target,
    })

    if (!result.success) {
      return {
        output: `Healing command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        healType,
        value,
        target,
      },
    }
  },
})
