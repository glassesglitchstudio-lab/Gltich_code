import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const JumpScareActionSchema = z.enum([
  "trigger",
  "config",
  "status",
  "cooldown",
])

const ScareTypeSchema = z.enum(["Audio", "Visual", "Physical", "Full"])

export const ue5JumpScareTool = tool({
  description:
    "Manage UE5 jump scare system. Trigger jump scares with different types (Audio, Visual, Physical, Full), configure scare parameters, check status, or set cooldown. Uses the 'jumpscare' console command.",
  args: {
    action: JumpScareActionSchema.describe("Jump scare action to perform"),
    scareType: ScareTypeSchema.optional().describe("Type of scare (Audio/Visual/Physical/Full) — required for trigger/config"),
    intensity: z.number().min(0).max(10).default(1.0).describe("Scare intensity multiplier (0-10, default: 1.0)"),
    location: z.string().optional().describe("World location as 'X,Y,Z' for scare origin"),
    cooldown: z.number().min(0).optional().describe("Cooldown between scares in seconds"),
    soundPath: z.string().optional().describe("Sound asset path for scare config"),
    duration: z.number().min(0).optional().describe("Scare duration in seconds for config"),
    cameraShake: z.string().optional().describe("Camera shake class path for config"),
    enabled: z.boolean().optional().describe("Enable/disable jump scare system"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return {
        output: "UE5 Editor is not connected. Make sure the editor is running with the Glitch Code plugin enabled.",
        metadata: { success: false },
      }
    }

    const { action, scareType, intensity, location, cooldown, soundPath, duration, cameraShake, enabled } = args

    let command: string
    let description: string

    switch (action) {
      case "trigger":
        if (!scareType) {
          return {
            output: "Action 'trigger' requires a scareType parameter (Audio/Visual/Physical/Full).",
            metadata: { success: false },
          }
        }
        command = `jumpscare trigger ${scareType} ${intensity}`
        if (location) command += ` ${location}`
        description = `Triggered ${scareType} jump scare (intensity: ${intensity})`
        break

      case "config":
        if (!scareType) {
          return {
            output: "Action 'config' requires a scareType parameter (Audio/Visual/Physical/Full).",
            metadata: { success: false },
          }
        }
        command = `jumpscare config ${scareType}`
        if (soundPath) command += ` sound=${soundPath}`
        if (duration !== undefined) command += ` duration=${duration}`
        if (cameraShake) command += ` shake=${cameraShake}`
        if (intensity) command += ` intensity=${intensity}`
        description = `Configured ${scareType} scare settings`
        break

      case "status":
        command = `jumpscare status`
        description = "Retrieved jump scare system status"
        break

      case "cooldown":
        if (cooldown === undefined && enabled === undefined) {
          return {
            output: "Action 'cooldown' requires either cooldown or enabled parameter.",
            metadata: { success: false },
          }
        }
        command = `jumpscare cooldown`
        if (cooldown !== undefined) command += ` ${cooldown}`
        if (enabled !== undefined) command += ` enabled=${enabled}`
        description = "Updated jump scare cooldown settings"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      scareType,
      intensity,
      location,
      cooldown,
      soundPath,
      duration,
      cameraShake,
      enabled,
    })

    if (!result.success) {
      return {
        output: `Jump scare command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        scareType,
        intensity,
        location,
        cooldown,
        rawResult: result.result,
      },
    }
  },
})
