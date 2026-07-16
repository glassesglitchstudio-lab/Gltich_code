import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5SelectActorTool = tool({
  description:
    "Select an actor in the UE5 Editor viewport. Highlights and selects the named actor.",
  args: {
    actorName: z.string().describe("Name of the actor to select"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const command = `actor select ${args.actorName}`
    const result = await connector.sendCommand(command, {
      actorName: args.actorName,
    })

    if (!result.success) {
      return {
        output: `Failed to select actor: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `Selected actor "${args.actorName}"`,
      metadata: { success: true, actorName: args.actorName },
    }
  },
})
