import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5StaminaTool = tool({
  description:
    "Manage UE5 stamina system: set, get, drain, recover, max stamina, and sprint cost. Sends stamina commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["set", "get", "drain", "recover", "max", "sprint"])
      .describe("Stamina action to perform"),
    target: z
      .string()
      .optional()
      .describe("Target actor name (defaults to selected actor)"),
    value: z
      .number()
      .optional()
      .describe("Numeric value for stamina operations (drain amount, recover amount, max value, sprint cost)"),
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

    const { action, target, value } = args

    let command: string
    let description: string

    switch (action) {
      case "set":
        if (value === undefined) {
          return {
            output: "Action 'set' requires a value (stamina amount to set).",
            metadata: { success: false },
          }
        }
        command = `mechanic stamina set ${target ?? "selected"} ${value}`
        description = `Set stamina to ${value} for ${target ?? "selected actor"}`
        break
      case "get":
        command = `mechanic stamina get ${target ?? "selected"}`
        description = `Get current stamina for ${target ?? "selected actor"}`
        break
      case "drain":
        if (value === undefined) {
          return {
            output: "Action 'drain' requires a value (stamina drain amount).",
            metadata: { success: false },
          }
        }
        command = `mechanic stamina drain ${target ?? "selected"} ${value}`
        description = `Drain ${value} stamina from ${target ?? "selected actor"}`
        break
      case "recover":
        if (value === undefined) {
          return {
            output: "Action 'recover' requires a value (stamina recovery amount).",
            metadata: { success: false },
          }
        }
        command = `mechanic stamina recover ${target ?? "selected"} ${value}`
        description = `Recover ${value} stamina for ${target ?? "selected actor"}`
        break
      case "max":
        if (value === undefined) {
          return {
            output: "Action 'max' requires a value (max stamina amount).",
            metadata: { success: false },
          }
        }
        command = `mechanic stamina max ${target ?? "selected"} ${value}`
        description = `Set max stamina to ${value} for ${target ?? "selected actor"}`
        break
      case "sprint":
        if (value === undefined) {
          return {
            output: "Action 'sprint' requires a value (sprint stamina cost per second).",
            metadata: { success: false },
          }
        }
        command = `mechanic stamina sprint ${target ?? "selected"} ${value}`
        description = `Set sprint stamina cost to ${value}/s for ${target ?? "selected actor"}`
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
      value,
    })

    if (!result.success) {
      return {
        output: `Stamina command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        target,
        value,
      },
    }
  },
})
