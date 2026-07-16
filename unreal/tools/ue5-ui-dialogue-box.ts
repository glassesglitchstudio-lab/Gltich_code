import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5UiDialogueBoxTool = tool({
  description:
    "Manage UE5 dialogue boxes: show, hide, set speaker, set text, add/clear choices, and configure auto-advance timing. Uses the 'ui dialogue-box' console command.",
  args: {
    action: z
      .enum(["show", "hide", "set-speaker", "set-text", "add-choice", "clear-choices", "auto-advance"])
      .describe("Dialogue box action to perform"),
    speaker: z.string().optional().describe("Speaker name to display in the dialogue box"),
    text: z.string().optional().describe("Dialogue text content to display"),
    choices: z.string().optional().describe("Choice text to add (pipe-separated for multiple: 'Yes|No|Maybe')"),
    autoAdvance: z.number().optional().describe("Auto-advance delay in seconds (0 to disable)"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return {
        output: "UE5 Editor is not connected.",
        metadata: { success: false },
      }
    }

    const { action, speaker, text, choices, autoAdvance } = args

    if (action === "set-speaker" && !speaker) {
      return {
        output: "Action 'set-speaker' requires a speaker parameter.",
        metadata: { success: false },
      }
    }

    if (action === "set-text" && !text) {
      return {
        output: "Action 'set-text' requires a text parameter.",
        metadata: { success: false },
      }
    }

    if (action === "add-choice" && !choices) {
      return {
        output: "Action 'add-choice' requires a choices parameter.",
        metadata: { success: false },
      }
    }

    if (action === "auto-advance" && (autoAdvance === undefined || autoAdvance === null)) {
      return {
        output: "Action 'auto-advance' requires an autoAdvance delay in seconds.",
        metadata: { success: false },
      }
    }

    let command = `ui dialogue-box ${action}`
    if (speaker) command += ` ${speaker}`
    if (text) command += ` ${text}`
    if (choices) command += ` ${choices}`
    if (autoAdvance !== undefined && autoAdvance !== null) command += ` ${autoAdvance}`

    const result = await connector.sendCommand(command, { action, speaker, text, choices, autoAdvance })

    if (!result.success) {
      return {
        output: `Dialogue box command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    let output = ""
    switch (action) {
      case "show":
        output = "Dialogue box shown."
        break
      case "hide":
        output = "Dialogue box hidden."
        break
      case "set-speaker":
        output = `Speaker set to "${speaker}".`
        break
      case "set-text":
        output = `Dialogue text set to "${text}".`
        break
      case "add-choice":
        output = `Choices added: "${choices}".`
        break
      case "clear-choices":
        output = "All dialogue choices cleared."
        break
      case "auto-advance":
        output = autoAdvance === 0
          ? "Auto-advance disabled."
          : `Auto-advance set to ${autoAdvance}s.`
        break
    }

    return {
      output: `${output}\n${result.result ?? ""}`,
      metadata: { success: true, action, speaker, text, choices, autoAdvance },
    }
  },
})
