import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5PuzzleTool = tool({
  description:
    "Manage UE5 puzzle system: create puzzles, solve, get hints, reset, add pieces, and check completion. Supports combination, sequence, physics, memory, and sliding puzzle types. Sends puzzle commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["create", "solve", "hint", "reset", "addpiece", "check"])
      .describe("Puzzle action to perform"),
    puzzleType: z
      .enum(["combination", "sequence", "physics", "memory", "sliding"])
      .optional()
      .describe("Type of puzzle to create"),
    difficulty: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .describe("Puzzle difficulty level (1-10)"),
    name: z
      .string()
      .optional()
      .describe("Puzzle name identifier"),
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

    const { action, puzzleType, difficulty, name } = args

    let command: string
    let description: string

    switch (action) {
      case "create":
        if (puzzleType === undefined) {
          return {
            output: "Action 'create' requires a puzzleType.",
            metadata: { success: false },
          }
        }
        command = `mechanic puzzle create ${puzzleType} ${difficulty ?? 5} ${name ?? "default"}`
        description = `Create ${puzzleType} puzzle${name !== undefined ? ` '${name}'` : ""} (difficulty ${difficulty ?? 5})`
        break
      case "solve":
        if (name === undefined) {
          return {
            output: "Action 'solve' requires a puzzle name.",
            metadata: { success: false },
          }
        }
        command = `mechanic puzzle solve ${name}`
        description = `Solve puzzle '${name}'`
        break
      case "hint":
        if (name === undefined) {
          return {
            output: "Action 'hint' requires a puzzle name.",
            metadata: { success: false },
          }
        }
        command = `mechanic puzzle hint ${name}`
        description = `Get hint for puzzle '${name}'`
        break
      case "reset":
        if (name === undefined) {
          return {
            output: "Action 'reset' requires a puzzle name.",
            metadata: { success: false },
          }
        }
        command = `mechanic puzzle reset ${name}`
        description = `Reset puzzle '${name}'`
        break
      case "addpiece":
        if (name === undefined) {
          return {
            output: "Action 'addpiece' requires a puzzle name to add a piece to.",
            metadata: { success: false },
          }
        }
        command = `mechanic puzzle addpiece ${name}`
        description = `Add piece to puzzle '${name}'`
        break
      case "check":
        if (name === undefined) {
          return {
            output: "Action 'check' requires a puzzle name.",
            metadata: { success: false },
          }
        }
        command = `mechanic puzzle check ${name}`
        description = `Check completion status of puzzle '${name}'`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      puzzleType,
      difficulty,
      name,
    })

    if (!result.success) {
      return {
        output: `Puzzle command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        puzzleType,
        difficulty,
        name,
      },
    }
  },
})
