import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const VectorSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
})

export const ue5PatrolTool = tool({
  description:
    "Manage UE5 patrol routes: add/remove patrol points, list routes, clear routes, start/stop patrol for an actor. Sends patrol commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["add", "remove", "list", "clear", "start", "stop", "set-type"])
      .describe("Patrol action to perform"),
    actorName: z
      .string()
      .optional()
      .describe("Name of the actor to manage patrol for (required for add/remove/start/stop/set-type)"),
    location: VectorSchema.optional()
      .describe("Patrol point location (x, y, z) — required for add action"),
    params: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .optional()
      .describe("Additional parameters (e.g. { waitTime: 2.0, label: 'Guard Post', index: 0, type: 'Loop' })"),
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

    const { action, actorName, location, params } = args

    let command: string
    let description: string

    switch (action) {
      case "add": {
        if (!actorName) {
          return {
            output: "Action 'add' requires an actorName parameter.",
            metadata: { success: false },
          }
        }
        const loc = location ?? { x: 0, y: 0, z: 0 }
        const waitTime = params?.waitTime ?? 0
        const label = params?.label ?? ""
        command = `patrol add ${actorName} ${loc.x},${loc.y},${loc.z} ${waitTime} ${label}`
        description = `Added patrol point at (${loc.x}, ${loc.y}, ${loc.z}) for ${actorName}`
        break
      }
      case "remove": {
        if (!actorName) {
          return {
            output: "Action 'remove' requires an actorName parameter.",
            metadata: { success: false },
          }
        }
        const index = params?.index ?? 0
        command = `patrol remove ${actorName} ${index}`
        description = `Removed patrol point at index ${index} from ${actorName}`
        break
      }
      case "list": {
        const target = actorName ?? "all"
        command = `patrol list ${target}`
        description = `Listing patrol routes for ${target}`
        break
      }
      case "clear": {
        if (!actorName) {
          return {
            output: "Action 'clear' requires an actorName parameter.",
            metadata: { success: false },
          }
        }
        command = `patrol clear ${actorName}`
        description = `Cleared all patrol points for ${actorName}`
        break
      }
      case "start": {
        if (!actorName) {
          return {
            output: "Action 'start' requires an actorName parameter.",
            metadata: { success: false },
          }
        }
        command = `patrol start ${actorName}`
        description = `Started patrol for ${actorName}`
        break
      }
      case "stop": {
        if (!actorName) {
          return {
            output: "Action 'stop' requires an actorName parameter.",
            metadata: { success: false },
          }
        }
        command = `patrol stop ${actorName}`
        description = `Stopped patrol for ${actorName}`
        break
      }
      case "set-type": {
        if (!actorName) {
          return {
            output: "Action 'set-type' requires an actorName parameter.",
            metadata: { success: false },
          }
        }
        const patrolType = params?.type ?? "Loop"
        command = `patrol set-type ${actorName} ${patrolType}`
        description = `Set patrol type to ${patrolType} for ${actorName}`
        break
      }
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      actorName,
      location,
      params,
    })

    if (!result.success) {
      return {
        output: `Patrol command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        actorName,
        location,
        params,
      },
    }
  },
})
