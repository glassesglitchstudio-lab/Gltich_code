import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const DarknessActionSchema = z.enum([
  "set-level",
  "set-area",
  "flicker-light",
  "break-light",
  "spawn-darkness",
  "remove-darkness",
  "flashlight",
])

export const ue5UniqueDarknessTool = tool({
  description:
    "Manage UE5 unique darkness system. Control global darkness level, set area-specific darkness, flicker or break lights, spawn/remove darkness effects, and toggle flashlight. Uses the 'unique darkness' console command.",
  args: {
    action: DarknessActionSchema.describe("Darkness action to perform"),
    area: z.string().optional().describe("Area name — required for set-area"),
    level: z.number().min(0).max(1).optional().describe("Darkness level (0.0-1.0) — required for set-level, set-area, spawn-darkness"),
    lightName: z.string().optional().describe("Light actor name — required for flicker-light, break-light, remove-darkness"),
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

    const { action, area, level, lightName } = args

    if (action === "set-level" && level === undefined) {
      return {
        output: "Action 'set-level' requires a level parameter (0.0-1.0).",
        metadata: { success: false },
      }
    }

    if (action === "set-area" && (!area || level === undefined)) {
      return {
        output: "Action 'set-area' requires both area and level parameters.",
        metadata: { success: false },
      }
    }

    if (action === "flicker-light" && !lightName) {
      return {
        output: "Action 'flicker-light' requires a lightName parameter.",
        metadata: { success: false },
      }
    }

    if (action === "break-light" && !lightName) {
      return {
        output: "Action 'break-light' requires a lightName parameter.",
        metadata: { success: false },
      }
    }

    if (action === "spawn-darkness" && level === undefined) {
      return {
        output: "Action 'spawn-darkness' requires a level parameter (0.0-1.0).",
        metadata: { success: false },
      }
    }

    if (action === "remove-darkness" && !lightName) {
      return {
        output: "Action 'remove-darkness' requires a lightName parameter.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "set-level":
        command = `unique darkness set-level ${level}`
        description = `Set global darkness level to ${level}`
        break

      case "set-area":
        command = `unique darkness set-area ${area} ${level}`
        description = `Set darkness level for area '${area}' to ${level}`
        break

      case "flicker-light":
        command = `unique darkness flicker-light ${lightName}`
        description = `Flickering light '${lightName}'`
        break

      case "break-light":
        command = `unique darkness break-light ${lightName}`
        description = `Broke light '${lightName}'`
        break

      case "spawn-darkness":
        command = `unique darkness spawn-darkness ${level}`
        description = `Spawned darkness effect at level ${level}`
        break

      case "remove-darkness":
        command = `unique darkness remove-darkness ${lightName}`
        description = `Removed darkness effect from '${lightName}'`
        break

      case "flashlight":
        command = `unique darkness flashlight`
        description = "Toggled flashlight"
        break

      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      area,
      level,
      lightName,
    })

    if (!result.success) {
      return {
        output: `Darkness command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        area,
        level,
        lightName,
        rawResult: result.result,
      },
    }
  },
})
