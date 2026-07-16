import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const CameraCinematicActionSchema = z.enum([
  "start",
  "stop",
  "add-keyframe",
  "remove-keyframe",
  "set-duration",
  "play",
  "pause",
])

export const ue5CameraCinematicTool = tool({
  description:
    "Control UE5 cinematic camera sequences. Start/stop recording, add/remove keyframes with position and look-at targets, set sequence duration, and play/pause the sequence. Uses the 'camera cinematic' console command.",
  args: {
    action: CameraCinematicActionSchema.describe("Cinematic camera action to perform"),
    keyframeName: z.string().optional().describe("Name for the keyframe (required for add/remove)"),
    position: z.string().optional().describe("Camera position as 'X,Y,Z' for the keyframe"),
    lookAt: z.string().optional().describe("Look-at target as 'X,Y,Z' for the keyframe"),
    duration: z.number().min(0).optional().describe("Sequence duration in seconds"),
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

    const { action, keyframeName, position, lookAt, duration } = args

    if (action === "add-keyframe" && !keyframeName) {
      return {
        output: "Action 'add-keyframe' requires a keyframeName parameter.",
        metadata: { success: false },
      }
    }

    if (action === "remove-keyframe" && !keyframeName) {
      return {
        output: "Action 'remove-keyframe' requires a keyframeName parameter.",
        metadata: { success: false },
      }
    }

    if (action === "set-duration" && duration === undefined) {
      return {
        output: "Action 'set-duration' requires a duration parameter.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "start":
        command = "camera cinematic start"
        description = "Started cinematic camera recording"
        break

      case "stop":
        command = "camera cinematic stop"
        description = "Stopped cinematic camera recording"
        break

      case "add-keyframe":
        command = `camera cinematic add-keyframe name=${keyframeName}`
        if (position) command += ` position=${position}`
        if (lookAt) command += ` lookAt=${lookAt}`
        description = `Added cinematic keyframe '${keyframeName}'`
        if (position) description += ` at position ${position}`
        if (lookAt) description += ` looking at ${lookAt}`
        break

      case "remove-keyframe":
        command = `camera cinematic remove-keyframe name=${keyframeName}`
        description = `Removed cinematic keyframe '${keyframeName}'`
        break

      case "set-duration":
        command = `camera cinematic duration=${duration}`
        description = `Set cinematic sequence duration to ${duration} seconds`
        break

      case "play":
        command = "camera cinematic play"
        description = "Playing cinematic camera sequence"
        break

      case "pause":
        command = "camera cinematic pause"
        description = "Paused cinematic camera sequence"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, { action, keyframeName, position, lookAt, duration })

    if (!result.success) {
      return {
        output: `Cinematic camera command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        keyframeName,
        position,
        lookAt,
        duration,
        rawResult: result.result,
      },
    }
  },
})
