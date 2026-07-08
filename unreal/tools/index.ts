import type { Plugin } from "../../packages/plugin/src/index.js"
import { ue5ConsoleTool } from "./ue5-console.js"
import { ue5SpawnActorTool } from "./ue5-spawn-actor.js"
import { ue5ListActorsTool } from "./ue5-list-actors.js"
import { ue5EditBlueprintTool } from "./ue5-edit-blueprint.js"
import { ue5CompileTool } from "./ue5-compile.js"
import { ue5ScreenshotTool } from "./ue5-screenshot.js"

export { UE5Connector, getUE5Connector } from "./ue5-connector.js"
export type { UE5CommandResponse, UE5Event } from "./ue5-connector.js"

export const UE5ToolsPlugin: Plugin = async (_ctx) => {
  return {
    tool: {
      "ue5-console": ue5ConsoleTool,
      "ue5-spawn-actor": ue5SpawnActorTool,
      "ue5-list-actors": ue5ListActorsTool,
      "ue5-edit-blueprint": ue5EditBlueprintTool,
      "ue5-compile": ue5CompileTool,
      "ue5-screenshot": ue5ScreenshotTool,
    },
  }
}

export default UE5ToolsPlugin
