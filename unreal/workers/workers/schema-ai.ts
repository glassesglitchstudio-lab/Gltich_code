import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const schemaAiWorker: WorkerDefinition = {
  id: "schema-ai",
  name: "Schema AI Worker",
  description: "AI and NPC behavior. Perception, patrol routes, enemy waves, stealth, behavior trees.",
  category: "schema",
  keywords: ["ai", "yapay zeka", "npc", "düşman", "enemy", "patrol", "devriye", "stealth", "gizlilik"],
  schema: z.object({
    action: z.enum(["perception", "patrol", "enemy-wave", "stealth", "spawn", "behavior"]).describe("AI action"),
    npcName: z.string().optional().describe("NPC or AI controller name"),
    waveCount: z.number().optional().describe("Enemy count for wave"),
    difficulty: z.enum(["easy", "normal", "hard", "nightmare"]).optional().describe("Difficulty level"),
    location: z.string().optional().describe("Spawn location as 'X,Y,Z'"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, npcName, waveCount, difficulty, location } = args
    let command = `build ai ${action}`
    if (npcName) command += ` npc=${npcName}`
    if (waveCount) command += ` count=${waveCount}`
    if (difficulty) command += ` difficulty=${difficulty}`
    if (location) command += ` location=${location}`
    const result = await connector.sendCommand(command, { action, npcName, waveCount, difficulty, location })
    return {
      success: result.success,
      output: result.success ? `AI ${action} completed` : `AI failed: ${result.error}`,
      metadata: result,
    }
  },
}
