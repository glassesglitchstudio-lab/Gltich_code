import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5ProcRoomTool = tool({
  description:
    "Procedurally generate, manage, and decorate rooms in the UE5 level. Send proc room commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["generate", "delete", "list", "resize", "decorate", "connect"])
      .describe("Room action to perform"),
    roomType: z
      .enum(["bedroom", "bathroom", "kitchen", "hallway", "basement", "attic", "cellar"])
      .optional()
      .describe("Type of room to generate"),
    width: z
      .number()
      .positive()
      .optional()
      .describe("Room width in Unreal units"),
    height: z
      .number()
      .positive()
      .optional()
      .describe("Room height in Unreal units"),
    depth: z
      .number()
      .positive()
      .optional()
      .describe("Room depth in Unreal units"),
    name: z
      .string()
      .optional()
      .describe("Unique room identifier (e.g. 'MainBedroom')"),
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

    const { action, roomType, width, height, depth, name } = args

    // Validate required args per action
    if (["generate", "delete", "resize", "decorate"].includes(action) && !name) {
      return {
        output: `Action '${action}' requires a name. Provide the room identifier (e.g. 'MainBedroom').`,
        metadata: { success: false },
      }
    }
    if (action === "generate" && !roomType) {
      return {
        output: "Action 'generate' requires a roomType.",
        metadata: { success: false },
      }
    }
    if (action === "resize" && (!width || !height || !depth)) {
      return {
        output: "Action 'resize' requires width, height, and depth.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "generate":
        command = `proc room generate ${roomType} ${name}${width ? ` width=${width}` : ""}${height ? ` height=${height}` : ""}${depth ? ` depth=${depth}` : ""}`
        description = `Generated ${roomType} room '${name}'`
        break
      case "delete":
        command = `proc room delete ${name}`
        description = `Deleted room '${name}'`
        break
      case "list":
        command = `proc room list`
        description = "Listed all rooms"
        break
      case "resize":
        command = `proc room resize ${name} ${width} ${height} ${depth}`
        description = `Resized room '${name}' to ${width}x${height}x${depth}`
        break
      case "decorate":
        command = `proc room decorate ${name}`
        description = `Decorated room '${name}'`
        break
      case "connect":
        command = `proc room connect ${name}`
        description = `Connected room '${name}' to adjacent corridors`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      roomType,
      width,
      height,
      depth,
      name,
    })

    if (!result.success) {
      return {
        output: `Proc room command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        roomType,
        name,
      },
    }
  },
})
