import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const WidgetTypeSchema = z.enum([
  "healthbar",
  "minimap",
  "inventory",
  "questtracker",
  "crosshair",
])

export const ue5HudCreateTool = tool({
  description:
    "Create HUD widgets in UE5: health bar, minimap, inventory grid, quest tracker, or crosshair. Configures initial params on spawn. Uses the 'hud create' console command.",
  args: {
    widgetType: WidgetTypeSchema.describe("Type of HUD widget to create"),
    params: z
      .string()
      .optional()
      .describe(
        "JSON config params, e.g. '{\"position\":\"TopLeft\",\"size\":200}'"
      ),
  },
  async execute(args) {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return {
        output: "UE5 Editor is not connected.",
        metadata: { success: false },
      }
    }

    const { widgetType, params } = args

    let command = `hud create ${widgetType}`
    if (params) {
      command += ` ${params}`
    }

    const result = await connector.sendCommand(command, { widgetType, params })

    if (!result.success) {
      return {
        output: `Failed to create ${widgetType} widget: ${result.error}`,
        metadata: { success: false, widgetType },
      }
    }

    let output = `${widgetType} widget created successfully.`
    if (result.result) {
      output += `\n${result.result}`
    }

    return {
      output,
      metadata: {
        success: true,
        widgetType,
        params: params ? JSON.parse(params) : undefined,
        rawResult: result.result,
      },
    }
  },
})
