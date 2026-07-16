import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5KeyItemTool = tool({
  description:
    "Manage UE5 key item system: create keys, give/remove keys, use keys on locks, list keys, and check lock status. Supports key, code, biometric, and magical key types. Sends key-item commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["create", "give", "remove", "use", "list", "check"])
      .describe("Key item action to perform"),
    keyName: z
      .string()
      .optional()
      .describe("Key item name identifier"),
    lockTarget: z
      .string()
      .optional()
      .describe("Lock target actor name for use/check actions"),
    keyType: z
      .enum(["key", "code", "biometric", "magical"])
      .optional()
      .describe("Type of key item"),
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

    const { action, keyName, lockTarget, keyType } = args

    let command: string
    let description: string

    switch (action) {
      case "create":
        if (keyName === undefined || keyType === undefined) {
          return {
            output: "Action 'create' requires keyName and keyType.",
            metadata: { success: false },
          }
        }
        command = `mechanic key-item create ${keyName} ${keyType} ${lockTarget ?? ""}`.trim()
        description = `Create ${keyType} key '${keyName}'${lockTarget !== undefined ? ` for lock '${lockTarget}'` : ""}`
        break
      case "give":
        if (keyName === undefined) {
          return {
            output: "Action 'give' requires a keyName.",
            metadata: { success: false },
          }
        }
        command = `mechanic key-item give ${lockTarget ?? "selected"} ${keyName}`
        description = `Give key '${keyName}' to ${lockTarget ?? "selected actor"}`
        break
      case "remove":
        if (keyName === undefined) {
          return {
            output: "Action 'remove' requires a keyName.",
            metadata: { success: false },
          }
        }
        command = `mechanic key-item remove ${lockTarget ?? "selected"} ${keyName}`
        description = `Remove key '${keyName}' from ${lockTarget ?? "selected actor"}`
        break
      case "use":
        if (keyName === undefined || lockTarget === undefined) {
          return {
            output: "Action 'use' requires keyName and lockTarget.",
            metadata: { success: false },
          }
        }
        command = `mechanic key-item use ${keyName} ${lockTarget}`
        description = `Use key '${keyName}' on lock '${lockTarget}'`
        break
      case "list":
        command = `mechanic key-item list ${lockTarget ?? ""}`.trim()
        description = `List all keys${lockTarget !== undefined ? ` for ${lockTarget}` : ""}`
        break
      case "check":
        if (lockTarget === undefined) {
          return {
            output: "Action 'check' requires a lockTarget.",
            metadata: { success: false },
          }
        }
        command = `mechanic key-item check ${lockTarget}`
        description = `Check lock status of '${lockTarget}'`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      keyName,
      lockTarget,
      keyType,
    })

    if (!result.success) {
      return {
        output: `Key item command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        keyName,
        lockTarget,
        keyType,
      },
    }
  },
})
