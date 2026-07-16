import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const LocationSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
})

export const ue5ItemSpawnTool = tool({
  description:
    "Spawn an item in the UE5 world at a specified location. Places a pickup actor with the given item data into the current level.",
  args: {
    itemID: z.string().describe("Item ID to spawn (e.g. 'HealthPotion', 'Ammo', 'Key')"),
    location: LocationSchema.default({ x: 0, y: 0, z: 0 }).describe("World location (x, y, z) to spawn the item at"),
    quantity: z
      .number()
      .int()
      .positive()
      .default(1)
      .describe("Number of items to include in the pickup"),
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

    const { x, y, z } = args.location
    const command = `item spawn ${args.itemID} ${x},${y},${z} ${args.quantity}`

    const result = await connector.sendCommand(command, {
      itemID: args.itemID,
      location: args.location,
      quantity: args.quantity,
    })

    if (!result.success) {
      return {
        output: `Failed to spawn item: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `Spawned ${args.quantity}x ${args.itemID} at (${x}, ${y}, ${z}).\n${result.result ?? ""}`,
      metadata: {
        success: true,
        itemID: args.itemID,
        location: args.location,
        quantity: args.quantity,
      },
    }
  },
})
