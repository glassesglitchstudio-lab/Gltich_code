import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const FearActionSchema = z.enum([
  "set",
  "get",
  "add-modifier",
  "remove-modifier",
  "state",
  "reset",
  "modifiers",
])

const ModifierNameSchema = z.enum([
  "Darkness",
  "Isolation",
  "Sound",
  "Light",
  "Safety",
  "Known",
])

export const ue5FearTool = tool({
  description:
    "Manage UE5 fear curve system. Set/get fear level, add/remove fear modifiers, check fear state (Calm/Uneasy/Nervous/Scared/Terrified), or reset fear. Uses the 'fear' console command.",
  args: {
    action: FearActionSchema.describe("Fear action to perform"),
    value: z.number().min(0).max(100).optional().describe("Fear level value (0-100) for 'set' or modifier value for 'add-modifier'"),
    modifierName: ModifierNameSchema.optional().describe("Modifier name (Darkness/Isolation/Sound/Light/Safety/Known)"),
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

    const { action, value, modifierName } = args

    // Validate required args per action
    if (action === "set" && value === undefined) {
      return {
        output: "Action 'set' requires a value parameter (0-100).",
        metadata: { success: false },
      }
    }

    if (action === "add-modifier" && (!modifierName || value === undefined)) {
      return {
        output: "Action 'add-modifier' requires both modifierName and value parameters.",
        metadata: { success: false },
      }
    }

    if (action === "remove-modifier" && !modifierName) {
      return {
        output: "Action 'remove-modifier' requires a modifierName parameter.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "set":
        command = `fear set ${value}`
        description = `Set fear level to ${value}`
        break

      case "get":
        command = `fear get`
        description = "Retrieved current fear level"
        break

      case "add-modifier":
        command = `fear add-modifier ${modifierName} ${value}`
        description = `Added ${modifierName} modifier (value: ${value})`
        break

      case "remove-modifier":
        command = `fear remove-modifier ${modifierName}`
        description = `Removed ${modifierName} modifier`
        break

      case "state":
        command = `fear state`
        description = "Retrieved current fear state"
        break

      case "reset":
        command = `fear reset`
        description = "Reset fear level and all modifiers"
        break

      case "modifiers":
        command = `fear modifiers`
        description = "Listed all fear modifiers"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      value,
      modifierName,
    })

    if (!result.success) {
      return {
        output: `Fear command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        value,
        modifierName,
        rawResult: result.result,
      },
    }
  },
})
