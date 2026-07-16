import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5UiTooltipTool = tool({
  description:
    "Manage UE5 tooltips: show, hide, set text, set target actor, apply style, and enable auto-tooltip. Uses the 'ui tooltip' console command.",
  args: {
    action: z
      .enum(["show", "hide", "set-text", "set-target", "style", "enable-auto"])
      .describe("Tooltip action to perform"),
    text: z.string().optional().describe("Tooltip text content to display"),
    target: z.string().optional().describe("Target actor name or ID to attach tooltip to"),
    tooltipType: z
      .enum(["hover", "static", "interaction"])
      .optional()
      .describe("Tooltip display type"),
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

    const { action, text, target, tooltipType } = args

    if (action === "set-text" && !text) {
      return {
        output: "Action 'set-text' requires a text parameter.",
        metadata: { success: false },
      }
    }

    if (action === "set-target" && !target) {
      return {
        output: "Action 'set-target' requires a target parameter.",
        metadata: { success: false },
      }
    }

    if (action === "style" && !tooltipType) {
      return {
        output: "Action 'style' requires a tooltipType parameter.",
        metadata: { success: false },
      }
    }

    let command = `ui tooltip ${action}`
    if (text) command += ` ${text}`
    if (target) command += ` ${target}`
    if (tooltipType) command += ` ${tooltipType}`

    const result = await connector.sendCommand(command, { action, text, target, tooltipType })

    if (!result.success) {
      return {
        output: `Tooltip command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    let output = ""
    switch (action) {
      case "show":
        output = "Tooltip shown."
        break
      case "hide":
        output = "Tooltip hidden."
        break
      case "set-text":
        output = `Tooltip text set to "${text}".`
        break
      case "set-target":
        output = `Tooltip target set to "${target}".`
        break
      case "style":
        output = `Tooltip style set to "${tooltipType}".`
        break
      case "enable-auto":
        output = "Auto-tooltip enabled."
        break
    }

    return {
      output: `${output}\n${result.result ?? ""}`,
      metadata: { success: true, action, text, target, tooltipType },
    }
  },
})
