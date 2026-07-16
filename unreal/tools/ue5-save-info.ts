import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5SaveInfoTool = tool({
  description:
    "Get detailed information about a UE5 save slot: player level, location, play time, quest progress, and inventory. Sends save info command to the UE5 Editor via the HTTP connector.",
  args: {
    slotName: z
      .string()
      .optional()
      .describe("Save slot name (e.g. 'Slot1', 'MySave') — optional, defaults to listing all slots"),
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

    const { slotName, slotIndex } = args

    let command: string
    let description: string

    if (slotName) {
      command = `save info ${slotName} ${slotIndex}`
      description = `Retrieved save info for slot '${slotName}' (index ${slotIndex})`
    } else {
      command = `save list`
      description = "Retrieved all save slot information"
    }

    const result = await connector.sendCommand(command, {
      action: "info",
      slotName,
      slotIndex,
    })

    if (!result.success) {
      return {
        output: `Save info command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n\n${result.result ?? "No save data found."}`,
      metadata: {
        success: true,
        action: "info",
        slotName,
        slotIndex,
      },
    }
  },
})
