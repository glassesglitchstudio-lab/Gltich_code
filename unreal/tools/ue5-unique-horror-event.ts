import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const HorrorEventActionSchema = z.enum([
  "trigger",
  "schedule",
  "cancel",
  "set-probability",
  "add-condition",
  "list-active",
  "history",
])

const EventTypeSchema = z.enum(["ambient", "directed", "random", "scare-bait"])

export const ue5UniqueHorrorEventTool = tool({
  description:
    "Manage UE5 unique horror event system. Trigger, schedule, or cancel horror events; set probability; add conditions; list active events; and view history. Uses the 'unique horror-event' console command.",
  args: {
    action: HorrorEventActionSchema.describe("Horror event action to perform"),
    eventType: EventTypeSchema.optional().describe("Event type (ambient/directed/random/scare-bait) — required for trigger/schedule/set-probability"),
    probability: z.number().min(0).max(1).optional().describe("Event probability (0.0-1.0) — required for set-probability"),
    delay: z.number().min(0).optional().describe("Delay in seconds before triggering — used with trigger/schedule"),
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

    const { action, eventType, probability, delay } = args

    if (action === "trigger" && !eventType) {
      return {
        output: "Action 'trigger' requires an eventType parameter (ambient/directed/random/scare-bait).",
        metadata: { success: false },
      }
    }

    if (action === "schedule" && !eventType) {
      return {
        output: "Action 'schedule' requires an eventType parameter (ambient/directed/random/scare-bait).",
        metadata: { success: false },
      }
    }

    if (action === "set-probability" && (!eventType || probability === undefined)) {
      return {
        output: "Action 'set-probability' requires both eventType and probability parameters.",
        metadata: { success: false },
      }
    }

    if (action === "add-condition" && !eventType) {
      return {
        output: "Action 'add-condition' requires an eventType parameter.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "trigger":
        command = `unique horror-event trigger ${eventType}`
        if (delay !== undefined) command += ` ${delay}`
        description = `Triggered ${eventType} horror event`
        break

      case "schedule":
        command = `unique horror-event schedule ${eventType}`
        if (delay !== undefined) command += ` ${delay}`
        description = `Scheduled ${eventType} horror event`
        break

      case "cancel":
        command = `unique horror-event cancel`
        description = "Cancelled active horror event"
        break

      case "set-probability":
        command = `unique horror-event set-probability ${eventType} ${probability}`
        description = `Set probability for ${eventType} events to ${probability}`
        break

      case "add-condition":
        command = `unique horror-event add-condition ${eventType}`
        description = `Added condition to ${eventType} horror events`
        break

      case "list-active":
        command = `unique horror-event list-active`
        description = "Listed active horror events"
        break

      case "history":
        command = `unique horror-event history`
        description = "Retrieved horror event history"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      eventType,
      probability,
      delay,
    })

    if (!result.success) {
      return {
        output: `Horror event command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        eventType,
        probability,
        delay,
        rawResult: result.result,
      },
    }
  },
})
