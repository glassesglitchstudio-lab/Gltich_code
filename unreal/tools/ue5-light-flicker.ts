import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const LightFlickerActionSchema = z.enum([
  "start",
  "stop",
  "pattern",
  "intensity",
  "frequency",
  "randomness",
  "status",
])

const FlickerPatternSchema = z.enum(["Constant", "Random", "Rhythm", "Broken", "Ghostly"])

export const ue5LightFlickerTool = tool({
  description:
    "Manage UE5 light flicker component. Start/stop flickering, set patterns (Constant/Random/Rhythm/Broken/Ghostly), adjust intensity, frequency, and randomness. Uses the 'light flicker' console command.",
  args: {
    action: LightFlickerActionSchema.describe("Light flicker action to perform"),
    actorName: z.string().optional().describe("Name of the light actor to control"),
    pattern: FlickerPatternSchema.optional().describe("Flicker pattern (Constant/Random/Rhythm/Broken/Ghostly)"),
    intensity: z.number().min(0).max(10).optional().describe("Light intensity (0-10)"),
    frequency: z.number().min(0.1).max(10).optional().describe("Flicker frequency (0.1-10 Hz)"),
    randomness: z.number().min(0).max(1).optional().describe("Randomness factor (0-1)"),
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

    const { action, actorName, pattern, intensity, frequency, randomness } = args

    // Validate required args per action
    if (["pattern", "intensity", "frequency", "randomness", "start", "stop"].includes(action) && !actorName) {
      return {
        output: `Action '${action}' requires an actorName parameter.`,
        metadata: { success: false },
      }
    }

    if (action === "pattern" && !pattern) {
      return {
        output: "Action 'pattern' requires a pattern parameter (Constant/Random/Rhythm/Broken/Ghostly).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "start":
        command = `light flicker start ${actorName}`
        description = `Started flickering on ${actorName}`
        break

      case "stop":
        command = `light flicker stop ${actorName}`
        description = `Stopped flickering on ${actorName}`
        break

      case "pattern":
        command = `light flicker pattern ${actorName} ${pattern}`
        description = `Set ${actorName} flicker pattern to ${pattern}`
        break

      case "intensity":
        command = `light flicker intensity ${actorName} ${intensity}`
        description = `Set ${actorName} intensity to ${intensity}`
        break

      case "frequency":
        command = `light flicker frequency ${actorName} ${frequency}`
        description = `Set ${actorName} frequency to ${frequency} Hz`
        break

      case "randomness":
        command = `light flicker randomness ${actorName} ${randomness}`
        description = `Set ${actorName} randomness to ${randomness}`
        break

      case "status":
        command = `light flicker status ${actorName ?? ""}`
        description = "Retrieved light flicker status"
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
      pattern,
      intensity,
      frequency,
      randomness,
    })

    if (!result.success) {
      return {
        output: `Light flicker command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        actorName,
        pattern,
        intensity,
        frequency,
        randomness,
        rawResult: result.result,
      },
    }
  },
})
