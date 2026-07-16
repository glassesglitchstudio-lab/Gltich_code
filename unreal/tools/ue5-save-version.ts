import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5SaveVersionTool = tool({
  description:
    "Manage UE5 save versioning: migrate saves between versions, check compatibility, list versions, rollback to previous versions, or export/import versioned saves. Sends version commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["migrate", "check", "list-versions", "rollback", "export", "import"])
      .describe("Save version action to perform"),
    slotName: z
      .string()
      .optional()
      .describe("Save slot name to version or migrate (used with all actions except 'list-versions')"),
    fromVersion: z
      .string()
      .optional()
      .describe("Source version for migration or rollback (e.g. '1.0.0')"),
    toVersion: z
      .string()
      .optional()
      .describe("Target version for migration (e.g. '2.0.0')"),
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

    const { action, slotName, fromVersion, toVersion } = args

    if (action !== "list-versions" && !slotName) {
      return {
        output: `Action '${action}' requires a slotName.`,
        metadata: { success: false },
      }
    }

    if (action === "migrate" && (!fromVersion || !toVersion)) {
      return {
        output: "Action 'migrate' requires both fromVersion and toVersion.",
        metadata: { success: false },
      }
    }

    if (action === "rollback" && !fromVersion) {
      return {
        output: "Action 'rollback' requires a fromVersion to roll back to.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "migrate":
        command = `save version migrate ${slotName} ${fromVersion} ${toVersion}`
        description = `Migrating save '${slotName}' from v${fromVersion} to v${toVersion}`
        break
      case "check":
        command = `save version check ${slotName}`
        description = `Checking version compatibility for save '${slotName}'`
        break
      case "list-versions":
        command = `save version list-versions ${slotName ?? ""}`
        description = `Listing available versions${slotName ? ` for save '${slotName}'` : ""}`
        break
      case "rollback":
        command = `save version rollback ${slotName} ${fromVersion}`
        description = `Rolling back save '${slotName}' to v${fromVersion}`
        break
      case "export":
        command = `save version export ${slotName} ${fromVersion ?? ""}`
        description = `Exporting versioned save '${slotName}'${fromVersion ? ` at v${fromVersion}` : ""}`
        break
      case "import":
        command = `save version import ${slotName} ${toVersion ?? ""}`
        description = `Importing versioned save '${slotName}'${toVersion ? ` as v${toVersion}` : ""}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      slotName,
      fromVersion,
      toVersion,
    })

    if (!result.success) {
      return {
        output: `Save version command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        slotName,
        fromVersion,
        toVersion,
      },
    }
  },
})
