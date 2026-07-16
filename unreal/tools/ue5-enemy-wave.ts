import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5EnemyWaveTool = tool({
  description:
    "Manage UE5 enemy wave spawning system: start/stop waves, spawn specific waves, check wave status and configuration. Sends wave commands to the UE5 Editor via the HTTP connector.",
  args: {
    action: z
      .enum(["start", "stop", "pause", "resume", "spawn", "status", "config"])
      .describe("Wave management action to perform"),
    waveNumber: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Wave number (required for spawn action, optional for config)"),
    config: z
      .record(z.string(), z.union([z.string(), z.number(), z.array(z.string())]))
      .optional()
      .describe("Wave configuration as JSON object (e.g. { enemyCount: 10, enemyTypes: ['Grunt', 'Boss'], spawnDelay: 0.5 })"),
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

    const { action, waveNumber, config } = args

    let command: string
    let description: string

    switch (action) {
      case "start": {
        const totalWaves = config?.totalWaves ?? config?.count ?? 5
        command = `enemy wave start ${totalWaves}`
        description = `Started wave system with ${totalWaves} waves`
        break
      }
      case "stop": {
        command = `enemy wave stop`
        description = "Stopped wave system"
        break
      }
      case "pause": {
        command = `enemy wave pause`
        description = "Paused wave system"
        break
      }
      case "resume": {
        command = `enemy wave resume`
        description = "Resumed wave system"
        break
      }
      case "spawn": {
        if (!waveNumber) {
          return {
            output: "Action 'spawn' requires a waveNumber parameter.",
            metadata: { success: false },
          }
        }
        command = `enemy wave spawn ${waveNumber}`
        description = `Spawned wave ${waveNumber}`
        break
      }
      case "status": {
        command = `enemy wave status`
        description = "Getting wave status"
        break
      }
      case "config": {
        if (!waveNumber) {
          return {
            output: "Action 'config' requires a waveNumber parameter.",
            metadata: { success: false },
          }
        }
        const enemyCount = config?.enemyCount ?? 5
        const enemyTypes = Array.isArray(config?.enemyTypes) ? config.enemyTypes.join(",") : "DefaultEnemy"
        const spawnDelay = config?.spawnDelay ?? 0.5
        command = `enemy wave config ${waveNumber} ${enemyCount} ${enemyTypes} ${spawnDelay}`
        description = `Configured wave ${waveNumber}: ${enemyCount} enemies`
        break
      }
      default:
        return {
          output: `Unknown action: ${action}`,
          metadata: { success: false },
        }
    }

    const result = await connector.sendCommand(command, {
      action,
      waveNumber,
      config,
    })

    if (!result.success) {
      return {
        output: `Enemy Wave command failed: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `${description}.\n${result.result ?? ""}`,
      metadata: {
        success: true,
        action,
        waveNumber,
        config,
      },
    }
  },
})
