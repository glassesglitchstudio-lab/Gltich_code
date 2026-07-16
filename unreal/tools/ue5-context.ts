import { z } from "zod"
import { tool } from "../../packages/plugin/src/tool.js"
import { getUE5Connector } from "./ue5-connector.js"

export const ue5ContextTool = tool({
  description:
    "Get the current editor context: FPS, open level, and object list. Sends multiple console commands and returns a combined snapshot.",
  args: {},
  async execute() {
    const connector = getUE5Connector()
    const status = await connector.getStatus()
    if (!status.connected) {
      return { output: "UE5 Editor is not connected.", metadata: { success: false } }
    }

    const [fpsResult, levelResult, objResult] = await Promise.all([
      connector.sendCommand("stat fps"),
      connector.sendCommand("get current level"),
      connector.sendCommand("obj list"),
    ])

    const sections: string[] = []

    sections.push("--- FPS ---")
    sections.push(fpsResult.success ? (fpsResult.result ?? "No data") : `Error: ${fpsResult.error}`)

    sections.push("\n--- Current Level ---")
    sections.push(levelResult.success ? (levelResult.result ?? "No data") : `Error: ${levelResult.error}`)

    sections.push("\n--- Objects in Level ---")
    sections.push(objResult.success ? (objResult.result ?? "No data") : `Error: ${objResult.error}`)

    return {
      output: sections.join("\n"),
      metadata: {
        success: true,
        editorVersion: status.editorVersion,
        projectName: status.projectName,
        playInEditor: status.playInEditor,
      },
    }
  },
})
