import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const LocationSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
})

export const ue5AmbientSoundTool = tool({
  description:
    "Manage UE5 ambient sound system: play/stop ambient sounds, set volume, configure reverb, manage sound zones, and transition between presets. Sends ambient sound commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum([
        "play",
        "stop",
        "stop-all",
        "volume",
        "reverb",
        "zone",
        "remove-zone",
        "transition",
        "preset",
        "status",
      ])
      .describe("Ambient sound action to perform"),
    soundPath: z
      .string()
      .optional()
      .describe("Sound asset path (e.g. '/Game/Ambient/Forest/Birds')"),
    location: LocationSchema.default({ x: 0, y: 0, z: 0 }).describe(
      "World location for sound playback"
    ),
    soundID: z
      .number()
      .int()
      .optional()
      .describe("Sound ID for stop operations"),
    params: z
      .object({
        volume: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Volume level (0.0-1.0)"),
        fadeIn: z
          .number()
          .min(0)
          .optional()
          .describe("Fade in duration in seconds"),
        fadeOut: z
          .number()
          .min(0)
          .optional()
          .describe("Fade out duration in seconds"),
        density: z.number().min(0).max(1).optional().describe("Reverb density"),
        diffusion: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Reverb diffusion"),
        gain: z.number().min(0).max(1).optional().describe("Reverb gain"),
        zoneRadius: z
          .number()
          .positive()
          .optional()
          .describe("Sound zone radius"),
        preset: z
          .enum(["Forest", "Indoor", "Horror", "Industrial", "Underwater"])
          .optional()
          .describe("Ambient preset name"),
        duration: z
          .number()
          .min(0)
          .optional()
          .describe("Transition duration in seconds"),
      })
      .optional()
      .describe("Additional parameters"),
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

    const { action, soundPath, location, soundID, params } = args
    const p = params ?? {}

    let command: string
    let description: string

    switch (action) {
      case "play": {
        if (!soundPath) {
          return {
            output: "Action 'play' requires a soundPath.",
            metadata: { success: false },
          }
        }
        const { x, y, z } = location
        const vol = p.volume ?? 1.0
        const fadeIn = p.fadeIn ?? 1.0
        command = `ambient-sound play ${soundPath} ${x},${y},${z} ${vol} ${fadeIn}`
        description = `Playing ambient sound '${soundPath}' at (${x}, ${y}, ${z})`
        break
      }
      case "stop": {
        if (soundID === undefined) {
          return {
            output: "Action 'stop' requires a soundID.",
            metadata: { success: false },
          }
        }
        const fadeOut = p.fadeOut ?? 1.0
        command = `ambient-sound stop ${soundID} ${fadeOut}`
        description = `Stopping ambient sound ID ${soundID}`
        break
      }
      case "stop-all": {
        const fadeOut = p.fadeOut ?? 1.0
        command = `ambient-sound stop-all ${fadeOut}`
        description = "Stopping all ambient sounds"
        break
      }
      case "volume": {
        const vol = p.volume
        if (vol === undefined) {
          return {
            output: "Action 'volume' requires params.volume (0.0-1.0).",
            metadata: { success: false },
          }
        }
        command = `ambient-sound volume ${vol}`
        description = `Setting global volume to ${vol}`
        break
      }
      case "reverb": {
        const density = p.density ?? 1.0
        const diffusion = p.diffusion ?? 1.0
        const gain = p.gain ?? 0.5
        command = `ambient-sound reverb ${density} ${diffusion} ${gain}`
        description = `Setting reverb (density: ${density}, diffusion: ${diffusion}, gain: ${gain})`
        break
      }
      case "zone": {
        if (!soundPath) {
          return {
            output: "Action 'zone' requires a soundPath for the zone's ambient sound.",
            metadata: { success: false },
          }
        }
        const { x, y, z } = location
        const zoneRadius = p.zoneRadius ?? 1000
        command = `ambient-sound zone ${x},${y},${z} ${zoneRadius} ${soundPath}`
        description = `Added sound zone at (${x}, ${y}, ${z}) with radius ${zoneRadius}`
        break
      }
      case "remove-zone": {
        if (soundID === undefined) {
          return {
            output: "Action 'remove-zone' requires a soundID (zone ID).",
            metadata: { success: false },
          }
        }
        command = `ambient-sound remove-zone ${soundID}`
        description = `Removing sound zone ID ${soundID}`
        break
      }
      case "transition": {
        if (!soundPath || !p.preset) {
          return {
            output: "Action 'transition' requires soundPath (from) and params.preset (to).",
            metadata: { success: false },
          }
        }
        const duration = p.duration ?? 2.0
        command = `ambient-sound transition ${soundPath} ${p.preset} ${duration}`
        description = `Transitioning from '${soundPath}' to preset '${p.preset}' over ${duration}s`
        break
      }
      case "preset": {
        if (!p.preset) {
          return {
            output: "Action 'preset' requires params.preset (Forest/Indoor/Horror/Industrial/Underwater).",
            metadata: { success: false },
          }
        }
        command = `ambient-sound preset ${p.preset}`
        description = `Applying ambient preset '${p.preset}'`
        break
      }
      case "status":
        command = `ambient-sound status`
        description = "Getting ambient sound system status"
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      soundPath,
      location,
      soundID,
      params,
    })

    if (!result.success) {
      return {
        output: `Ambient sound command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        soundPath,
        soundID,
      },
    }
  },
})
