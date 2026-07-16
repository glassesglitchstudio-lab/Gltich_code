import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5PlayTool = tool({
  description:
    "Start Play In Editor (PIE) in the UE5 Editor. Choose between standalone, selected actor, or current camera mode.",
  args: {
    mode: z
      .enum(["standalone", "selected", "current-camera"])
      .default("standalone")
      .describe("Play mode: 'standalone' (default), 'selected' (selected actor), or 'current-camera'"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    let command = "play"
    if (args.mode === "selected") {
      command = "play -game"
    } else if (args.mode === "current-camera") {
      command = "play -camera"
    }

    const result = await connector.sendCommand(command, { mode: args.mode })
    if (!result.success) {
      return {
        output: `Failed to start play: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `Started Play In Editor (${args.mode} mode)`,
      metadata: { success: true, mode: args.mode },
    }
  },
})
