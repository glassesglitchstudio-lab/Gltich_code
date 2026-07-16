import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5SaveAutoTool = tool({
  description:
    "Manage UE5 autosave system: enable/disable autosave, set save interval, trigger save/load, check status, or list autosave slots. Sends autosave commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["enable", "disable", "set-interval", "save", "load", "status", "list"])
      .describe("Autosave action to perform"),
    interval: z
      .number()
      .optional()
      .describe("Autosave interval in seconds (used with 'set-interval')"),
    slotName: z
      .string()
      .optional()
      .describe("Save slot name for manual save/load operations (used with 'save' or 'load')"),
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

    const { action, interval, slotName } = args

    if (action === "set-interval" && interval === undefined) {
      return {
        output: "Action 'set-interval' requires an interval value in seconds.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "enable":
        command = `save auto enable`
        description = "Autosave enabled"
        break
      case "disable":
        command = `save auto disable`
        description = "Autosave disabled"
        break
      case "set-interval":
        command = `save auto set-interval ${interval}`
        description = `Autosave interval set to ${interval}s`
        break
      case "save":
        command = `save auto save ${slotName ?? ""}`
        description = `Triggered autosave${slotName ? ` to slot '${slotName}'` : ""}`
        break
      case "load":
        command = `save auto load ${slotName ?? ""}`
        description = `Loading autosave${slotName ? ` from slot '${slotName}'` : ""}`
        break
      case "status":
        command = `save auto status`
        description = "Getting autosave status"
        break
      case "list":
        command = `save auto list`
        description = "Listing autosave slots"
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      interval,
      slotName,
    })

    if (!result.success) {
      return {
        output: `Autosave command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        interval,
        slotName,
      },
    }
  },
})
