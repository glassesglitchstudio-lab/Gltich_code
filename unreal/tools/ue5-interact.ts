import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5InteractTool = tool({
  description:
    "Manage UE5 interaction system: activate, deactivate, grab, release, examine, and use objects. Sends interaction commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["activate", "deactivate", "grab", "release", "examine", "use"])
      .describe("Interaction action to perform"),
    target: z
      .string()
      .optional()
      .describe("Target actor name (defaults to selected actor)"),
    interactionType: z
      .enum(["pickup", "examine", "activate", "dialogue"])
      .optional()
      .describe("Type of interaction to perform"),
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

    const { action, target, interactionType } = args

    let command: string
    let description: string

    switch (action) {
      case "activate":
        command = `mechanic interact activate ${target ?? "selected"} ${interactionType ?? ""}`.trim()
        description = `Activate interaction${interactionType !== undefined ? ` (${interactionType})` : ""} on ${target ?? "selected actor"}`
        break
      case "deactivate":
        command = `mechanic interact deactivate ${target ?? "selected"}`
        description = `Deactivate interaction on ${target ?? "selected actor"}`
        break
      case "grab":
        command = `mechanic interact grab ${target ?? "selected"}`
        description = `Grab ${target ?? "selected actor"}`
        break
      case "release":
        command = `mechanic interact release ${target ?? "selected"}`
        description = `Release ${target ?? "selected actor"}`
        break
      case "examine":
        command = `mechanic interact examine ${target ?? "selected"}`
        description = `Examine ${target ?? "selected actor"}`
        break
      case "use":
        if (interactionType === undefined) {
          return {
            output: "Action 'use' requires an interactionType (pickup/examine/activate/dialogue).",
            metadata: { success: false },
          }
        }
        command = `mechanic interact use ${target ?? "selected"} ${interactionType}`
        description = `Use ${interactionType} interaction on ${target ?? "selected actor"}`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      target,
      interactionType,
    })

    if (!result.success) {
      return {
        output: `Interaction command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        target,
        interactionType,
      },
    }
  },
})
