import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5PluginRecoveryTool = tool({
  description:
    "Manage UE5 plugin state recovery: create checkpoints, restore state, auto-save, diff between states, merge changes, and validate state integrity. Sends plugin recovery commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["checkpoint", "restore", "auto-save-state", "diff", "merge", "validate-state"])
      .describe("Recovery action to perform"),
    checkpointName: z
      .string()
      .optional()
      .describe("Checkpoint name for checkpoint/restore actions"),
    stateData: z
      .string()
      .optional()
      .describe("JSON state data for merge action"),
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

    const { action, checkpointName, stateData } = args

    let command: string
    let description: string

    switch (action) {
      case "checkpoint":
        command = checkpointName
          ? `plugin recovery checkpoint ${checkpointName}`
          : `plugin recovery checkpoint`
        description = `Created checkpoint${checkpointName ? ` '${checkpointName}'` : ""}`
        break
      case "restore":
        if (!checkpointName) {
          return {
            output: "Action 'restore' requires a checkpointName.",
            metadata: { success: false },
          }
        }
        command = `plugin recovery restore ${checkpointName}`
        description = `Restored state from checkpoint '${checkpointName}'`
        break
      case "auto-save-state":
        command = `plugin recovery auto-save-state`
        description = "Triggered auto-save of current state"
        break
      case "diff":
        command = checkpointName
          ? `plugin recovery diff ${checkpointName}`
          : `plugin recovery diff`
        description = `Computed diff${checkpointName ? ` for checkpoint '${checkpointName}'` : " between current and last checkpoint"}`
        break
      case "merge":
        if (!stateData) {
          return {
            output: "Action 'merge' requires stateData (JSON string).",
            metadata: { success: false },
          }
        }
        command = `plugin recovery merge ${stateData}`
        description = "Merged state data"
        break
      case "validate-state":
        command = `plugin recovery validate-state`
        description = "Validated current plugin state integrity"
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      checkpointName,
      stateData,
    })

    if (!result.success) {
      return {
        output: `Plugin recovery command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        checkpointName,
        stateData,
      },
    }
  },
})
