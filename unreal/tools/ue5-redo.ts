import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5RedoTool = tool({
  description:
    "Redo the last undone action(s) in the UE5 Editor. Specify the number of steps to redo.",
  args: {
    steps: z.number().int().min(1).default(1).describe("Number of redo steps to perform"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const command = args.steps === 1 ? "redo" : `redo ${args.steps}`
    const result = await connector.sendCommand(command, { steps: args.steps })

    if (!result.success) {
      return {
        output: `Failed to redo: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `Redid ${args.steps} step(s)`,
      metadata: { success: true, steps: args.steps },
    }
  },
})
