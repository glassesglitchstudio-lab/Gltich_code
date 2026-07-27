import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const schemaAudioWorker: WorkerDefinition = {
  id: "schema-audio",
  name: "Schema Audio Worker",
  description: "Audio and sound design. Ambient sounds, sound zones, triggers, atmospheric audio, music.",
  category: "schema",
  keywords: ["audio", "ses", "sound", "müzik", "music", "ambient", "atmosfer", "trigger", "tetik"],
  schema: z.object({
    action: z.enum(["ambient", "sound-zone", "trigger", "atmosphere", "stop-all"]).describe("Audio action"),
    soundPath: z.string().optional().describe("Sound asset path"),
    location: z.string().optional().describe("Location as 'X,Y,Z'"),
    radius: z.number().optional().describe("Sound radius"),
    intensity: z.number().optional().describe("Intensity (0.0-1.0)"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, soundPath, location, radius, intensity } = args
    let command = `build audio ${action}`
    if (soundPath) command += ` sound=${soundPath}`
    if (location) command += ` location=${location}`
    if (radius) command += ` radius=${radius}`
    if (intensity !== undefined) command += ` intensity=${intensity}`
    const result = await connector.sendCommand(command, { action, soundPath, location, radius, intensity })
    return {
      success: result.success,
      output: result.success ? `Audio ${action} applied` : `Audio failed: ${result.error}`,
      metadata: result,
    }
  },
}
