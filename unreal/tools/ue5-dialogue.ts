import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const DialogueActionSchema = z.enum(["start", "choose", "advance", "end", "info"])

export const ue5DialogueTool = tool({
  description:
    "Manage NPC dialogue system in UE5. Start a dialogue by ID, select a choice, advance to next node, end dialogue, or get current dialogue info. Uses the 'dialogue' console command.",
  args: {
    action: DialogueActionSchema.describe("Dialogue action to perform"),
    dialogueID: z.string().optional().describe("Dialogue ID to start (required for 'start' action)"),
    choiceID: z.string().optional().describe("Choice ID to select (required for 'choose' action)"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const { action, dialogueID, choiceID } = args

    // Validate required args
    if (action === "start" && !dialogueID) {
      return {
        output: "Action 'start' requires a dialogueID parameter.",
        metadata: { success: false },
      }
    }

    if (action === "choose" && !choiceID) {
      return {
        output: "Action 'choose' requires a choiceID parameter.",
        metadata: { success: false },
      }
    }

    // Build console command
    let command = `dialogue ${action}`
    if (dialogueID) command += ` ${dialogueID}`
    if (choiceID) command += ` ${choiceID}`

    const result = await connector.sendCommand(command, {
      action,
      dialogueID,
      choiceID,
    })

    if (!result.success) {
      return {
        output: `Dialogue ${action} failed: ${result.error}`,
        metadata: { success: false, action, dialogueID, choiceID },
      }
    }

    // Format output based on action
    let output = ""
    switch (action) {
      case "start":
        output = `Dialogue "${dialogueID}" started.`
        break
      case "choose":
        output = `Choice "${choiceID}" selected.`
        break
      case "advance":
        output = result.result || "Dialogue advanced to next node."
        break
      case "end":
        output = "Dialogue ended."
        break
      case "info":
        output = result.result || "Dialogue info retrieved."
        break
    }

    return {
      output,
      metadata: {
        success: true,
        action,
        dialogueID,
        choiceID,
        rawResult: result.result,
      },
    }
  },
})
