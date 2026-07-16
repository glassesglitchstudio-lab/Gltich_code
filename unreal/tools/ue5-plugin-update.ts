import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5PluginUpdateTool = tool({
  description:
    "Manage UE5 plugin updates: check for updates, install updates, rollback to previous version, view changelog, get current version, and force-update. Sends plugin update commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["check", "update", "rollback", "changelog", "version", "force-update"])
      .describe("Update action to perform"),
    version: z
      .string()
      .optional()
      .describe("Target version for update/rollback actions (e.g. '1.2.3')"),
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

    const { action, version } = args

    let command: string
    let description: string

    switch (action) {
      case "check":
        command = `plugin update check`
        description = "Checking for plugin updates"
        break
      case "update":
        command = version
          ? `plugin update update ${version}`
          : `plugin update update`
        description = `Updating plugin${version ? ` to version ${version}` : " to latest"}`
        break
      case "rollback":
        if (!version) {
          return {
            output: "Action 'rollback' requires a version to roll back to.",
            metadata: { success: false },
          }
        }
        command = `plugin update rollback ${version}`
        description = `Rolling back plugin to version ${version}`
        break
      case "changelog":
        command = version
          ? `plugin update changelog ${version}`
          : `plugin update changelog`
        description = `Retrieved changelog${version ? ` for version ${version}` : ""}`
        break
      case "version":
        command = `plugin update version`
        description = "Retrieved current plugin version"
        break
      case "force-update":
        command = version
          ? `plugin update force-update ${version}`
          : `plugin update force-update`
        description = `Force updating plugin${version ? ` to version ${version}` : " to latest"}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      version,
    })

    if (!result.success) {
      return {
        output: `Plugin update command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        version,
      },
    }
  },
})
