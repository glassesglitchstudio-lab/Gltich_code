import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5TrapTool = tool({
  description:
    "Manage UE5 trap system: place traps, arm/disarm, trigger, remove, and list active traps. Supports spike, poison, electric, explosion, and fear trap types. Sends trap commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["place", "arm", "disarm", "trigger", "remove", "list"])
      .describe("Trap action to perform"),
    trapType: z
      .enum(["spike", "poison", "electric", "explosion", "fear"])
      .optional()
      .describe("Type of trap to place"),
    damage: z
      .number()
      .optional()
      .describe("Damage value for the trap"),
    location: z
      .string()
      .optional()
      .describe("Location or target actor name for the trap"),
    name: z
      .string()
      .optional()
      .describe("Trap instance name identifier"),
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

    const { action, trapType, damage, location, name } = args

    let command: string
    let description: string

    switch (action) {
      case "place":
        if (trapType === undefined) {
          return {
            output: "Action 'place' requires a trapType.",
            metadata: { success: false },
          }
        }
        command = `mechanic trap place ${trapType} ${location ?? "selected"} ${damage ?? 0} ${name ?? "default"}`
        description = `Place ${trapType} trap${name !== undefined ? ` '${name}'` : ""} at ${location ?? "selected location"}`
        break
      case "arm":
        if (name === undefined) {
          return {
            output: "Action 'arm' requires a trap name.",
            metadata: { success: false },
          }
        }
        command = `mechanic trap arm ${name}`
        description = `Arm trap '${name}'`
        break
      case "disarm":
        if (name === undefined) {
          return {
            output: "Action 'disarm' requires a trap name.",
            metadata: { success: false },
          }
        }
        command = `mechanic trap disarm ${name}`
        description = `Disarm trap '${name}'`
        break
      case "trigger":
        if (name === undefined) {
          return {
            output: "Action 'trigger' requires a trap name.",
            metadata: { success: false },
          }
        }
        command = `mechanic trap trigger ${name}`
        description = `Trigger trap '${name}'`
        break
      case "remove":
        if (name === undefined) {
          return {
            output: "Action 'remove' requires a trap name.",
            metadata: { success: false },
          }
        }
        command = `mechanic trap remove ${name}`
        description = `Remove trap '${name}'`
        break
      case "list":
        command = `mechanic trap list`
        description = `List all active traps`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      trapType,
      damage,
      location,
      name,
    })

    if (!result.success) {
      return {
        output: `Trap command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        trapType,
        damage,
        location,
        name,
      },
    }
  },
})
