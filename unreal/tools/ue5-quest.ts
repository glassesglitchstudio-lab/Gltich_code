import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const QuestActionSchema = z.enum([
  "accept",
  "abandon",
  "complete",
  "update",
  "status",
  "list",
  "progress",
])

export const ue5QuestTool = tool({
  description:
    "Manage UE5 quests via the QuestManager subsystem. Accept, abandon, complete, update objectives, check status, list quests, or view progress. Uses the 'quest' console command.",
  args: {
    action: QuestActionSchema.describe("Quest action to perform"),
    questID: z.string().optional().describe("Quest ID to operate on (required for accept/abandon/complete/status/progress)"),
    objectiveID: z.string().optional().describe("Objective ID to update (required for 'update' action)"),
    count: z.number().int().min(1).default(1).describe("Progress count for objective update (default: 1)"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const { action, questID, objectiveID, count } = args

    // Validate required args
    if (["accept", "abandon", "complete", "status", "progress"].includes(action) && !questID) {
      return {
        output: `Action '${action}' requires a questID parameter.`,
        metadata: { success: false },
      }
    }

    if (action === "update" && (!questID || !objectiveID)) {
      return {
        output: "Action 'update' requires both questID and objectiveID parameters.",
        metadata: { success: false },
      }
    }

    // Build console command
    let command = `quest ${action}`
    if (questID) command += ` ${questID}`
    if (objectiveID) command += ` ${objectiveID}`
    if (action === "update" && count) command += ` ${count}`

    const result = await connector.sendCommand(command, {
      action,
      questID,
      objectiveID,
      count,
    })

    if (!result.success) {
      return {
        output: `Quest ${action} failed: ${result.error}`,
        metadata: { success: false, action, questID },
      }
    }

    // Format output based on action
    let output = ""
    switch (action) {
      case "accept":
        output = `Quest "${questID}" accepted. Check your journal for objectives.`
        break
      case "abandon":
        output = `Quest "${questID}" abandoned.`
        break
      case "complete":
        output = `Quest "${questID}" completed! Rewards have been granted.`
        break
      case "update":
        output = `Objective "${objectiveID}" in quest "${questID}" updated by ${count}.`
        break
      case "status":
        output = result.result || `Quest "${questID}" status retrieved.`
        break
      case "list":
        output = result.result || "Quest list retrieved."
        break
      case "progress":
        output = result.result || `Quest "${questID}" progress retrieved.`
        break
    }

    return {
      output,
      metadata: {
        success: true,
        action,
        questID,
        objectiveID,
        count,
        rawResult: result.result,
      },
    }
  },
})
