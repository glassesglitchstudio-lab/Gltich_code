import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const AnimRagdollActionSchema = z.enum([
  "activate",
  "deactivate",
  "set-weight",
  "blend",
  "impulse",
  "set-collision",
])

export const ue5AnimRagdollTool = tool({
  description:
    "Manage UE5 ragdoll physics: activate/deactivate ragdoll, set ragdoll weight, blend between animation and physics, apply impulse forces, or configure collision. Sends 'anim ragdoll' commands to the UE5 Editor.",
  args: {
    action: AnimRagdollActionSchema.describe(
      "Ragdoll action to perform"
    ),
    target: z
      .string()
      .optional()
      .describe("Target actor (defaults to selected actor)"),
    force: z
      .number()
      .optional()
      .describe("Force magnitude for impulse or weight value for set-weight/blend"),
    direction: z
      .string()
      .optional()
      .describe("Direction vector for impulse (e.g., '0,0,1' for upward)"),
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

    const { action, target, force, direction } = args

    if (["set-weight", "blend"].includes(action) && force === undefined) {
      return {
        output: `Action '${action}' requires a force/weight parameter.`,
        metadata: { success: false },
      }
    }

    if (action === "impulse" && force === undefined) {
      return {
        output: "Action 'impulse' requires a force parameter for magnitude.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "activate":
        command = `anim ragdoll activate ${target ?? "selected"}`
        description = `Activated ragdoll for ${target ?? "selected actor"}`
        break

      case "deactivate":
        command = `anim ragdoll deactivate ${target ?? "selected"}`
        description = `Deactivated ragdoll for ${target ?? "selected actor"}`
        break

      case "set-weight":
        command = `anim ragdoll set-weight ${target ?? "selected"} ${force}`
        description = `Set ragdoll weight to ${force} for ${target ?? "selected actor"}`
        break

      case "blend":
        command = `anim ragdoll blend ${target ?? "selected"} ${force} ${direction ?? "0,0,1"}`
        description = `Blending ragdoll at weight ${force} with direction ${direction ?? "0,0,1"} for ${target ?? "selected actor"}`
        break

      case "impulse":
        command = `anim ragdoll impulse ${target ?? "selected"} ${force} ${direction ?? "0,0,1"}`
        description = `Applied impulse of ${force}N in direction ${direction ?? "0,0,1"} to ${target ?? "selected actor"}`
        break

      case "set-collision":
        if (!direction) {
          return {
            output: "Action 'set-collision' requires a direction parameter for collision profile (e.g., 'ragdoll', 'physics', 'none').",
            metadata: { success: false },
          }
        }
        command = `anim ragdoll set-collision ${target ?? "selected"} ${direction}`
        description = `Set ragdoll collision to '${direction}' for ${target ?? "selected actor"}`
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
      force,
      direction,
    })

    if (!result.success) {
      return {
        output: `Ragdoll command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        target,
        force,
        direction,
        rawResult: result.result,
      },
    }
  },
})
