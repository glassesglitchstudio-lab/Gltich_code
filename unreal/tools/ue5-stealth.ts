import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5StealthTool = tool({
  description:
    "Manage UE5 stealth system: visibility, noise level, shadow/light detection, and detection rate. Sends stealth commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["visibility", "noise", "detect", "shadow", "light", "status"])
      .describe("Stealth action to perform"),
    target: z
      .string()
      .optional()
      .describe("Target actor name (defaults to selected actor)"),
    value: z
      .number()
      .optional()
      .describe("Float value (0.0-1.0) for visibility/noise operations"),
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
      case "visibility":
        if (value === undefined) {
          return {
            output: "Action 'visibility' requires a value (0.0-1.0).",
            metadata: { success: false },
          }
        }
        command = `stealth visibility ${target ?? "selected"} ${value}`
        description = `Set visibility to ${value} for ${target ?? "selected actor"}`
        break
      case "noise":
        if (value === undefined) {
          return {
            output: "Action 'noise' requires a value (0.0-1.0).",
            metadata: { success: false },
          }
        }
        command = `stealth noise ${target ?? "selected"} ${value}`
        description = `Set noise level to ${value} for ${target ?? "selected actor"}`
        break
      case "detect":
        command = `stealth detect ${target ?? "selected"}`
        description = `Check detection rate for ${target ?? "selected actor"}`
        break
      case "shadow":
        command = `stealth shadow ${target ?? "selected"}`
        description = `Check shadow status for ${target ?? "selected actor"}`
        break
      case "light":
        command = `stealth light ${target ?? "selected"}`
        description = `Check light status for ${target ?? "selected actor"}`
        break
      case "status":
        command = `stealth status ${target ?? "selected"}`
        description = `Get full stealth status for ${target ?? "selected actor"}`
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
        output: `Stealth command failed: ${result.error}`,
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
