import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5CombatTool = tool({
  description:
    "Manage UE5 combat system: attack, block, dodge, parry, combo chains, damage dealing, and weapon type selection. Sends combat commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["attack", "block", "dodge", "parry", "combo", "damage-deal", "set-weapon"])
      .describe("Combat action to perform"),
    target: z
      .string()
      .optional()
      .describe("Target actor name (defaults to selected actor)"),
    weaponType: z
      .enum(["melee", "ranged", "unarmed"])
      .optional()
      .describe("Weapon type for weapon-related actions"),
    damage: z
      .number()
      .optional()
      .describe("Damage value for damage-deal and attack actions"),
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

    const { action, target, weaponType, damage } = args

    let command: string
    let description: string

    switch (action) {
      case "attack":
        command = `mechanic combat attack ${target ?? "selected"} ${damage ?? ""}`.trim()
        description = `Execute attack${damage !== undefined ? ` dealing ${damage} damage` : ""} for ${target ?? "selected actor"}`
        break
      case "block":
        command = `mechanic combat block ${target ?? "selected"}`
        description = `Execute block for ${target ?? "selected actor"}`
        break
      case "dodge":
        command = `mechanic combat dodge ${target ?? "selected"}`
        description = `Execute dodge for ${target ?? "selected actor"}`
        break
      case "parry":
        command = `mechanic combat parry ${target ?? "selected"}`
        description = `Execute parry for ${target ?? "selected actor"}`
        break
      case "combo":
        command = `mechanic combat combo ${target ?? "selected"}`
        description = `Execute combo chain for ${target ?? "selected actor"}`
        break
      case "damage-deal":
        if (damage === undefined) {
          return {
            output: "Action 'damage-deal' requires a damage value.",
            metadata: { success: false },
          }
        }
        command = `mechanic combat damage-deal ${target ?? "selected"} ${damage}`
        description = `Deal ${damage} combat damage to ${target ?? "selected actor"}`
        break
      case "set-weapon":
        if (weaponType === undefined) {
          return {
            output: "Action 'set-weapon' requires a weaponType (melee/ranged/unarmed).",
            metadata: { success: false },
          }
        }
        command = `mechanic combat set-weapon ${target ?? "selected"} ${weaponType}`
        description = `Set weapon type to ${weaponType} for ${target ?? "selected actor"}`
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
      weaponType,
      damage,
    })

    if (!result.success) {
      return {
        output: `Combat command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        target,
        weaponType,
        damage,
      },
    }
  },
})
