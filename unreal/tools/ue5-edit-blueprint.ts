import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5EditBlueprintTool = tool({
  description:
    "Edit a property on a UE5 Blueprint. Sets the specified property to the given value on the named blueprint or blueprint instance in the current level.",
  args: {
    blueprintName: z.string().describe("Name or path of the Blueprint actor to edit (e.g. 'BP_MyActor' or '/Game/Blueprints/BP_MyActor')"),
    property: z.string().describe("Property name to set (e.g. 'Mesh', 'Material', 'bHidden')"),
    value: z.string().describe("New value for the property (type is auto-detected: bool, number, string, vector)"),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const parsedValue = parseValue(args.value)
    const command = `bp set ${args.blueprintName} ${args.property} ${args.value}`

    const result = await connector.sendCommand(command, {
      blueprintName: args.blueprintName,
      property: args.property,
      value: parsedValue,
    })

    if (!result.success) {
      return {
        output: `Failed to set property "${args.property}" on "${args.blueprintName}": ${result.error}`,
        metadata: { success: false },
      }
    }

    return {
      output: `Set ${args.blueprintName}.${args.property} = ${args.value}`,
      metadata: {
        success: true,
        blueprintName: args.blueprintName,
        property: args.property,
        value: parsedValue,
      },
    }
  },
})

function parseValue(raw: string): any {
  const lower = raw.toLowerCase()
  if (lower === "true") return true
  if (lower === "false") return false
  if (!isNaN(Number(raw))) return Number(raw)
  if (raw.includes(",")) {
    const parts = raw.split(",").map((s) => Number(s.trim()))
    if (parts.every((n) => !isNaN(n))) return { x: parts[0], y: parts[1], z: parts[2] ?? 0 }
  }
  return raw
}
