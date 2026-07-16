import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5OpenLevelTool = tool({
  description:
    "Open (load) a different level in the UE5 Editor. Specify the level asset path to switch to.",
  args: {
    levelPath: z.string().describe("Asset path of the level to open (e.g. '/Game/Maps/MyLevel')"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const command = `open ${args.levelPath}`
    const result = await connector.sendCommand(command, {
      levelPath: args.levelPath,
    })

    if (!result.success) {
      return {
        output: `Failed to open level: ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `Opened level "${args.levelPath}"`,
      metadata: { success: true, levelPath: args.levelPath },
    }
  },
})
