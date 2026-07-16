import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5SaveCloudTool = tool({
  description:
    "Manage UE5 cloud saves: upload, download, sync, list, delete, or resolve conflicts with cloud save services. Sends cloud save commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["upload", "download", "sync", "list", "delete", "conflict-resolve"])
      .describe("Cloud save action to perform"),
    slotName: z
      .string()
      .optional()
      .describe("Save slot name to upload, download, or delete from cloud (used with upload, download, delete)"),
    cloudService: z
      .enum(["steam", "epic", "custom"])
      .optional()
      .describe("Cloud save service to use (defaults to 'steam')"),
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

    const { action, slotName, cloudService } = args

    if (["upload", "download", "delete"].includes(action) && !slotName) {
      return {
        output: `Action '${action}' requires a slotName.`,
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "upload":
        command = `save cloud upload ${slotName} ${cloudService ?? "steam"}`
        description = `Uploading save '${slotName}' to ${cloudService ?? "steam"} cloud`
        break
      case "download":
        command = `save cloud download ${slotName} ${cloudService ?? "steam"}`
        description = `Downloading save '${slotName}' from ${cloudService ?? "steam"} cloud`
        break
      case "sync":
        command = `save cloud sync ${cloudService ?? "steam"}`
        description = `Syncing all saves with ${cloudService ?? "steam"} cloud`
        break
      case "list":
        command = `save cloud list ${cloudService ?? "steam"}`
        description = `Listing cloud saves on ${cloudService ?? "steam"}`
        break
      case "delete":
        command = `save cloud delete ${slotName} ${cloudService ?? "steam"}`
        description = `Deleting save '${slotName}' from ${cloudService ?? "steam"} cloud`
        break
      case "conflict-resolve":
        command = `save cloud conflict-resolve ${slotName ?? ""} ${cloudService ?? "steam"}`
        description = `Resolving cloud save conflicts${slotName ? ` for '${slotName}'` : ""}`
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
      cloudService,
    })

    if (!result.success) {
      return {
        output: `Cloud save command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        slotName,
        cloudService,
      },
    }
  },
})
