import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5UiMenuTool = tool({
  description:
    "Manage UE5 in-game menus: create, show, hide, add/remove buttons, set theme, and navigate between menu screens. Uses the 'ui menu' console command.",
  args: {
    action: z
      .enum(["create", "show", "hide", "add-button", "remove-button", "set-theme", "navigate"])
      .describe("Menu action to perform"),
    menuName: z.string().optional().describe("Name of the menu to target"),
    buttonLabel: z.string().optional().describe("Label of the button to add or remove"),
    theme: z
      .enum(["default", "horror", "minimal", "neon"])
      .optional()
      .describe("Menu theme to apply"),
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

    const { action, menuName, buttonLabel, theme } = args

    if (["create", "show", "hide", "set-theme", "navigate"].includes(action) && !menuName) {
      return {
        output: `Action '${action}' requires a menuName.`,
        metadata: { success: false },
      }
    }

    if (["add-button", "remove-button"].includes(action) && !buttonLabel) {
      return {
        output: `Action '${action}' requires a buttonLabel.`,
        metadata: { success: false },
      }
    }

    if (action === "set-theme" && !theme) {
      return {
        output: "Action 'set-theme' requires a theme.",
        metadata: { success: false },
      }
    }

    let command = `ui menu ${action}`
    if (menuName) command += ` ${menuName}`
    if (buttonLabel) command += ` ${buttonLabel}`
    if (theme) command += ` ${theme}`

    const result = await connector.sendCommand(command, { action, menuName, buttonLabel, theme })

    if (!result.success) {
      return {
        output: `UI menu command failed: ${result.error}`,
        metadata: { success: false, action, menuName },
      }
    }

    let output = ""
    switch (action) {
      case "create":
        output = `Menu "${menuName}" created.`
        break
      case "show":
        output = `Menu "${menuName}" shown.`
        break
      case "hide":
        output = `Menu "${menuName}" hidden.`
        break
      case "add-button":
        output = `Button "${buttonLabel}" added to menu "${menuName}".`
        break
      case "remove-button":
        output = `Button "${buttonLabel}" removed from menu "${menuName}".`
        break
      case "set-theme":
        output = `Menu "${menuName}" theme set to "${theme}".`
        break
      case "navigate":
        output = `Navigated to menu "${menuName}".`
        break
    }

    return {
      output: `${output}\n${result.result ?? ""}`,
      metadata: { success: true, action, menuName, buttonLabel, theme },
    }
  },
})
