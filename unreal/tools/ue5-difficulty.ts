import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5DifficultyTool = tool({
  description:
    "Manage UE5 difficulty system: set/get difficulty level, scale difficulty, adjust enemy multipliers, loot multipliers, and time scale. Supports easy, normal, hard, and nightmare presets. Sends difficulty commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["set", "get", "scale", "enemy-mult", "loot-mult", "time-scale"])
      .describe("Difficulty action to perform"),
    difficulty: z
      .enum(["easy", "normal", "hard", "nightmare"])
      .optional()
      .describe("Difficulty preset level"),
    value: z
      .number()
      .optional()
      .describe("Numeric value for scale, multipliers, or time scale"),
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

    const { action, difficulty, value } = args

    let command: string
    let description: string

    switch (action) {
      case "set":
        if (difficulty === undefined) {
          return {
            output: "Action 'set' requires a difficulty level (easy/normal/hard/nightmare).",
            metadata: { success: false },
          }
        }
        command = `mechanic difficulty set ${difficulty}`
        description = `Set difficulty to ${difficulty}`
        break
      case "get":
        command = `mechanic difficulty get`
        description = `Get current difficulty settings`
        break
      case "scale":
        if (value === undefined) {
          return {
            output: "Action 'scale' requires a value (difficulty scale multiplier).",
            metadata: { success: false },
          }
        }
        command = `mechanic difficulty scale ${value}`
        description = `Scale difficulty by multiplier ${value}`
        break
      case "enemy-mult":
        if (value === undefined) {
          return {
            output: "Action 'enemy-mult' requires a value (enemy stats multiplier).",
            metadata: { success: false },
          }
        }
        command = `mechanic difficulty enemy-mult ${value}`
        description = `Set enemy stats multiplier to ${value}x`
        break
      case "loot-mult":
        if (value === undefined) {
          return {
            output: "Action 'loot-mult' requires a value (loot drop multiplier).",
            metadata: { success: false },
          }
        }
        command = `mechanic difficulty loot-mult ${value}`
        description = `Set loot drop multiplier to ${value}x`
        break
      case "time-scale":
        if (value === undefined) {
          return {
            output: "Action 'time-scale' requires a value (game time scale).",
            metadata: { success: false },
          }
        }
        command = `mechanic difficulty time-scale ${value}`
        description = `Set game time scale to ${value}x`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      difficulty,
      value,
    })

    if (!result.success) {
      return {
        output: `Difficulty command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        difficulty,
        value,
      },
    }
  },
})
