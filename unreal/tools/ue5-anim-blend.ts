import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const AnimBlendActionSchema = z.enum([
  "set-weight",
  "add-layer",
  "remove-layer",
  "blendto",
  "reset",
])

export const ue5AnimBlendTool = tool({
  description:
    "Manage UE5 animation blending layers: set layer weights, add/remove blend layers, blend to a target animation, or reset all blend states. Sends 'anim blend' commands to the UE5 Editor.",
  args: {
    action: AnimBlendActionSchema.describe("Animation blend action to perform"),
    layerName: z
      .string()
      .optional()
      .describe("Name of the blend layer"),
    weight: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Blend weight value (0.0 to 1.0)"),
    target: z
      .string()
      .optional()
      .describe("Target actor or component (defaults to selected actor)"),
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

    const { action, layerName, weight, target } = args

    if (["set-weight", "add-layer"].includes(action) && !layerName) {
      return {
        output: `Action '${action}' requires a layerName parameter.`,
        metadata: { success: false },
      }
    }

    if (action === "set-weight" && weight === undefined) {
      return {
        output: "Action 'set-weight' requires a weight parameter (0.0-1.0).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "set-weight":
        command = `anim blend set-weight ${layerName} ${weight} ${target ?? "selected"}`
        description = `Set blend weight of layer '${layerName}' to ${weight} for ${target ?? "selected actor"}`
        break

      case "add-layer":
        command = `anim blend add-layer ${layerName} ${target ?? "selected"} ${weight ?? 1.0}`
        description = `Added blend layer '${layerName}' with weight ${weight ?? 1.0} for ${target ?? "selected actor"}`
        break

      case "remove-layer":
        if (!layerName) {
          return {
            output: "Action 'remove-layer' requires a layerName parameter.",
            metadata: { success: false },
          }
        }
        command = `anim blend remove-layer ${layerName} ${target ?? "selected"}`
        description = `Removed blend layer '${layerName}' from ${target ?? "selected actor"}`
        break

      case "blendto":
        if (!layerName) {
          return {
            output: "Action 'blendto' requires a layerName parameter.",
            metadata: { success: false },
          }
        }
        command = `anim blend blendto ${layerName} ${target ?? "selected"} ${weight ?? 0.25}`
        description = `Blending to animation '${layerName}' over ${weight ?? 0.25}s for ${target ?? "selected actor"}`
        break

      case "reset":
        command = `anim blend reset ${target ?? "selected"}`
        description = `Reset all blend layers for ${target ?? "selected actor"}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      layerName,
      weight,
      target,
    })

    if (!result.success) {
      return {
        output: `Animation blend command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        layerName,
        weight,
        target,
        rawResult: result.result,
      },
    }
  },
})
