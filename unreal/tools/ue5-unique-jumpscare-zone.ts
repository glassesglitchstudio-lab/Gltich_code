import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const JumpscareZoneActionSchema = z.enum([
  "create",
  "remove",
  "set-trigger",
  "set-scare",
  "set-cooldown",
  "enable",
  "disable",
  "list",
])

const ScareTypeSchema = z.enum(["visual", "audio", "combined", "door", "ball"])

const TriggerTypeSchema = z.enum(["proximity", "timed", "scripted"])

export const ue5UniqueJumpscareZoneTool = tool({
  description:
    "Manage UE5 unique jump scare zone system. Create/remove zones, configure triggers and scare types, set cooldowns, enable/disable zones, and list all zones. Uses the 'unique jumpscare-zone' console command.",
  args: {
    action: JumpscareZoneActionSchema.describe("Jump scare zone action to perform"),
    zoneName: z.string().optional().describe("Zone name — required for create, remove, set-trigger, set-scare, set-cooldown, enable, disable"),
    scareType: ScareTypeSchema.optional().describe("Scare type (visual/audio/combined/door/ball) — required for set-scare"),
    triggerType: TriggerTypeSchema.optional().describe("Trigger type (proximity/timed/scripted) — required for set-trigger"),
    cooldown: z.number().min(0).optional().describe("Cooldown in seconds between scares — required for set-cooldown"),
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

    const { action, zoneName, scareType, triggerType, cooldown } = args

    const needsName = ["create", "remove", "set-trigger", "set-scare", "set-cooldown", "enable", "disable"]
    if (needsName.includes(action) && !zoneName) {
      return {
        output: `Action '${action}' requires a zoneName parameter.`,
        metadata: { success: false },
      }
    }

    if (action === "set-trigger" && !triggerType) {
      return {
        output: "Action 'set-trigger' requires a triggerType parameter (proximity/timed/scripted).",
        metadata: { success: false },
      }
    }

    if (action === "set-scare" && !scareType) {
      return {
        output: "Action 'set-scare' requires a scareType parameter (visual/audio/combined/door/ball).",
        metadata: { success: false },
      }
    }

    if (action === "set-cooldown" && cooldown === undefined) {
      return {
        output: "Action 'set-cooldown' requires a cooldown parameter (seconds).",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "create":
        command = `unique jumpscare-zone create ${zoneName}`
        description = `Created jump scare zone '${zoneName}'`
        break

      case "remove":
        command = `unique jumpscare-zone remove ${zoneName}`
        description = `Removed jump scare zone '${zoneName}'`
        break

      case "set-trigger":
        command = `unique jumpscare-zone set-trigger ${zoneName} ${triggerType}`
        description = `Set trigger for zone '${zoneName}' to ${triggerType}`
        break

      case "set-scare":
        command = `unique jumpscare-zone set-scare ${zoneName} ${scareType}`
        description = `Set scare type for zone '${zoneName}' to ${scareType}`
        break

      case "set-cooldown":
        command = `unique jumpscare-zone set-cooldown ${zoneName} ${cooldown}`
        description = `Set cooldown for zone '${zoneName}' to ${cooldown}s`
        break

      case "enable":
        command = `unique jumpscare-zone enable ${zoneName}`
        description = `Enabled jump scare zone '${zoneName}'`
        break

      case "disable":
        command = `unique jumpscare-zone disable ${zoneName}`
        description = `Disabled jump scare zone '${zoneName}'`
        break

      case "list":
        command = `unique jumpscare-zone list`
        description = "Listed all jump scare zones"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      zoneName,
      scareType,
      triggerType,
      cooldown,
    })

    if (!result.success) {
      return {
        output: `Jump scare zone command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        zoneName,
        scareType,
        triggerType,
        cooldown,
        rawResult: result.result,
      },
    }
  },
})
