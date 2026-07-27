import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const schemaAnimationWorker: WorkerDefinition = {
  id: "schema-animation",
  name: "Schema Animation Worker",
  description: "Animation system setup. State machines, blend spaces, IK, ragdolls, montages, locomotion.",
  category: "schema",
  keywords: ["animation", "animasyon", "hareket", "motion", "blend", "ik", "ragdoll", "montage"],
  schema: z.object({
    action: z.enum(["state", "blend", "ragdoll", "ik", "montage", "locomotion"]).describe("Animation action"),
    characterName: z.string().describe("Character or skeleton name"),
    preset: z.string().optional().describe("Animation preset"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, characterName, preset } = args
    let command = `build anim ${action} character=${characterName}`
    if (preset) command += ` preset=${preset}`
    const result = await connector.sendCommand(command, { action, characterName, preset })
    return {
      success: result.success,
      output: result.success ? `Animation ${action}: ${characterName}` : `Animation failed: ${result.error}`,
      metadata: result,
    }
  },
}
