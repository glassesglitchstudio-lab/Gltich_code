import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const AnimStateActionSchema = z.enum([
  "set",
  "get",
  "blend",
  "transition",
  "add-state",
  "remove-state",
  "list",
])

export const ue5AnimStateTool = tool({
  description:
    "Manage UE5 animation state machine: set/get current state, blend between states, transition with conditions, add or remove states, and list all available states. Sends 'anim state' commands to the UE5 Editor.",
  args: {
    action: AnimStateActionSchema.describe("Animation state action to perform"),
    stateName: z
      .string()
      .optional()
      .describe("Name of the animation state"),
    target: z
      .string()
      .optional()
      .describe("Target actor or component (defaults to selected actor)"),
    blendTime: z
      .number()
      .optional()
      .describe("Blend time in seconds for transition/blend operations"),
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

    const { action, stateName, target, blendTime } = args

    if (["set", "add-state", "transition"].includes(action) && !stateName) {
      return {
        output: `Action '${action}' requires a stateName parameter.`,
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "set":
        command = `anim state set ${stateName} ${target ?? "selected"}`
        description = `Set animation state to '${stateName}' for ${target ?? "selected actor"}`
        break

      case "get":
        command = `anim state get ${target ?? "selected"}`
        description = `Retrieved current animation state for ${target ?? "selected actor"}`
        break

      case "blend":
        if (!stateName) {
          return {
            output: "Action 'blend' requires a stateName parameter.",
            metadata: { success: false },
          }
        }
        command = `anim state blend ${stateName} ${target ?? "selected"} ${blendTime ?? 0.25}`
        description = `Blending to state '${stateName}' over ${blendTime ?? 0.25}s for ${target ?? "selected actor"}`
        break

      case "transition":
        command = `anim state transition ${stateName} ${target ?? "selected"} ${blendTime ?? 0.25}`
        description = `Transitioning to state '${stateName}' over ${blendTime ?? 0.25}s`
        break

      case "add-state":
        command = `anim state add-state ${stateName} ${target ?? "selected"}`
        description = `Added animation state '${stateName}' for ${target ?? "selected actor"}`
        break

      case "remove-state":
        if (!stateName) {
          return {
            output: "Action 'remove-state' requires a stateName parameter.",
            metadata: { success: false },
          }
        }
        command = `anim state remove-state ${stateName} ${target ?? "selected"}`
        description = `Removed animation state '${stateName}' from ${target ?? "selected actor"}`
        break

      case "list":
        command = `anim state list ${target ?? "selected"}`
        description = `Listed animation states for ${target ?? "selected actor"}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      stateName,
      target,
      blendTime,
    })

    if (!result.success) {
      return {
        output: `Animation state command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        stateName,
        target,
        blendTime,
        rawResult: result.result,
      },
    }
  },
})
