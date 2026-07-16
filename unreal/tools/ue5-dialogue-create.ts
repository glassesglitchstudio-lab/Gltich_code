import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5DialogueCreateTool = tool({
  description:
    "Create dialogue nodes and dialogue data in UE5. Create a new dialogue with speaker, text, and optional choices. Uses the 'dialogue create' console command.",
  args: {
    dialogueName: z.string().describe("Name for the dialogue (e.g. 'GuardConversation')"),
    speakerName: z.string().describe("NPC speaker name (e.g. 'Guard')"),
    text: z.string().describe("Dialogue text to display"),
    choices: z
      .string()
      .optional()
      .describe(
        "JSON array of choices, e.g. '[{\"text\":\"Hello\",\"nextNode\":\"node2\"}]'. Leave empty for auto-advance."
      ),
    dialogueID: z.string().optional().describe("Optional dialogue ID (auto-generated if omitted)"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const { dialogueName, speakerName, text, choices, dialogueID } = args

    // Build console command
    let command = `dialogue create "${dialogueName}" "${speakerName}" "${text}"`

    if (dialogueID) {
      command += ` ${dialogueID}`
    }

    if (choices) {
      command += ` ${choices}`
    }

    const result = await connector.sendCommand(command, {
      dialogueName,
      speakerName,
      text,
      choices,
      dialogueID,
    })

    if (!result.success) {
      return {
        output: `Failed to create dialogue: ${result.error}`,
        metadata: { success: false, dialogueName, speakerName },
      }
    }

    const choiceCount = choices ? JSON.parse(choices).length : 0
    let output = `Dialogue "${dialogueName}" created successfully.`
    output += `\n  Speaker: ${speakerName}`
    output += `\n  Text: "${text}"`
    if (choiceCount > 0) {
      output += `\n  Choices: ${choiceCount}`
    } else {
      output += `\n  Type: Auto-advance (no choices)`
    }

    return {
      output,
      metadata: {
        success: true,
        dialogueName,
        speakerName,
        text,
        choiceCount,
        dialogueID: dialogueID || result.result,
      },
    }
  },
})
