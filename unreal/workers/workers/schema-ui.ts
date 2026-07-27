import { z } from "zod"
import type { WorkerDefinition } from "../worker.types.js"
import { getUE5Connector } from "../../tools/ue5-connector.js"

export const schemaUiWorker: WorkerDefinition = {
  id: "schema-ui",
  name: "Schema UI Worker",
  description: "UI/HUD system. Create widgets, HUD elements, menus, inventory screens, dialogue boxes, tooltips.",
  category: "schema",
  keywords: ["ui", "hud", "menu", "menü", "widget", "arayüz", "interface", "screen", "ekran"],
  schema: z.object({
    action: z.enum(["create", "show", "hide", "update", "create-hud", "create-menu"]).describe("UI action"),
    widgetType: z.string().optional().describe("Widget type (healthbar, inventory, minimap, dialogue, crosshair)"),
    widgetName: z.string().optional().describe("Widget name"),
    visible: z.boolean().optional().describe("Visibility"),
  }),
  async handler(args) {
    const connector = getUE5Connector()
    const { action, widgetType, widgetName, visible } = args
    let command = `build ui ${action}`
    if (widgetType) command += ` type=${widgetType}`
    if (widgetName) command += ` name=${widgetName}`
    if (visible !== undefined) command += ` visible=${visible}`
    const result = await connector.sendCommand(command, { action, widgetType, widgetName, visible })
    return {
      success: result.success,
      output: result.success ? `UI ${action}: ${widgetType || widgetName || "default"}` : `UI failed: ${result.error}`,
      metadata: result,
    }
  },
}
