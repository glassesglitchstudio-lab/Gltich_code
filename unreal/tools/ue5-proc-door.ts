import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5ProcDoorTool = tool({
  description:
    "Procedurally place, remove, and manage doors in the UE5 level. Send proc door commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["place", "remove", "list", "lock", "unlock", "settype"])
      .describe("Door action to perform"),
    doorType: z
      .enum(["wooden", "metal", "glass", "secret", "jumpscare"])
      .optional()
      .describe("Type of door to place or change to"),
    location: z
      .string()
      .optional()
      .describe("World location or corridor name to place the door at"),
    locked: z
      .boolean()
      .optional()
      .describe("Whether the door should be locked"),
    roomName: z
      .string()
      .optional()
      .describe("Parent room name for filtering"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return {
        output: "UE5 Editor is not connected. Make sure the editor is running with the Glitch Code plugin enabled.",
        metadata: { success: false },
      }
    }

    const { action, doorType, location, locked, roomName } = args

    // Validate required args per action
    if (action === "place" && !doorType) {
      return {
        output: "Action 'place' requires a doorType.",
        metadata: { success: false },
      }
    }
    if (["remove", "lock", "unlock", "settype"].includes(action) && !location) {
      return {
        output: `Action '${action}' requires a location to identify the door.`,
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "place":
        command = `proc door place ${doorType}${location ? ` at=${location}` : ""}${roomName ? ` room=${roomName}` : ""}${locked !== undefined ? ` locked=${locked}` : ""}`
        description = `Placed ${doorType} door`
        break
      case "remove":
        command = `proc door remove at=${location}`
        description = `Removed door at '${location}'`
        break
      case "list":
        command = `proc door list${roomName ? ` room=${roomName}` : ""}`
        description = "Listed all doors"
        break
      case "lock":
        command = `proc door lock at=${location}`
        description = `Locked door at '${location}'`
        break
      case "unlock":
        command = `proc door unlock at=${location}`
        description = `Unlocked door at '${location}'`
        break
      case "settype":
        command = `proc door settype at=${location} type=${doorType}`
        description = `Changed door at '${location}' to ${doorType}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      doorType,
      location,
      locked,
      roomName,
    })

    if (!result.success) {
      return {
        output: `Proc door command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        doorType,
        location,
      },
    }
  },
})
