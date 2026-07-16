import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const AISpawnActionSchema = z.enum([
  "create-zone",
  "remove-zone",
  "set-density",
  "set-types",
  "set-wave",
  "pause",
  "resume",
  "stats",
])

export const ue5UniqueAISpawnTool = tool({
  description:
    "Manage UE5 unique horror AI spawn system. Create/remove spawn zones, set enemy density, configure enemy types, manage waves, pause/resume spawning, and view stats. Uses the 'unique ai-spawn' console command.",
  args: {
    action: AISpawnActionSchema.describe("AI spawn action to perform"),
    zoneName: z.string().optional().describe("Spawn zone name — required for create-zone, remove-zone, set-density, set-types, set-wave"),
    enemyTypes: z.string().optional().describe("Comma-separated enemy type list (e.g. 'Zombie,Ghost,Crawler') — required for set-types"),
    density: z.number().min(0).max(100).optional().describe("Enemy density value (0-100) — required for set-density"),
    waveCount: z.number().int().min(1).optional().describe("Number of waves to spawn — required for set-wave"),
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

    const { action, zoneName, enemyTypes, density, waveCount } = args

    if (action === "create-zone" && !zoneName) {
      return {
        output: "Action 'create-zone' requires a zoneName parameter.",
        metadata: { success: false },
      }
    }

    if (action === "remove-zone" && !zoneName) {
      return {
        output: "Action 'remove-zone' requires a zoneName parameter.",
        metadata: { success: false },
      }
    }

    if (action === "set-density" && (!zoneName || density === undefined)) {
      return {
        output: "Action 'set-density' requires both zoneName and density parameters.",
        metadata: { success: false },
      }
    }

    if (action === "set-types" && (!zoneName || !enemyTypes)) {
      return {
        output: "Action 'set-types' requires both zoneName and enemyTypes parameters.",
        metadata: { success: false },
      }
    }

    if (action === "set-wave" && (!zoneName || waveCount === undefined)) {
      return {
        output: "Action 'set-wave' requires both zoneName and waveCount parameters.",
        metadata: { success: false },
      }
    }

    let command: string
    let description: string

    switch (action) {
      case "create-zone":
        command = `unique ai-spawn create-zone ${zoneName}`
        description = `Created AI spawn zone '${zoneName}'`
        break

      case "remove-zone":
        command = `unique ai-spawn remove-zone ${zoneName}`
        description = `Removed AI spawn zone '${zoneName}'`
        break

      case "set-density":
        command = `unique ai-spawn set-density ${zoneName} ${density}`
        description = `Set density for zone '${zoneName}' to ${density}`
        break

      case "set-types":
        command = `unique ai-spawn set-types ${zoneName} ${enemyTypes}`
        description = `Set enemy types for zone '${zoneName}' to [${enemyTypes}]`
        break

      case "set-wave":
        command = `unique ai-spawn set-wave ${zoneName} ${waveCount}`
        description = `Set wave count for zone '${zoneName}' to ${waveCount}`
        break

      case "pause":
        command = `unique ai-spawn pause`
        description = "Paused AI spawning"
        break

      case "resume":
        command = `unique ai-spawn resume`
        description = "Resumed AI spawning"
        break

      case "stats":
        command = `unique ai-spawn stats`
        description = "Retrieved AI spawn statistics"
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
      enemyTypes,
      density,
      waveCount,
    })

    if (!result.success) {
      return {
        output: `AI spawn command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        zoneName,
        enemyTypes,
        density,
        waveCount,
        rawResult: result.result,
      },
    }
  },
})
