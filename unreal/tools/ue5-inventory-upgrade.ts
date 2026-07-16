import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5InventoryUpgradeTool = tool({
  description:
    "Manage UE5 inventory upgrades: expand slots, lock/unlock slots, set capacity, get capacity, and add tabs. Sends inventory upgrade commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["expand", "lock-slot", "unlock-slot", "set-capacity", "get-capacity", "add-tab"])
      .describe("Inventory upgrade action to perform"),
    slots: z
      .number()
      .optional()
      .describe("Number of slots for expand/set-capacity actions"),
    tabName: z
      .string()
      .optional()
      .describe("Tab name for add-tab and slot operations"),
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

    const { action, slots, tabName } = args

    let command: string
    let description: string

    switch (action) {
      case "expand":
        if (slots === undefined) {
          return {
            output: "Action 'expand' requires a slots value (number of slots to add).",
            metadata: { success: false },
          }
        }
        command = `mechanic inventory-upgrade expand ${slots} ${tabName ?? ""}`.trim()
        description = `Expand inventory by ${slots} slots${tabName !== undefined ? ` in tab '${tabName}'` : ""}`
        break
      case "lock-slot":
        if (tabName === undefined) {
          return {
            output: "Action 'lock-slot' requires a tabName (slot identifier).",
            metadata: { success: false },
          }
        }
        command = `mechanic inventory-upgrade lock-slot ${tabName}`
        description = `Lock slot '${tabName}'`
        break
      case "unlock-slot":
        if (tabName === undefined) {
          return {
            output: "Action 'unlock-slot' requires a tabName (slot identifier).",
            metadata: { success: false },
          }
        }
        command = `mechanic inventory-upgrade unlock-slot ${tabName}`
        description = `Unlock slot '${tabName}'`
        break
      case "set-capacity":
        if (slots === undefined) {
          return {
            output: "Action 'set-capacity' requires a slots value (new capacity).",
            metadata: { success: false },
          }
        }
        command = `mechanic inventory-upgrade set-capacity ${slots}`
        description = `Set inventory capacity to ${slots}`
        break
      case "get-capacity":
        command = `mechanic inventory-upgrade get-capacity ${tabName ?? ""}`.trim()
        description = `Get inventory capacity${tabName !== undefined ? ` for tab '${tabName}'` : ""}`
        break
      case "add-tab":
        if (tabName === undefined) {
          return {
            output: "Action 'add-tab' requires a tabName.",
            metadata: { success: false },
          }
        }
        command = `mechanic inventory-upgrade add-tab ${tabName}`
        description = `Add inventory tab '${tabName}'`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      slots,
      tabName,
    })

    if (!result.success) {
      return {
        output: `Inventory upgrade command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        slots,
        tabName,
      },
    }
  },
})
