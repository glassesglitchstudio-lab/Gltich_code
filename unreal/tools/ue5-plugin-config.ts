import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5PluginConfigTool = tool({
  description:
    "Manage UE5 plugin configuration: get, set, list, save, load, validate config, and manage config profiles. Sends plugin config commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["get", "set", "list", "save", "load", "validate", "create-profile", "switch-profile"])
      .describe("Config action to perform"),
    key: z
      .string()
      .optional()
      .describe("Configuration key for get/set actions (e.g. 'rendering.shadows')"),
    value: z
      .string()
      .optional()
      .describe("Configuration value for set action"),
    profileName: z
      .string()
      .optional()
      .describe("Profile name for create-profile/switch-profile actions"),
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

    const { action, key, value, profileName } = args

    let command: string
    let description: string

    switch (action) {
      case "get":
        if (!key) {
          return {
            output: "Action 'get' requires a key.",
            metadata: { success: false },
          }
        }
        command = `plugin config get ${key}`
        description = `Retrieved config value for '${key}'`
        break
      case "set":
        if (!key || value === undefined) {
          return {
            output: "Action 'set' requires both key and value.",
            metadata: { success: false },
          }
        }
        command = `plugin config set ${key} ${value}`
        description = `Set config '${key}' to '${value}'`
        break
      case "list":
        command = `plugin config list`
        description = "Listed all plugin configuration entries"
        break
      case "save":
        command = `plugin config save`
        description = "Saved current configuration to disk"
        break
      case "load":
        command = `plugin config load`
        description = "Loaded configuration from disk"
        break
      case "validate":
        command = `plugin config validate`
        description = "Validated plugin configuration"
        break
      case "create-profile":
        if (!profileName) {
          return {
            output: "Action 'create-profile' requires a profileName.",
            metadata: { success: false },
          }
        }
        command = `plugin config create-profile ${profileName}`
        description = `Created config profile '${profileName}'`
        break
      case "switch-profile":
        if (!profileName) {
          return {
            output: "Action 'switch-profile' requires a profileName.",
            metadata: { success: false },
          }
        }
        command = `plugin config switch-profile ${profileName}`
        description = `Switched to config profile '${profileName}'`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      key,
      value,
      profileName,
    })

    if (!result.success) {
      return {
        output: `Plugin config command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        key,
        value,
        profileName,
      },
    }
  },
})
