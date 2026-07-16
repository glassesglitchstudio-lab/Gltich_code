import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const CameraShakeActionSchema = z.enum([
  "trigger",
  "set-intensity",
  "set-frequency",
  "stop",
  "preset",
])

const ShakeTypeSchema = z.enum(["earthquake", "explosion", "hit", "drip", "subtle"])

export const ue5CameraShakeTool = tool({
  description:
    "Control UE5 camera shake effects. Trigger shake with presets (earthquake/explosion/hit/drip/subtle), adjust intensity/frequency, or stop active shake. Uses the 'camera shake' console command.",
  args: {
    action: CameraShakeActionSchema.describe("Camera shake action to perform"),
    shakeType: ShakeTypeSchema.optional().describe("Shake preset type (earthquake/explosion/hit/drip/subtle) — required for trigger and preset"),
    intensity: z.number().min(0).max(10).optional().describe("Shake intensity multiplier (0-10, default 1.0)"),
    duration: z.number().min(0).optional().describe("Shake duration in seconds (0 = indefinite until stopped)"),
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

    const { action, shakeType, intensity, duration } = args

    if (action === "trigger" && !shakeType) {
      return {
        output: "Action 'trigger' requires a shakeType parameter (earthquake/explosion/hit/drip/subtle).",
        metadata: { success: false },
      }
    }

    if (action === "preset" && !shakeType) {
      return {
        output: "Action 'preset' requires a shakeType parameter (earthquake/explosion/hit/drip/subtle).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "trigger":
        command = `camera shake trigger type=${shakeType}`
        if (intensity !== undefined) command += ` intensity=${intensity}`
        if (duration !== undefined) command += ` duration=${duration}`
        description = `Triggered ${shakeType} camera shake`
        if (intensity !== undefined) description += ` at intensity ${intensity}`
        if (duration !== undefined) description += ` for ${duration}s`
        break

      case "set-intensity":
        if (intensity === undefined) {
          return {
            output: "Action 'set-intensity' requires an intensity parameter (0-10).",
            metadata: { success: false },
          }
        }
        command = `camera shake intensity=${intensity}`
        description = `Set camera shake intensity to ${intensity}`
        break

      case "set-frequency":
        if (intensity === undefined) {
          return {
            output: "Action 'set-frequency' requires an intensity parameter to set the frequency multiplier.",
            metadata: { success: false },
          }
        }
        command = `camera shake frequency=${intensity}`
        description = `Set camera shake frequency to ${intensity}`
        break

      case "stop":
        command = "camera shake stop"
        description = "Stopped active camera shake"
        break

      case "preset":
        command = `camera shake preset type=${shakeType}`
        if (intensity !== undefined) command += ` intensity=${intensity}`
        description = `Applied ${shakeType} camera shake preset`
        if (intensity !== undefined) description += ` at intensity ${intensity}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, { action, shakeType, intensity, duration })

    if (!result.success) {
      return {
        output: `Camera shake command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        shakeType,
        intensity,
        duration,
        rawResult: result.result,
      },
    }
  },
})
