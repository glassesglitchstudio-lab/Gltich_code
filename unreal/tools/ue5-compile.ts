import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5CompileTool = tool({
  description:
    "Compile a UE5 Blueprint. Triggers a recompile of the specified blueprint asset and reports success or compilation errors.",
  args: {
    blueprintName: z.string().describe("Name or asset path of the Blueprint to compile (e.g. 'BP_MyActor' or '/Game/Blueprints/BP_MyActor')"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const command = `bp compile ${args.blueprintName}`
    const result = await connector.sendCommand(command, {
      blueprintName: args.blueprintName,
    })

    if (!result.success) {
      return {
        output: `Compilation failed for "${args.blueprintName}": ${result.error}`,
        metadata: { success: false },
      }
    }

    const output = result.result ?? ""
    const hasErrors = output.toLowerCase().includes("error")

    return {
      output: hasErrors
        ? `Blueprint "${args.blueprintName}" compiled with errors:\n${output}`
        : `Blueprint "${args.blueprintName}" compiled successfully.`,
      metadata: {
        success: !hasErrors,
        blueprintName: args.blueprintName,
        compileOutput: output,
      },
    }
  },
})
