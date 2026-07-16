import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5StopTool = tool({
  description:
    "Stop Play In Editor (PIE) in the UE5 Editor.",
  args: {},
  async execute() {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const result = await connector.sendCommand("stop")
    if (!result.success) {
      return {
        output: `Failed to stop play: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: "Stopped Play In Editor",
      metadata: { success: true },
    }
  },
})
