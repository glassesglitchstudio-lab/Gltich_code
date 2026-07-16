import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5UiInventoryScreenTool = tool({
  description:
    "Manage UE5 inventory screen: open, close, toggle, set layout, add/remove tabs, sort, and filter items. Uses the 'ui inventory-screen' console command.",
  args: {
    action: z
      .enum(["open", "close", "toggle", "set-layout", "add-tab", "remove-tab", "sort", "filter"])
      .describe("Inventory screen action to perform"),
    layout: z
      .enum(["grid", "list", "quickbar"])
      .optional()
      .describe("Inventory layout mode"),
    tabName: z.string().optional().describe("Name of the tab to add or remove"),
    filterType: z
      .enum(["all", "weapons", "consumables", "keys", "quest"])
      .optional()
      .describe("Item filter category"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return {
        output: "UE5 Editor is not connected.",
        metadata: { success: false },
      }
    }

    const { action, layout, tabName, filterType } = args

    if (action === "set-layout" && !layout) {
      return {
        output: "Action 'set-layout' requires a layout parameter.",
        metadata: { success: false },
      }
    }

    if (["add-tab", "remove-tab"].includes(action) && !tabName) {
      return {
        output: `Action '${action}' requires a tabName parameter.`,
        metadata: { success: false },
      }
    }

    if (action === "filter" && !filterType) {
      return {
        output: "Action 'filter' requires a filterType parameter.",
        metadata: { success: false },
      }
    }

    let command = `ui inventory-screen ${action}`
    if (layout) command += ` ${layout}`
    if (tabName) command += ` ${tabName}`
    if (filterType) command += ` ${filterType}`

    const result = await connector.sendCommand(command, { action, layout, tabName, filterType })

    if (!result.success) {
      return {
        output: `Inventory screen command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    let output = ""
    switch (action) {
      case "open":
        output = "Inventory screen opened."
        break
      case "close":
        output = "Inventory screen closed."
        break
      case "toggle":
        output = "Inventory screen toggled."
        break
      case "set-layout":
        output = `Inventory layout set to "${layout}".`
        break
      case "add-tab":
        output = `Tab "${tabName}" added to inventory.`
        break
      case "remove-tab":
        output = `Tab "${tabName}" removed from inventory.`
        break
      case "sort":
        output = "Inventory sorted."
        break
      case "filter":
        output = `Inventory filtered by "${filterType}".`
        break
    }

    return {
      output: `${output}\n${result.result ?? ""}`,
      metadata: { success: true, action, layout, tabName, filterType },
    }
  },
})
