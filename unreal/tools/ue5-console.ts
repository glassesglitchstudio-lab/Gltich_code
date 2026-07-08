import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5ConsoleTool = tool({
  description:
    "Execute any Unreal Engine 5 console command. Sends the command to the UE5 Editor via the HTTP connector and returns the result.",
  args: {
    command: z.string().describe("The UE5 console command to execute (e.g. 'stat fps', 'obj list')"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected. Make sure the editor is running with the Glitch Code plugin enabled.", metadata: { success: false } }
    }

    const result = await connector.sendCommand(args.command)
    if (!result.success) {
      return { output: `Command failed: ${result.error}`, metadata: { success: false } }
    }

    return {
      output: result.result ?? "Command executed successfully.",
      metadata: { success: true, command: args.command },
    }
  },
})
