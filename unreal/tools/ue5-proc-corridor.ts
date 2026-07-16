import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5ProcCorridorTool = tool({
  description:
    "Procedurally create and manage corridors between rooms in the UE5 level. Send proc corridor commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["create", "delete", "list", "resize", "style"])
      .describe("Corridor action to perform"),
    fromRoom: z
      .string()
      .optional()
      .describe("Source room identifier (e.g. 'MainBedroom')"),
    toRoom: z
      .string()
      .optional()
      .describe("Destination room identifier (e.g. 'Kitchen')"),
    width: z
      .number()
      .positive()
      .optional()
      .describe("Corridor width in Unreal units"),
    corridorType: z
      .enum(["straight", "L-shaped", "T-shaped", "zigzag"])
      .optional()
      .describe("Shape of the corridor path"),
    name: z
      .string()
      .optional()
      .describe("Unique corridor identifier (e.g. 'HallToKitchen')"),
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

    const { action, fromRoom, toRoom, width, corridorType, name } = args

    // Validate required args per action
    if (action === "create" && !name) {
      return {
        output: "Action 'create' requires a name for the corridor.",
        metadata: { success: false },
      }
    }
    if (action === "create" && (!fromRoom || !toRoom)) {
      return {
        output: "Action 'create' requires both fromRoom and toRoom.",
        metadata: { success: false },
      }
    }
    if (["delete", "resize", "style"].includes(action) && !name) {
      return {
        output: `Action '${action}' requires a name. Provide the corridor identifier.`,
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "create":
        command = `proc corridor create ${name} from=${fromRoom} to=${toRoom}${width ? ` width=${width}` : ""}${corridorType ? ` type=${corridorType}` : ""}`
        description = `Created corridor '${name}' from '${fromRoom}' to '${toRoom}'`
        break
      case "delete":
        command = `proc corridor delete ${name}`
        description = `Deleted corridor '${name}'`
        break
      case "list":
        command = `proc corridor list`
        description = "Listed all corridors"
        break
      case "resize":
        command = `proc corridor resize ${name}${width ? ` width=${width}` : ""}`
        description = `Resized corridor '${name}'`
        break
      case "style":
        command = `proc corridor style ${name}${corridorType ? ` type=${corridorType}` : ""}`
        description = `Styled corridor '${name}'`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      fromRoom,
      toRoom,
      width,
      corridorType,
      name,
    })

    if (!result.success) {
      return {
        output: `Proc corridor command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        name,
        fromRoom,
        toRoom,
      },
    }
  },
})
