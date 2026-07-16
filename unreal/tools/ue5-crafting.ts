import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5CraftingTool = tool({
  description:
    "Manage UE5 crafting system: craft items, add/remove recipes, list recipes, and manage crafting materials. Sends crafting commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["craft", "addrecipe", "listrecipes", "addmaterial", "removecrafting"])
      .describe("Crafting action to perform"),
    recipeName: z
      .string()
      .optional()
      .describe("Recipe name for craft and addrecipe actions"),
    materials: z
      .string()
      .optional()
      .describe("Comma-separated materials list for recipe creation"),
    result: z
      .string()
      .optional()
      .describe("Result item name for addrecipe action"),
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

    const { action, recipeName, materials, result } = args

    let command: string
    let description: string

    switch (action) {
      case "craft":
        if (recipeName === undefined) {
          return {
            output: "Action 'craft' requires a recipeName.",
            metadata: { success: false },
          }
        }
        command = `mechanic crafting craft ${recipeName}`
        description = `Craft item from recipe '${recipeName}'`
        break
      case "addrecipe":
        if (recipeName === undefined || materials === undefined || result === undefined) {
          return {
            output: "Action 'addrecipe' requires recipeName, materials, and result.",
            metadata: { success: false },
          }
        }
        command = `mechanic crafting addrecipe ${recipeName} ${materials} ${result}`
        description = `Add recipe '${recipeName}' (${materials} -> ${result})`
        break
      case "listrecipes":
        command = `mechanic crafting listrecipes`
        description = `List all crafting recipes`
        break
      case "addmaterial":
        if (recipeName === undefined || materials === undefined) {
          return {
            output: "Action 'addmaterial' requires recipeName and materials.",
            metadata: { success: false },
          }
        }
        command = `mechanic crafting addmaterial ${recipeName} ${materials}`
        description = `Add material '${materials}' to recipe '${recipeName}'`
        break
      case "removecrafting":
        if (recipeName === undefined) {
          return {
            output: "Action 'removecrafting' requires a recipeName to remove.",
            metadata: { success: false },
          }
        }
        command = `mechanic crafting removecrafting ${recipeName}`
        description = `Remove recipe '${recipeName}'`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result2 = await connector.sendCommand(command, {
      action,
      recipeName,
      materials,
      result,
    })

    if (!result2.success) {
      return {
        output: `Crafting command failed: ${result2.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result2.result ?? ""}`,
      metadata: {
        success: true,
        action,
        recipeName,
        materials,
        result,
      },
    }
  },
})
