import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const PlatformInputActionSchema = z.enum([
  "map",
  "unmap",
  "list",
  "reset",
  "export",
  "import",
  "test",
])

const InputTypeSchema = z.enum(["keyboard", "gamepad", "touch", "mouse"]).optional()

export const ue5PlatformInputTool = tool({
  description:
    "Manage cross-platform input mappings in UE5. Map/unmap keys to actions, list current bindings, reset to defaults, export/import input profiles, or test input responses. Uses the 'platform input' console command.",
  args: {
    action: PlatformInputActionSchema.describe("Input mapping action to perform"),
    actionName: z
      .string()
      .optional()
      .describe("Name of the input action to map/unmap/test"),
    key: z
      .string()
      .optional()
      .describe("Key or button identifier to bind (e.g. 'SpaceBar', 'Gamepad_Facebutton_Bottom')"),
    inputType: InputTypeSchema.describe("Input device type filter (keyboard, gamepad, touch, mouse)"),
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

    const { action, actionName, key, inputType } = args

    let command: string
    let description: string

    switch (action) {
      case "map":
        if (!actionName || !key) {
          return {
            output: "Action 'map' requires both 'actionName' and 'key' parameters.",
            metadata: { success: false },
          }
        }
        command = `platform input map action=${actionName} key=${key}`
        if (inputType) command += ` type=${inputType}`
        description = `Mapped key '${key}' to action '${actionName}'`
        break

      case "unmap":
        if (!actionName) {
          return {
            output: "Action 'unmap' requires an 'actionName' parameter.",
            metadata: { success: false },
          }
        }
        command = `platform input unmap action=${actionName}`
        if (key) command += ` key=${key}`
        description = `Unmapped action '${actionName}'${key ? ` (key: ${key})` : ""}`
        break

      case "list":
        command = "platform input list"
        if (inputType) command += ` type=${inputType}`
        description = "Listed current input mappings"
        break

      case "reset":
        command = "platform input reset"
        if (inputType) command += ` type=${inputType}`
        description = "Reset input mappings to defaults"
        break

      case "export":
        command = "platform input export"
        if (inputType) command += ` type=${inputType}`
        description = "Exported input mappings profile"
        break

      case "import":
        command = "platform input import"
        if (inputType) command += ` type=${inputType}`
        description = "Imported input mappings profile"
        break

      case "test":
        if (!actionName) {
          return {
            output: "Action 'test' requires an 'actionName' parameter.",
            metadata: { success: false },
          }
        }
        command = `platform input test action=${actionName}`
        if (inputType) command += ` type=${inputType}`
        description = `Tested input response for action '${actionName}'`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      actionName,
      key,
      inputType,
    })

    if (!result.success) {
      return {
        output: `Platform input command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        actionName,
        key,
        inputType,
        rawResult: result.result,
      },
    }
  },
})
