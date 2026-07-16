import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5SaveSlotTool = tool({
  description:
    "Manage UE5 save slots: create, delete, rename, load, overwrite, get info, or list all slots. Sends slot commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["create", "delete", "rename", "load", "overwrite", "info", "list"])
      .describe("Save slot action to perform"),
    slotName: z
      .string()
      .optional()
      .describe("Save slot name (required for create, delete, rename, load, overwrite, info)"),
    newSlotName: z
      .string()
      .optional()
      .describe("New name when renaming a slot (used with 'rename')"),
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

    const { action, slotName, newSlotName } = args

    if (["create", "delete", "rename", "load", "overwrite", "info"].includes(action) && !slotName) {
      return {
        output: `Action '${action}' requires a slotName.`,
        metadata: { success: false },
      }
    }

    if (action === "rename" && !newSlotName) {
      return {
        output: "Action 'rename' requires a newSlotName.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "create":
        command = `save slot create ${slotName}`
        description = `Created save slot '${slotName}'`
        break
      case "delete":
        command = `save slot delete ${slotName}`
        description = `Deleted save slot '${slotName}'`
        break
      case "rename":
        command = `save slot rename ${slotName} ${newSlotName}`
        description = `Renamed slot '${slotName}' to '${newSlotName}'`
        break
      case "load":
        command = `save slot load ${slotName}`
        description = `Loading save slot '${slotName}'`
        break
      case "overwrite":
        command = `save slot overwrite ${slotName}`
        description = `Overwriting save slot '${slotName}'`
        break
      case "info":
        command = `save slot info ${slotName}`
        description = `Getting info for save slot '${slotName}'`
        break
      case "list":
        command = `save slot list`
        description = "Listing all save slots"
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      slotName,
      newSlotName,
    })

    if (!result.success) {
      return {
        output: `Save slot command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        slotName,
        newSlotName,
      },
    }
  },
})
