import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const AnimNotifyActionSchema = z.enum([
  "add",
  "remove",
  "list",
  "enable",
  "disable",
  "set-params",
])

const NotifyTypeSchema = z.enum([
  "sound",
  "particle",
  "footstep",
  "damage",
  "custom",
])

export const ue5AnimNotifyTool = tool({
  description:
    "Manage UE5 animation notifies: add/remove notifies, list active notifies, enable/disable specific notify types, or set notify parameters. Sends 'anim notify' commands to the UE5 Editor.",
  args: {
    action: AnimNotifyActionSchema.describe("Animation notify action to perform"),
    notifyType: NotifyTypeSchema.optional().describe(
      "Notify type: sound, particle, footstep, damage, or custom"
    ),
    notifyName: z
      .string()
      .optional()
      .describe("Name of the specific notify"),
    target: z
      .string()
      .optional()
      .describe("Target actor or animation sequence (defaults to selected)"),
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

    const { action, notifyType, notifyName, target } = args

    if (["add", "remove", "enable", "disable", "set-params"].includes(action) && !notifyType) {
      return {
        output: `Action '${action}' requires a notifyType parameter.`,
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "add":
        command = `anim notify add ${notifyType} ${notifyName ?? "default"} ${target ?? "selected"}`
        description = `Added ${notifyType} notify '${notifyName ?? "default"}' for ${target ?? "selected"}`
        break

      case "remove":
        if (!notifyName) {
          return {
            output: "Action 'remove' requires a notifyName parameter.",
            metadata: { success: false },
          }
        }
        command = `anim notify remove ${notifyType} ${notifyName} ${target ?? "selected"}`
        description = `Removed ${notifyType} notify '${notifyName}' from ${target ?? "selected"}`
        break

      case "list":
        command = `anim notify list ${target ?? "selected"}`
        description = `Listed animation notifies for ${target ?? "selected"}`
        break

      case "enable":
        command = `anim notify enable ${notifyType} ${target ?? "selected"}`
        description = `Enabled ${notifyType} notifies for ${target ?? "selected"}`
        break

      case "disable":
        command = `anim notify disable ${notifyType} ${target ?? "selected"}`
        description = `Disabled ${notifyType} notifies for ${target ?? "selected"}`
        break

      case "set-params":
        if (!notifyName) {
          return {
            output: "Action 'set-params' requires a notifyName parameter to identify which notify to configure.",
            metadata: { success: false },
          }
        }
        command = `anim notify set-params ${notifyType} ${notifyName} ${target ?? "selected"}`
        description = `Set parameters for ${notifyType} notify '${notifyName}' on ${target ?? "selected"}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      notifyType,
      notifyName,
      target,
    })

    if (!result.success) {
      return {
        output: `Animation notify command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        notifyType,
        notifyName,
        target,
        rawResult: result.result,
      },
    }
  },
})
