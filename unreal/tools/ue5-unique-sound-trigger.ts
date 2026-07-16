import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const SoundTriggerActionSchema = z.enum([
  "create",
  "remove",
  "set-sound",
  "set-trigger",
  "set-volume",
  "set-reverb",
  "set-doppler",
  "list",
])

const TriggerTypeSchema = z.enum(["proximity", "damage", "event", "heartbeat"])

export const ue5UniqueSoundTriggerTool = tool({
  description:
    "Manage UE5 unique sound trigger system. Create/remove sound triggers, assign sounds, configure triggers, adjust volume and reverb, enable Doppler effect, and list triggers. Uses the 'unique sound-trigger' console command.",
  args: {
    action: SoundTriggerActionSchema.describe("Sound trigger action to perform"),
    triggerName: z.string().optional().describe("Trigger name — required for create, remove, set-sound, set-trigger, set-volume, set-reverb, set-doppler"),
    soundPath: z.string().optional().describe("Sound asset path (e.g. '/Game/Audio/Heartbeat') — required for set-sound"),
    triggerType: TriggerTypeSchema.optional().describe("Trigger type (proximity/damage/event/heartbeat) — required for set-trigger"),
    volume: z.number().min(0).max(1).optional().describe("Volume level (0.0-1.0) — required for set-volume"),
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

    const { action, triggerName, soundPath, triggerType, volume } = args

    const needsName = ["create", "remove", "set-sound", "set-trigger", "set-volume", "set-reverb", "set-doppler"]
    if (needsName.includes(action) && !triggerName) {
      return {
        output: `Action '${action}' requires a triggerName parameter.`,
        metadata: { success: false },
      }
    }

    if (action === "set-sound" && !soundPath) {
      return {
        output: "Action 'set-sound' requires a soundPath parameter.",
        metadata: { success: false },
      }
    }

    if (action === "set-trigger" && !triggerType) {
      return {
        output: "Action 'set-trigger' requires a triggerType parameter (proximity/damage/event/heartbeat).",
        metadata: { success: false },
      }
    }

    if (action === "set-volume" && volume === undefined) {
      return {
        output: "Action 'set-volume' requires a volume parameter (0.0-1.0).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "create":
        command = `unique sound-trigger create ${triggerName}`
        description = `Created sound trigger '${triggerName}'`
        break

      case "remove":
        command = `unique sound-trigger remove ${triggerName}`
        description = `Removed sound trigger '${triggerName}'`
        break

      case "set-sound":
        command = `unique sound-trigger set-sound ${triggerName} ${soundPath}`
        description = `Set sound for trigger '${triggerName}' to '${soundPath}'`
        break

      case "set-trigger":
        command = `unique sound-trigger set-trigger ${triggerName} ${triggerType}`
        description = `Set trigger type for '${triggerName}' to ${triggerType}`
        break

      case "set-volume":
        command = `unique sound-trigger set-volume ${triggerName} ${volume}`
        description = `Set volume for trigger '${triggerName}' to ${volume}`
        break

      case "set-reverb":
        command = `unique sound-trigger set-reverb ${triggerName}`
        description = `Configured reverb for trigger '${triggerName}'`
        break

      case "set-doppler":
        command = `unique sound-trigger set-doppler ${triggerName}`
        description = `Toggled Doppler effect for trigger '${triggerName}'`
        break

      case "list":
        command = `unique sound-trigger list`
        description = "Listed all sound triggers"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      triggerName,
      soundPath,
      triggerType,
      volume,
    })

    if (!result.success) {
      return {
        output: `Sound trigger command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        triggerName,
        soundPath,
        triggerType,
        volume,
        rawResult: result.result,
      },
    }
  },
})
