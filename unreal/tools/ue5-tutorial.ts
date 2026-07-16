import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5TutorialTool = tool({
  description:
    "Manage UE5 tutorial system: create tutorials, show/hide UI, mark complete, skip, and list tutorials. Supports tooltip, highlight, cutscene, and voiceover tutorial types. Sends tutorial commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["create", "show", "hide", "complete", "skip", "list"])
      .describe("Tutorial action to perform"),
    tutorialType: z
      .enum(["tooltip", "highlight", "cutscene", "voiceover"])
      .optional()
      .describe("Type of tutorial element"),
    message: z
      .string()
      .optional()
      .describe("Tutorial message text for create actions"),
    target: z
      .string()
      .optional()
      .describe("Target actor name for tutorial focus (defaults to selected actor)"),
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

    const { action, tutorialType, message, target } = args

    let command: string
    let description: string

    switch (action) {
      case "create":
        if (tutorialType === undefined || message === undefined) {
          return {
            output: "Action 'create' requires tutorialType and message.",
            metadata: { success: false },
          }
        }
        command = `mechanic tutorial create ${tutorialType} ${message} ${target ?? ""}`.trim()
        description = `Create ${tutorialType} tutorial: "${message}"`
        break
      case "show":
        if (tutorialType === undefined) {
          return {
            output: "Action 'show' requires a tutorialType.",
            metadata: { success: false },
          }
        }
        command = `mechanic tutorial show ${tutorialType} ${target ?? ""}`.trim()
        description = `Show ${tutorialType} tutorial${target !== undefined ? ` on ${target}` : ""}`
        break
      case "hide":
        if (tutorialType === undefined) {
          return {
            output: "Action 'hide' requires a tutorialType.",
            metadata: { success: false },
          }
        }
        command = `mechanic tutorial hide ${tutorialType} ${target ?? ""}`.trim()
        description = `Hide ${tutorialType} tutorial${target !== undefined ? ` on ${target}` : ""}`
        break
      case "complete":
        if (tutorialType === undefined) {
          return {
            output: "Action 'complete' requires a tutorialType.",
            metadata: { success: false },
          }
        }
        command = `mechanic tutorial complete ${tutorialType} ${target ?? ""}`.trim()
        description = `Mark ${tutorialType} tutorial as complete${target !== undefined ? ` on ${target}` : ""}`
        break
      case "skip":
        command = `mechanic tutorial skip ${target ?? ""}`.trim()
        description = `Skip current tutorial${target !== undefined ? ` on ${target}` : ""}`
        break
      case "list":
        command = `mechanic tutorial list`
        description = `List all tutorials`
        break
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      tutorialType,
      message,
      target,
    })

    if (!result.success) {
      return {
        output: `Tutorial command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        tutorialType,
        message,
        target,
      },
    }
  },
})
