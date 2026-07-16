import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5InventoryTool = tool({
  description:
    "Manage UE5 inventory: add, remove, list, sort, clear, use, or drop items. Sends inventory commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["add", "remove", "list", "sort", "clear", "use", "drop"])
      .describe("Inventory action to perform"),
    itemName: z
      .string()
      .optional()
      .describe("Item ID (e.g. 'HealthPotion', 'Ammo') — required for add/remove/use/drop"),
    quantity: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1)
      .describe("Quantity for add/remove/drop operations"),
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

    const { action, itemName, quantity } = args

    // Validate required args per action
    if (["add", "remove", "use", "drop"].includes(action) && !itemName) {
      return {
        output: `Action '${action}' requires an itemName. Provide the item ID (e.g. 'HealthPotion').`,
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "add":
        command = `inventory add ${itemName} ${quantity}`
        description = `Added ${quantity}x ${itemName} to inventory`
        break
      case "remove":
        command = `inventory remove ${itemName} ${quantity}`
        description = `Removed ${quantity}x ${itemName} from inventory`
        break
      case "list":
        command = `inventory list`
        description = "Listed all inventory items"
        break
      case "sort":
        command = `inventory sort`
        description = "Sorted inventory by name"
        break
      case "clear":
        command = `inventory clear`
        description = "Cleared all inventory items"
        break
      case "use":
        command = `inventory use ${itemName}`
        description = `Used ${itemName}`
        break
      case "drop":
        command = `inventory drop ${itemName} ${quantity}`
        description = `Dropped ${quantity}x ${itemName}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      itemName,
      quantity,
    })

    if (!result.success) {
      return {
        output: `Inventory command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        itemName,
        quantity,
      },
    }
  },
})
