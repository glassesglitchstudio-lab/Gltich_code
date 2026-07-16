import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5UiHudCustomTool = tool({
  description:
    "Manage custom UE5 HUD widgets: add, remove, position, resize, set opacity, toggle visibility, and list active widgets. Uses the 'ui hud-custom' console command.",
  args: {
    action: z
      .enum(["add-widget", "remove-widget", "set-position", "set-size", "set-opacity", "toggle", "list"])
      .describe("HUD custom widget action to perform"),
    widgetName: z.string().optional().describe("Name of the custom widget to target"),
    widgetType: z
      .enum(["bar", "text", "icon", "minimap", "crosshair"])
      .optional()
      .describe("Type of widget to create"),
    position: z.string().optional().describe("Widget position as 'x,y' coordinates (e.g. '100,200')"),
    size: z.string().optional().describe("Widget size as 'width,height' (e.g. '256,128')"),
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

    const { action, widgetName, widgetType, position, size } = args

    if (["remove-widget", "set-position", "set-size", "set-opacity", "toggle"].includes(action) && !widgetName) {
      return {
        output: `Action '${action}' requires a widgetName.`,
        metadata: { success: false },
      }
    }

    if (action === "add-widget" && !widgetName) {
      return {
        output: "Action 'add-widget' requires a widgetName.",
        metadata: { success: false },
      }
    }

    let command = `ui hud-custom ${action}`
    if (widgetName) command += ` ${widgetName}`
    if (widgetType) command += ` ${widgetType}`
    if (position) command += ` ${position}`
    if (size) command += ` ${size}`

    const result = await connector.sendCommand(command, { action, widgetName, widgetType, position, size })

    if (!result.success) {
      return {
        output: `HUD custom widget command failed: ${result.error}`,
        metadata: { success: false, action, widgetName },
      }
    }

    let output = ""
    switch (action) {
      case "add-widget":
        output = `Widget "${widgetName}" (${widgetType ?? "default"}) added to HUD.`
        break
      case "remove-widget":
        output = `Widget "${widgetName}" removed from HUD.`
        break
      case "set-position":
        output = `Widget "${widgetName}" position set to ${position}.`
        break
      case "set-size":
        output = `Widget "${widgetName}" size set to ${size}.`
        break
      case "set-opacity":
        output = `Widget "${widgetName}" opacity updated.`
        break
      case "toggle":
        output = `Widget "${widgetName}" visibility toggled.`
        break
      case "list":
        output = result.result || "Listed custom HUD widgets."
        break
    }

    return {
      output: `${output}\n${result.result ?? ""}`,
      metadata: { success: true, action, widgetName, widgetType, position, size },
    }
  },
})
