import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

const HudWidgetSchema = z.enum([
  "health",
  "minimap",
  "inventory",
  "quest",
  "crosshair",
])

const HudActionSchema = z.enum(["show", "hide", "update"])

export const ue5HudTool = tool({
  description:
    "Manage UE5 HUD widgets: show, hide, or update health bar, minimap, inventory, quest tracker, and crosshair. Uses the 'hud' console command.",
  args: {
    action: HudActionSchema.describe("HUD action to perform"),
    widget: HudWidgetSchema.describe("HUD widget to target"),
    params: z
      .string()
      .optional()
      .describe(
        "JSON params for the action, e.g. '{\"health\":80,\"maxHealth\":100}' for health update"
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

    const { action, widget, params } = args

    let command = `hud ${action} ${widget}`
    if (params) {
      command += ` ${params}`
    }

    const result = await connector.sendCommand(command, { action, widget, params })

    if (!result.success) {
      return {
        output: `HUD command failed: ${result.error}`,
        metadata: { success: false, action, widget },
      }
    }

    let output = ""
    switch (action) {
      case "show":
        output = `${widget} widget shown.`
        break
      case "hide":
        output = `${widget} widget hidden.`
        break
      case "update":
        output = `${widget} widget updated.`
        break
    }

    if (result.result) {
      output += `\n${result.result}`
    }

    return {
      output,
      metadata: {
        success: true,
        action,
        widget,
        params: params ? JSON.parse(params) : undefined,
        rawResult: result.result,
      },
    }
  },
})
