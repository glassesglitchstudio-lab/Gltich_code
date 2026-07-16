import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5PluginSettingsTool = tool({
  description:
    "Manage UE5 plugin settings: get, set, reset, list, export, import, and validate plugin configuration. Sends plugin settings commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["get", "set", "reset", "list", "export", "import", "validate"])
      .describe("Settings action to perform"),
    settingKey: z
      .string()
      .optional()
      .describe("Setting key for get/set/reset actions (e.g. 'rendering.quality')"),
    settingValue: z
      .string()
      .optional()
      .describe("New value for set action"),
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

    const { action, settingKey, settingValue } = args

    let command: string
    let description: string

    switch (action) {
      case "get":
        if (!settingKey) {
          return {
            output: "Action 'get' requires a settingKey.",
            metadata: { success: false },
          }
        }
        command = `plugin settings get ${settingKey}`
        description = `Retrieved setting '${settingKey}'`
        break
      case "set":
        if (!settingKey || settingValue === undefined) {
          return {
            output: "Action 'set' requires both settingKey and settingValue.",
            metadata: { success: false },
          }
        }
        command = `plugin settings set ${settingKey} ${settingValue}`
        description = `Set '${settingKey}' to '${settingValue}'`
        break
      case "reset":
        if (!settingKey) {
          return {
            output: "Action 'reset' requires a settingKey.",
            metadata: { success: false },
          }
        }
        command = `plugin settings reset ${settingKey}`
        description = `Reset '${settingKey}' to default value`
        break
      case "list":
        command = `plugin settings list`
        description = "Listed all plugin settings"
        break
      case "export":
        command = `plugin settings export`
        description = "Exported all plugin settings"
        break
      case "import":
        command = `plugin settings import`
        description = "Imported plugin settings from file"
        break
      case "validate":
        command = `plugin settings validate`
        description = "Validated all plugin settings"
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      settingKey,
      settingValue,
    })

    if (!result.success) {
      return {
        output: `Plugin settings command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        settingKey,
        settingValue,
      },
    }
  },
})
