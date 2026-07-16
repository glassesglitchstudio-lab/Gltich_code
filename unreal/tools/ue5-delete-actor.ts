import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5DeleteActorTool = tool({
  description:
    "Delete an actor from the current UE5 level. Destroys the named actor using the console command.",
  args: {
    actorName: z.string().describe("Name of the actor to delete"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const command = `actor destroy ${args.actorName}`
    const result = await connector.sendCommand(command, {
      actorName: args.actorName,
    })

    if (!result.success) {
      return { output: `Failed to delete actor: ${result.error}`, metadata: { success: false } }
    }

    return {
      output: `Deleted actor "${args.actorName}"`,
      metadata: { success: true, actorName: args.actorName },
    }
  },
})
