import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const DialogueStageSchema = z.enum(["intro", "progress", "completion"])

export const ue5QuestDialogueTool = tool({
  description:
    "Display quest dialogue in UE5. Shows intro, progress, or completion dialogue for a given quest. Uses the 'questdialog' console command.",
  args: {
    questID: z.string().describe("Quest ID to show dialogue for"),
    stage: DialogueStageSchema.describe("Dialogue stage: intro (quest start), progress (mid-quest), completion (quest done)"),
    speakerName: z.string().optional().describe("Optional NPC speaker name override"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const { questID, stage, speakerName } = args

    let command = `questdialog ${questID} ${stage}`
    if (speakerName) command += ` "${speakerName}"`

    const result = await connector.sendCommand(command, {
      questID,
      stage,
      speakerName,
    })

    if (!result.success) {
      return {
        output: `Failed to show quest dialogue: ${result.error}`,
        metadata: { success: false, questID, stage },
      }
    }

    let stageLabel = ""
    switch (stage) {
      case "intro":
        stageLabel = "Quest Introduction"
        break
      case "progress":
        stageLabel = "Quest Progress"
        break
      case "completion":
        stageLabel = "Quest Completion"
        break
    }

    return {
      output: `${stageLabel} dialogue displayed for quest "${questID}".${speakerName ? ` Speaker: ${speakerName}` : ""}`,
      metadata: {
        success: true,
        questID,
        stage,
        speakerName,
        dialogueText: result.result,
      },
    }
  },
})
