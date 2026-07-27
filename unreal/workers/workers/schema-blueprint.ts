import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const schemaBlueprintWorker: WorkerDefinition = {
  id: "schema-blueprint",
  name: "Schema Blueprint Worker",
  description: "Blueprint creation and editing. Create BPs, edit properties, compile, manage components.",
  category: "schema",
  keywords: ["blueprint", "bp", "kod", "script", "mantık", "logic", "edit", "düzenle"],
  schema: z.object({
    action: z.enum(["create", "edit", "compile", "add-component", "list"]).describe("Blueprint action"),
    blueprintName: z.string().describe("Blueprint name or path"),
    property: z.string().optional().describe("Property to edit"),
    value: z.string().optional().describe("New value for property"),
    componentType: z.string().optional().describe("Component type for add-component"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, blueprintName, property, value, componentType } = args
    let command = ""
    if (action === "compile") {
      command = `build blueprint compile name=${blueprintName}`
    } else if (action === "edit") {
      command = `build blueprint edit name=${blueprintName} property=${property} value=${value}`
    } else if (action === "add-component") {
      command = `build blueprint component name=${blueprintName} type=${componentType}`
    } else {
      command = `build blueprint ${action} name=${blueprintName}`
    }
    const result = await connector.sendCommand(command, { action, blueprintName, property, value, componentType })
    return {
      success: result.success,
      output: result.success ? `Blueprint ${action}: ${blueprintName}` : `Blueprint failed: ${result.error}`,
      metadata: result,
    }
  },
}
