import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const AnimIKActionSchema = z.enum([
  "set-target",
  "clear-target",
  "enable-limb",
  "disable-limb",
  "look-at",
  "aim-at",
])

const LimbSchema = z.enum([
  "left-hand",
  "right-hand",
  "left-foot",
  "right-foot",
  "head",
])

export const ue5AnimIKTool = tool({
  description:
    "Manage UE5 inverse kinematics (IK): set/clear IK targets for limbs, enable/disable IK on specific limbs, or set look-at/aim-at bone targets. Sends 'anim ik' commands to the UE5 Editor.",
  args: {
    action: AnimIKActionSchema.describe("IK action to perform"),
    limb: LimbSchema.optional().describe(
      "Target limb: left-hand, right-hand, left-foot, right-foot, or head"
    ),
    target: z
      .string()
      .optional()
      .describe("Target actor name (defaults to selected actor)"),
    location: z
      .string()
      .optional()
      .describe("World location vector for IK target (e.g., '100,200,50')"),
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

    const { action, limb, target, location } = args

    if (["set-target", "enable-limb", "disable-limb"].includes(action) && !limb) {
      return {
        output: `Action '${action}' requires a limb parameter.`,
        metadata: { success: false },
      }
    }

    if (action === "set-target" && !location) {
      return {
        output: "Action 'set-target' requires a location parameter.",
        metadata: { success: false },
      }
    }

    if (["look-at", "aim-at"].includes(action) && !location) {
      return {
        output: `Action '${action}' requires a location parameter for the target point.`,
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "set-target":
        command = `anim ik set-target ${limb} ${location} ${target ?? "selected"}`
        description = `Set IK target for ${limb} at ${location} on ${target ?? "selected actor"}`
        break

      case "clear-target":
        if (!limb) {
          return {
            output: "Action 'clear-target' requires a limb parameter.",
            metadata: { success: false },
          }
        }
        command = `anim ik clear-target ${limb} ${target ?? "selected"}`
        description = `Cleared IK target for ${limb} on ${target ?? "selected actor"}`
        break

      case "enable-limb":
        command = `anim ik enable-limb ${limb} ${target ?? "selected"}`
        description = `Enabled IK for ${limb} on ${target ?? "selected actor"}`
        break

      case "disable-limb":
        command = `anim ik disable-limb ${limb} ${target ?? "selected"}`
        description = `Disabled IK for ${limb} on ${target ?? "selected actor"}`
        break

      case "look-at":
        command = `anim ik look-at ${location} ${target ?? "selected"}`
        description = `Set look-at IK target to ${location} on ${target ?? "selected actor"}`
        break

      case "aim-at":
        command = `anim ik aim-at ${location} ${target ?? "selected"}`
        description = `Set aim-at IK target to ${location} on ${target ?? "selected actor"}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      limb,
      target,
      location,
    })

    if (!result.success) {
      return {
        output: `IK command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        limb,
        target,
        location,
        rawResult: result.result,
      },
    }
  },
})
