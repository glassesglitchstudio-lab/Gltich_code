import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5AIPerceptionTool = tool({
  description:
    "Manage UE5 AI Perception system: configure sight/hearing ranges, set sense types, check visibility and hearing status of actors. Sends perception commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["set-range", "set-type", "set-angle", "can-see", "can-hear", "get-visible", "get-heard", "get-closest"])
      .describe("AI perception action to perform"),
    target: z
      .string()
      .optional()
      .describe("Target actor name (required for can-see/can-hear actions)"),
    params: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .optional()
      .describe("Additional parameters as key-value pairs (e.g. { range: 2000, angle: 90, type: 'Sight' })"),
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

    const { action, target, params } = args

    let command: string
    let description: string

    switch (action) {
      case "set-range": {
        const range = params?.range ?? params?.sight ?? params?.hearing ?? 2000
        const senseType = params?.type ?? "sight"
        command = `ai perception set-range ${senseType} ${range}`
        description = `Set ${senseType} range to ${range}`
        break
      }
      case "set-type": {
        const senseType = params?.type ?? "sight"
        command = `ai perception set-type ${senseType}`
        description = `Set active sense type to ${senseType}`
        break
      }
      case "set-angle": {
        const angle = params?.angle ?? 90
        command = `ai perception set-angle ${angle}`
        description = `Set sight angle to ${angle} degrees`
        break
      }
      case "can-see": {
        if (!target) {
          return {
            output: "Action 'can-see' requires a target actor name.",
            metadata: { success: false },
          }
        }
        command = `ai perception can-see ${target}`
        description = `Checking if AI can see ${target}`
        break
      }
      case "can-hear": {
        if (!target) {
          return {
            output: "Action 'can-hear' requires a target actor name.",
            metadata: { success: false },
          }
        }
        command = `ai perception can-hear ${target}`
        description = `Checking if AI can hear ${target}`
        break
      }
      case "get-visible": {
        command = `ai perception get-visible`
        description = "Getting all visible actors"
        break
      }
      case "get-heard": {
        command = `ai perception get-heard`
        description = "Getting all heard actors"
        break
      }
      case "get-closest": {
        const candidates = params?.candidates ?? ""
        command = `ai perception get-closest ${candidates}`
        description = "Getting closest visible actor"
        break
      }
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      target,
      params,
    })

    if (!result.success) {
      return {
        output: `AI Perception command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        target,
        params,
      },
    }
  },
})
