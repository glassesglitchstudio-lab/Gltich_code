import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const AnimLocomotionActionSchema = z.enum([
  "set-speed",
  "set-direction",
  "strafe",
  "crouch",
  "prone",
  "jump",
  "land",
])

export const ue5AnimLocomotionTool = tool({
  description:
    "Control UE5 character locomotion: set movement speed/direction, strafe, crouch, prone, jump, or trigger landing. Sends 'anim locomotion' commands to the UE5 Editor.",
  args: {
    action: AnimLocomotionActionSchema.describe(
      "Locomotion action to perform"
    ),
    speed: z
      .number()
      .min(0)
      .optional()
      .describe("Movement speed value"),
    direction: z
      .number()
      .min(0)
      .max(360)
      .optional()
      .describe("Movement direction in degrees (0-360)"),
    target: z
      .string()
      .optional()
      .describe("Target character actor (defaults to selected actor)"),
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

    const { action, speed, direction, target } = args

    if (action === "set-speed" && speed === undefined) {
      return {
        output: "Action 'set-speed' requires a speed parameter.",
        metadata: { success: false },
      }
    }

    if (action === "set-direction" && direction === undefined) {
      return {
        output: "Action 'set-direction' requires a direction parameter (0-360 degrees).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "set-speed":
        command = `anim locomotion set-speed ${speed} ${target ?? "selected"}`
        description = `Set locomotion speed to ${speed} for ${target ?? "selected actor"}`
        break

      case "set-direction":
        command = `anim locomotion set-direction ${direction} ${target ?? "selected"}`
        description = `Set locomotion direction to ${direction}° for ${target ?? "selected actor"}`
        break

      case "strafe":
        command = `anim locomotion strafe ${direction ?? 0} ${target ?? "selected"}`
        description = `Strafing at ${direction ?? 0}° for ${target ?? "selected actor"}`
        break

      case "crouch":
        command = `anim locomotion crouch ${target ?? "selected"} ${speed ?? 1.0}`
        description = `Toggled crouch for ${target ?? "selected actor"} at ${speed ?? 1.0}x speed`
        break

      case "prone":
        command = `anim locomotion prone ${target ?? "selected"} ${speed ?? 1.0}`
        description = `Toggled prone for ${target ?? "selected actor"} at ${speed ?? 1.0}x speed`
        break

      case "jump":
        command = `anim locomotion jump ${target ?? "selected"} ${speed ?? 1.0}`
        description = `Triggered jump for ${target ?? "selected actor"} at ${speed ?? 1.0}x force`
        break

      case "land":
        command = `anim locomotion land ${target ?? "selected"}`
        description = `Triggered landing animation for ${target ?? "selected actor"}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      speed,
      direction,
      target,
    })

    if (!result.success) {
      return {
        output: `Locomotion command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        speed,
        direction,
        target,
        rawResult: result.result,
      },
    }
  },
})
