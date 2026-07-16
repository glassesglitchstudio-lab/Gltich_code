import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5ProcSpawnTool = tool({
  description:
    "Procedurally create and manage spawn points in the UE5 level. Send proc spawn commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["create", "remove", "list", "setpoint", "clearall"])
      .describe("Spawn point action to perform"),
    spawnType: z
      .enum(["enemy", "item", "pickup", "checkpoint", "trigger"])
      .optional()
      .describe("Type of spawn point"),
    location: z
      .string()
      .optional()
      .describe("World location or room name for the spawn point"),
    roomName: z
      .string()
      .optional()
      .describe("Parent room name for filtering"),
    name: z
      .string()
      .optional()
      .describe("Unique spawn point identifier (e.g. 'Spawn_Ambush_01')"),
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

    const { action, spawnType, location, roomName, name } = args

    // Validate required args per action
    if (action === "create" && !spawnType) {
      return {
        output: "Action 'create' requires a spawnType.",
        metadata: { success: false },
      }
    }
    if (["remove", "setpoint"].includes(action) && !name && !location) {
      return {
        output: `Action '${action}' requires a name or location to identify the spawn point.`,
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "create":
        command = `proc spawn create ${spawnType}${name ? ` name=${name}` : ""}${location ? ` at=${location}` : ""}${roomName ? ` room=${roomName}` : ""}`
        description = `Created ${spawnType} spawn point`
        break
      case "remove":
        command = `proc spawn remove${name ? ` name=${name}` : ""}${location ? ` at=${location}` : ""}`
        description = `Removed spawn point '${name || location}'`
        break
      case "list":
        command = `proc spawn list${spawnType ? ` type=${spawnType}` : ""}${roomName ? ` room=${roomName}` : ""}`
        description = "Listed all spawn points"
        break
      case "setpoint":
        command = `proc spawn setpoint${name ? ` name=${name}` : ""}${location ? ` at=${location}` : ""}${roomName ? ` room=${roomName}` : ""}`
        description = `Set spawn point '${name || location}' as active`
        break
      case "clearall":
        command = `proc spawn clearall${spawnType ? ` type=${spawnType}` : ""}${roomName ? ` room=${roomName}` : ""}`
        description = `Cleared${spawnType ? ` ${spawnType}` : " all"} spawn points${roomName ? ` in '${roomName}'` : ""}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      spawnType,
      location,
      roomName,
      name,
    })

    if (!result.success) {
      return {
        output: `Proc spawn command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        spawnType,
        name,
        location,
      },
    }
  },
})
