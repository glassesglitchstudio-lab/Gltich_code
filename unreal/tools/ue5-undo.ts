import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5UndoTool = tool({
  description:
    "Undo the last action(s) in the UE5 Editor. Specify the number of steps to undo.",
  args: {
    steps: z.number().int().min(1).default(1).describe("Number of undo steps to perform"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const command = args.steps === 1 ? "undo" : `undo ${args.steps}`
    const result = await connector.sendCommand(command, { steps: args.steps })

    if (!result.success) {
      return {
        output: `Failed to undo: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `Undid ${args.steps} step(s)`,
      metadata: { success: true, steps: args.steps },
    }
  },
})
