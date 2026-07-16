import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5ProcPropsTool = tool({
  description:
    "Procedurally scatter, manage, and configure props in the UE5 level. Send proc props commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["scatter", "clear", "list", "density", "seed", "category"])
      .describe("Props action to perform"),
    category: z
      .enum(["furniture", "decoration", "clutter", "horror", "nature", "lighting"])
      .optional()
      .describe("Prop category to operate on"),
    density: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Prop density factor from 0 (sparse) to 1 (dense)"),
    seed: z
      .number()
      .int()
      .optional()
      .describe("Random seed for reproducible placement"),
    roomName: z
      .string()
      .optional()
      .describe("Room name to scope the operation to"),
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

    const { action, category, density, seed, roomName } = args

    // Validate required args per action
    if (action === "scatter" && !category) {
      return {
        output: "Action 'scatter' requires a category.",
        metadata: { success: false },
      }
    }
    if (["clear", "density"].includes(action) && !category && !roomName) {
      return {
        output: `Action '${action}' requires a category or roomName to scope the operation.`,
        metadata: { success: false },
      }
    }
    if (action === "density" && density === undefined) {
      return {
        output: "Action 'density' requires a density value (0-1).",
        metadata: { success: false },
      }
    }
    if (action === "seed" && seed === undefined) {
      return {
        output: "Action 'seed' requires a seed value.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "scatter":
        command = `proc props scatter ${category}${roomName ? ` room=${roomName}` : ""}${density !== undefined ? ` density=${density}` : ""}${seed !== undefined ? ` seed=${seed}` : ""}`
        description = `Scattered ${category} props`
        break
      case "clear":
        command = `proc props clear${category ? ` category=${category}` : ""}${roomName ? ` room=${roomName}` : ""}`
        description = `Cleared ${category || "all"} props${roomName ? ` in '${roomName}'` : ""}`
        break
      case "list":
        command = `proc props list${category ? ` category=${category}` : ""}${roomName ? ` room=${roomName}` : ""}`
        description = "Listed props"
        break
      case "density":
        command = `proc props density ${density}${category ? ` category=${category}` : ""}${roomName ? ` room=${roomName}` : ""}`
        description = `Set prop density to ${density}`
        break
      case "seed":
        command = `proc props seed ${seed}${category ? ` category=${category}` : ""}`
        description = `Set random seed to ${seed}`
        break
      case "category":
        command = `proc props category${category ? ` ${category}` : ""}${roomName ? ` room=${roomName}` : ""}`
        description = `Listed props by category${category ? ` (${category})` : ""}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      category,
      density,
      seed,
      roomName,
    })

    if (!result.success) {
      return {
        output: `Proc props command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        category,
        roomName,
      },
    }
  },
})
