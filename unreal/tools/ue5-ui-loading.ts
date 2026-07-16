import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5UiLoadingTool = tool({
  description:
    "Manage UE5 loading screens: show, hide, set progress bar, set loading text, set background image, and trigger fake loading. Uses the 'ui loading' console command.",
  args: {
    action: z
      .enum(["show", "hide", "set-progress", "set-text", "set-image", "fake"])
      .describe("Loading screen action to perform"),
    progress: z.number().optional().describe("Progress value from 0 to 100"),
    text: z.string().optional().describe("Loading screen text to display"),
    backgroundImage: z.string().optional().describe("Background image path or asset name"),
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

    const { action, progress, text, backgroundImage } = args

    if (action === "set-progress" && (progress === undefined || progress === null)) {
      return {
        output: "Action 'set-progress' requires a progress value (0-100).",
        metadata: { success: false },
      }
    }

    if (action === "set-text" && !text) {
      return {
        output: "Action 'set-text' requires a text parameter.",
        metadata: { success: false },
      }
    }

    if (action === "set-image" && !backgroundImage) {
      return {
        output: "Action 'set-image' requires a backgroundImage parameter.",
        metadata: { success: false },
      }
    }

    let command = `ui loading ${action}`
    if (progress !== undefined && progress !== null) command += ` ${progress}`
    if (text) command += ` ${text}`
    if (backgroundImage) command += ` ${backgroundImage}`

    const result = await connector.sendCommand(command, { action, progress, text, backgroundImage })

    if (!result.success) {
      return {
        output: `Loading screen command failed: ${result.error}`,
        metadata: { success: false, action },
      }
    }

    let output = ""
    switch (action) {
      case "show":
        output = "Loading screen shown."
        break
      case "hide":
        output = "Loading screen hidden."
        break
      case "set-progress":
        output = `Loading progress set to ${progress}%.`
        break
      case "set-text":
        output = `Loading text set to "${text}".`
        break
      case "set-image":
        output = `Loading background image set to "${backgroundImage}".`
        break
      case "fake":
        output = "Fake loading sequence triggered."
        break
    }

    return {
      output: `${output}\n${result.result ?? ""}`,
      metadata: { success: true, action, progress, text, backgroundImage },
    }
  },
})
