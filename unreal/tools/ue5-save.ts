import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5SaveTool = tool({
  description:
    "Manage UE5 save system: save, load, delete, list saves, autosave, quicksave, or quickload. Sends save commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["save", "load", "delete", "list", "autosave", "quicksave", "quickload"])
      .describe("Save system action to perform"),
    slotName: z
      .string()
      .optional()
      .describe("Save slot name (e.g. 'Slot1', 'MySave') — required for save/load/delete"),
    slotIndex: z
      .number()
      .int()
      .min(0)
      .max(999)
      .optional()
      .default(0)
      .describe("Save slot index (0-999, default 0)"),
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

    const { action, slotName, slotIndex } = args

    // Validate required args per action
    if (["save", "load", "delete"].includes(action) && !slotName) {
      return {
        output: `Action '${action}' requires a slotName. Provide a slot name (e.g. 'Slot1').`,
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "save":
        command = `save save ${slotName} ${slotIndex}`
        description = `Saved game to slot '${slotName}' (index ${slotIndex})`
        break
      case "load":
        command = `save load ${slotName} ${slotIndex}`
        description = `Loaded game from slot '${slotName}' (index ${slotIndex})`
        break
      case "delete":
        command = `save delete ${slotName} ${slotIndex}`
        description = `Deleted save slot '${slotName}' (index ${slotIndex})`
        break
      case "list":
        command = `save list`
        description = "Listed all save slots"
        break
      case "autosave":
        command = `save autosave`
        description = "Triggered autosave"
        break
      case "quicksave":
        command = `save quicksave`
        description = "Quick saved to slot 0"
        break
      case "quickload":
        command = `save quickload`
        description = "Quick loaded from slot 0"
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
      slotIndex,
    })

    if (!result.success) {
      return {
        output: `Save command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        slotName,
        slotIndex,
      },
    }
  },
})
