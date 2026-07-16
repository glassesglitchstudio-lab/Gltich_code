import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const AnimMontageActionSchema = z.enum([
  "play",
  "stop",
  "pause",
  "resume",
  "set-section",
  "jump-to",
])

export const ue5AnimMontageTool = tool({
  description:
    "Control UE5 animation montages: play, stop, pause, resume, set playback section, or jump to a specific section. Sends 'anim montage' commands to the UE5 Editor.",
  args: {
    action: AnimMontageActionSchema.describe("Montage action to perform"),
    montageName: z
      .string()
      .optional()
      .describe("Name of the animation montage asset"),
    section: z
      .string()
      .optional()
      .describe("Montage section name for set-section or jump-to"),
    target: z
      .string()
      .optional()
      .describe("Target actor (defaults to selected actor)"),
    speed: z
      .number()
      .optional()
      .describe("Playback speed multiplier (1.0 = normal)"),
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

    const { action, montageName, section, target, speed } = args

    if (action === "play" && !montageName) {
      return {
        output: "Action 'play' requires a montageName parameter.",
        metadata: { success: false },
      }
    }

    if (["set-section", "jump-to"].includes(action) && !section) {
      return {
        output: `Action '${action}' requires a section parameter.`,
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "play":
        command = `anim montage play ${montageName} ${target ?? "selected"} ${speed ?? 1.0}`
        description = `Playing montage '${montageName}' at ${speed ?? 1.0}x speed for ${target ?? "selected actor"}`
        break

      case "stop":
        command = `anim montage stop ${target ?? "selected"}`
        description = `Stopped current montage for ${target ?? "selected actor"}`
        break

      case "pause":
        command = `anim montage pause ${target ?? "selected"}`
        description = `Paused current montage for ${target ?? "selected actor"}`
        break

      case "resume":
        command = `anim montage resume ${target ?? "selected"}`
        description = `Resumed current montage for ${target ?? "selected actor"}`
        break

      case "set-section":
        command = `anim montage set-section ${section} ${target ?? "selected"}`
        description = `Set montage section to '${section}' for ${target ?? "selected actor"}`
        break

      case "jump-to":
        command = `anim montage jump-to ${section} ${target ?? "selected"}`
        description = `Jumped to montage section '${section}' for ${target ?? "selected actor"}`
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      montageName,
      section,
      target,
      speed,
    })

    if (!result.success) {
      return {
        output: `Montage command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        montageName,
        section,
        target,
        speed,
        rawResult: result.result,
      },
    }
  },
})
