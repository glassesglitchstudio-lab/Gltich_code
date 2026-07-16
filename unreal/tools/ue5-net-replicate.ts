import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5NetReplicateTool = tool({
  description:
    "Manage UE5 network replication: enable/disable replication on actors, set replication rates and priorities, and invoke RPCs. Sends net replicate commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["enable", "disable", "set-rate", "set-priority", "rpc-call", "rpc-reliable", "status"])
      .describe("Network replication action to perform"),
    actorName: z
      .string()
      .optional()
      .describe("Target actor name for replication (defaults to selected actor)"),
    property: z
      .string()
      .optional()
      .describe("Property name for set-rate and set-priority actions"),
    rate: z
      .number()
      .optional()
      .describe("Replication rate in seconds or priority value"),
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

    const { action, actorName, property, rate } = args

    let command: string
    let description: string

    switch (action) {
      case "enable":
        command = `net replicate enable ${actorName ?? "selected"}`
        description = `Enabled replication for ${actorName ?? "selected actor"}`
        break
      case "disable":
        command = `net replicate disable ${actorName ?? "selected"}`
        description = `Disabled replication for ${actorName ?? "selected actor"}`
        break
      case "set-rate":
        if (!property || rate === undefined) {
          return {
            output: "Action 'set-rate' requires both property and rate arguments.",
            metadata: { success: false },
          }
        }
        command = `net replicate set-rate ${actorName ?? "selected"} ${property} ${rate}`
        description = `Set replication rate of ${property} to ${rate}s for ${actorName ?? "selected actor"}`
        break
      case "set-priority":
        if (rate === undefined) {
          return {
            output: "Action 'set-priority' requires a rate (priority value).",
            metadata: { success: false },
          }
        }
        command = `net replicate set-priority ${actorName ?? "selected"} ${rate}`
        description = `Set replication priority to ${rate} for ${actorName ?? "selected actor"}`
        break
      case "rpc-call":
        if (!property) {
          return {
            output: "Action 'rpc-call' requires a property (RPC function name).",
            metadata: { success: false },
          }
        }
        command = `net replicate rpc-call ${actorName ?? "selected"} ${property}`
        description = `Called unreliable RPC '${property}' on ${actorName ?? "selected actor"}`
        break
      case "rpc-reliable":
        if (!property) {
          return {
            output: "Action 'rpc-reliable' requires a property (RPC function name).",
            metadata: { success: false },
          }
        }
        command = `net replicate rpc-reliable ${actorName ?? "selected"} ${property}`
        description = `Called reliable RPC '${property}' on ${actorName ?? "selected actor"}`
        break
      case "status":
        command = `net replicate status ${actorName ?? "selected"}`
        description = `Retrieved replication status for ${actorName ?? "selected actor"}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      actorName,
      property,
      rate,
    })

    if (!result.success) {
      return {
        output: `Net replicate command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        actorName,
        property,
        rate,
      },
    }
  },
})
